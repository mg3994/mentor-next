// Payment Models Service
// This service handles different payment processing models: one-time, hourly, and subscription

import { prisma } from './db'
import { razorpayService } from './razorpay-service'
import { convertToRazorpayAmount, convertFromRazorpayAmount } from './razorpay-config'
import { createTransactionWithAudit, logPaymentAction } from './db-utils'

export interface PaymentProcessingResult {
  success: boolean
  transaction?: any
  subscription?: any
  error?: string
  nextPaymentDate?: Date
  usageTracking?: any
}

export interface OneTimePaymentParams {
  sessionId: string
  userId: string
  mentorId: string
  amount: number
  pricingModelId: string
}

export interface HourlyPaymentParams {
  sessionId: string
  userId: string
  mentorId: string
  hourlyRate: number
  estimatedHours: number
  pricingModelId: string
}

export interface SubscriptionPaymentParams {
  userId: string
  mentorId: string
  monthlyAmount: number
  pricingModelId: string
  startDate?: Date
}

export interface UsageTrackingData {
  sessionId: string
  startTime: Date
  endTime?: Date
  actualMinutes?: number
  estimatedMinutes: number
  hourlyRate: number
  totalCost?: number
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}

export class PaymentModelsService {

  /**
   * Process one-time session payment
   */
  async processOneTimePayment(params: OneTimePaymentParams): Promise<PaymentProcessingResult> {
    try {
      const { sessionId, userId, mentorId, amount, pricingModelId } = params

      // Validate session exists and belongs to user
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          menteeId: userId,
          mentorId,
        },
        include: {
          mentor: {
            include: {
              mentorProfile: {
                include: {
                  pricingModels: true,
                },
              },
            },
          },
        },
      })

      if (!session) {
        return { success: false, error: 'Session not found or access denied' }
      }

      // Validate pricing model
      const pricingModel = session.mentor.mentorProfile?.pricingModels.find(
        (pm: any) => pm.id === pricingModelId && pm.type === 'ONE_TIME' && pm.isActive
      )

      if (!pricingModel) {
        return { success: false, error: 'Invalid pricing model for one-time payment' }
      }

      // Verify amount matches pricing model
      if (Math.abs(amount - pricingModel.price) > 0.01) {
        return { success: false, error: 'Payment amount mismatch' }
      }

      // Calculate platform fee and mentor earnings
      const platformFeeRate = 0.05 // 5% platform fee
      const platformFee = amount * platformFeeRate
      const mentorEarnings = amount - platformFee

      // Create transaction record
      const transaction = await createTransactionWithAudit(
        {
          sessionId,
          amount,
          platformFee,
          mentorEarnings,
          paymentMethod: 'razorpay',
        },
        userId
      )

      // Update session with payment info
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'SCHEDULED',
          pricingType: 'ONE_TIME',
          agreedPrice: amount,
        },
      })

      // Log payment processing
      await logPaymentAction({
        userId,
        action: 'PAYMENT_COMPLETED',
        transactionId: transaction.id,
        amount,
        details: {
          sessionId,
          mentorId,
          pricingType: 'ONE_TIME',
          platformFee,
          mentorEarnings,
        },
      })

      return {
        success: true,
        transaction: {
          id: transaction.id,
          amount,
          platformFee,
          mentorEarnings,
          status: transaction.status,
        },
      }

    } catch (error) {
      console.error('One-time payment processing error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      }
    }
  }

  /**
   * Process hourly session payment with usage tracking
   */
  async processHourlyPayment(params: HourlyPaymentParams): Promise<PaymentProcessingResult> {
    try {
      const { sessionId, userId, mentorId, hourlyRate, estimatedHours, pricingModelId } = params

      // Validate session exists and belongs to user
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          menteeId: userId,
          mentorId,
        },
        include: {
          mentor: {
            include: {
              mentorProfile: {
                include: {
                  pricingModels: true,
                },
              },
            },
          },
        },
      })

      if (!session) {
        return { success: false, error: 'Session not found or access denied' }
      }

      // Validate pricing model
      const pricingModel = session.mentor.mentorProfile?.pricingModels.find(
        (pm: any) => pm.id === pricingModelId && pm.type === 'HOURLY' && pm.isActive
      )

      if (!pricingModel) {
        return { success: false, error: 'Invalid pricing model for hourly payment' }
      }

      // Verify hourly rate matches pricing model
      if (Math.abs(hourlyRate - pricingModel.price) > 0.01) {
        return { success: false, error: 'Hourly rate mismatch' }
      }

      // Calculate estimated amount
      const estimatedAmount = hourlyRate * estimatedHours
      const platformFeeRate = 0.05
      const estimatedPlatformFee = estimatedAmount * platformFeeRate
      const estimatedMentorEarnings = estimatedAmount - estimatedPlatformFee

      // Create initial transaction record (will be updated when session completes)
      const transaction = await createTransactionWithAudit(
        {
          sessionId,
          amount: estimatedAmount,
          platformFee: estimatedPlatformFee,
          mentorEarnings: estimatedMentorEarnings,
          paymentMethod: 'razorpay',
        },
        userId
      )

      // Create usage tracking record
      const usageTracking = await this.createUsageTracking({
        sessionId,
        startTime: session.startTime,
        estimatedMinutes: estimatedHours * 60,
        hourlyRate,
        totalCost: estimatedAmount,
        status: 'ACTIVE',
      })

      // Update session with payment info
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'SCHEDULED',
          pricingType: 'HOURLY',
          agreedPrice: hourlyRate,
        },
      })

      // Log payment processing
      await logPaymentAction({
        userId,
        action: 'PAYMENT_COMPLETED',
        transactionId: transaction.id,
        amount: estimatedAmount,
        details: {
          sessionId,
          mentorId,
          pricingType: 'HOURLY',
          hourlyRate,
          estimatedHours,
          estimatedAmount,
          usageTrackingId: usageTracking.id,
        },
      })

      return {
        success: true,
        transaction: {
          id: transaction.id,
          amount: estimatedAmount,
          platformFee: estimatedPlatformFee,
          mentorEarnings: estimatedMentorEarnings,
          status: transaction.status,
          type: 'estimated',
        },
        usageTracking,
      }

    } catch (error) {
      console.error('Hourly payment processing error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hourly payment processing failed',
      }
    }
  }

  /**
   * Process monthly subscription payment
   */
  async processSubscriptionPayment(params: SubscriptionPaymentParams): Promise<PaymentProcessingResult> {
    try {
      const { userId, mentorId, monthlyAmount, pricingModelId, startDate = new Date() } = params

      // Validate mentor exists and has subscription pricing
      const mentor = await prisma.user.findFirst({
        where: {
          id: mentorId,
          roles: {
            some: {
              role: 'MENTOR',
              status: 'ACTIVE',
            },
          },
        },
        include: {
          mentorProfile: {
            include: {
              pricingModels: true,
            },
          },
        },
      })

      if (!mentor) {
        return { success: false, error: 'Mentor not found' }
      }

      // Validate pricing model
      const pricingModel = mentor.mentorProfile?.pricingModels.find(
        (pm: any) => pm.id === pricingModelId && pm.type === 'MONTHLY_SUBSCRIPTION' && pm.isActive
      )

      if (!pricingModel) {
        return { success: false, error: 'Invalid subscription pricing model' }
      }

      // Verify amount matches pricing model
      if (Math.abs(monthlyAmount - pricingModel.price) > 0.01) {
        return { success: false, error: 'Subscription amount mismatch' }
      }

      // Check if user already has active subscription with this mentor
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          mentorId,
          status: 'ACTIVE',
        },
      })

      if (existingSubscription) {
        return { success: false, error: 'Active subscription already exists with this mentor' }
      }

      // Calculate next payment date (30 days from start)
      const nextPaymentDate = new Date(startDate)
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 30)

      // Calculate platform fee and mentor earnings
      const platformFeeRate = 0.05
      const platformFee = monthlyAmount * platformFeeRate
      const mentorEarnings = monthlyAmount - platformFee

      // Create subscription record
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          mentorId,
          pricingModelId,
          amount: monthlyAmount,
          status: 'ACTIVE',
          startDate,
          nextPaymentDate,
          currentPeriodStart: startDate,
          currentPeriodEnd: nextPaymentDate,
        },
      })

      // Create initial transaction record
      const transaction = await createTransactionWithAudit(
        {
          sessionId: `subscription_${subscription.id}`, // Use subscription ID as session reference
          amount: monthlyAmount,
          platformFee,
          mentorEarnings,
          paymentMethod: 'razorpay',
        },
        userId
      )

      // Log subscription creation
      await logPaymentAction({
        userId,
        action: 'PAYMENT_COMPLETED',
        transactionId: transaction.id,
        amount: monthlyAmount,
        details: {
          subscriptionId: subscription.id,
          mentorId,
          pricingType: 'MONTHLY_SUBSCRIPTION',
          startDate,
          nextPaymentDate,
          platformFee,
          mentorEarnings,
        },
      })

      return {
        success: true,
        subscription: {
          id: subscription.id,
          amount: monthlyAmount,
          status: subscription.status,
          startDate,
          nextPaymentDate,
        },
        transaction: {
          id: transaction.id,
          amount: monthlyAmount,
          platformFee,
          mentorEarnings,
          status: transaction.status,
        },
        nextPaymentDate,
      }

    } catch (error) {
      console.error('Subscription payment processing error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription processing failed',
      }
    }
  }

  /**
   * Complete hourly session and calculate final payment
   */
  async completeHourlySession(sessionId: string, actualMinutes: number): Promise<PaymentProcessingResult> {
    try {
      // Get session and usage tracking
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          transaction: true,
        },
      })

      if (!session || session.pricingType !== 'HOURLY') {
        return { success: false, error: 'Invalid session for hourly completion' }
      }

      const usageTracking = await prisma.usageTracking.findFirst({
        where: { sessionId },
      })

      if (!usageTracking) {
        return { success: false, error: 'Usage tracking not found' }
      }

      // Calculate actual cost
      const actualHours = actualMinutes / 60
      const actualAmount = usageTracking.hourlyRate * actualHours
      const platformFeeRate = 0.05
      const actualPlatformFee = actualAmount * platformFeeRate
      const actualMentorEarnings = actualAmount - actualPlatformFee

      // Update usage tracking
      await prisma.usageTracking.update({
        where: { id: usageTracking.id },
        data: {
          endTime: new Date(),
          actualMinutes,
          totalCost: actualAmount,
          status: 'COMPLETED',
        },
      })

      // Update transaction with actual amounts
      const updatedTransaction = await prisma.transaction.update({
        where: { id: session.transaction!.id },
        data: {
          amount: actualAmount,
          platformFee: actualPlatformFee,
          mentorEarnings: actualMentorEarnings,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })

      // Update session
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          actualDuration: actualMinutes,
        },
      })

      // Log completion
      await logPaymentAction({
        userId: session.menteeId,
        action: 'PAYMENT_COMPLETED',
        transactionId: updatedTransaction.id,
        amount: actualAmount,
        details: {
          sessionId,
          actualMinutes,
          actualHours,
          actualAmount,
          originalEstimate: usageTracking.totalCost,
          difference: actualAmount - (usageTracking.totalCost || 0),
        },
      })

      return {
        success: true,
        transaction: {
          id: updatedTransaction.id,
          amount: actualAmount,
          platformFee: actualPlatformFee,
          mentorEarnings: actualMentorEarnings,
          status: updatedTransaction.status,
          actualMinutes,
          actualHours,
        },
        usageTracking: {
          id: usageTracking.id,
          actualMinutes,
          totalCost: actualAmount,
          status: 'COMPLETED',
        },
      }

    } catch (error) {
      console.error('Hourly session completion error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session completion failed',
      }
    }
  }

  /**
   * Process subscription renewal
   */
  async processSubscriptionRenewal(subscriptionId: string): Promise<PaymentProcessingResult> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: true,
          mentor: true,
          pricingModel: true,
        },
      })

      if (!subscription || subscription.status !== 'ACTIVE') {
        return { success: false, error: 'Invalid or inactive subscription' }
      }

      // Check if renewal is due
      const now = new Date()
      if (subscription.nextPaymentDate > now) {
        return { success: false, error: 'Subscription renewal not due yet' }
      }

      // Calculate next payment date
      const nextPaymentDate = new Date(subscription.nextPaymentDate)
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 30)

      // Calculate platform fee and mentor earnings
      const platformFeeRate = 0.05
      const platformFee = subscription.amount * platformFeeRate
      const mentorEarnings = subscription.amount - platformFee

      // Create renewal transaction
      const transaction = await createTransactionWithAudit(
        {
          sessionId: `subscription_renewal_${subscription.id}`,
          amount: subscription.amount,
          platformFee,
          mentorEarnings,
          paymentMethod: 'razorpay',
        },
        subscription.userId
      )

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          nextPaymentDate,
          currentPeriodStart: subscription.nextPaymentDate,
          currentPeriodEnd: nextPaymentDate,
          updatedAt: new Date(),
        },
      })

      // Log renewal
      await logPaymentAction({
        userId: subscription.userId,
        action: 'PAYMENT_COMPLETED',
        transactionId: transaction.id,
        amount: subscription.amount,
        details: {
          subscriptionId,
          mentorId: subscription.mentorId,
          renewalDate: now,
          nextPaymentDate,
          type: 'subscription_renewal',
        },
      })

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          amount: updatedSubscription.amount,
          status: updatedSubscription.status,
          nextPaymentDate: updatedSubscription.nextPaymentDate,
        },
        transaction: {
          id: transaction.id,
          amount: subscription.amount,
          platformFee,
          mentorEarnings,
          status: transaction.status,
        },
        nextPaymentDate: updatedSubscription.nextPaymentDate,
      }

    } catch (error) {
      console.error('Subscription renewal error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription renewal failed',
      }
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, userId: string, reason?: string): Promise<PaymentProcessingResult> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          userId,
          status: 'ACTIVE',
        },
      })

      if (!subscription) {
        return { success: false, error: 'Subscription not found or already cancelled' }
      }

      // Update subscription status
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      })

      // Log cancellation
      await logPaymentAction({
        userId,
        action: 'PAYMENT_FAILED', // Using existing action type
        details: {
          subscriptionId,
          mentorId: subscription.mentorId,
          cancelledAt: new Date(),
          reason,
          type: 'subscription_cancellation',
        },
      })

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelledAt: updatedSubscription.cancelledAt,
        },
      }

    } catch (error) {
      console.error('Subscription cancellation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Subscription cancellation failed',
      }
    }
  }

  /**
   * Get user's active subscriptions
   */
  async getUserSubscriptions(userId: string) {
    try {
      const subscriptions = await prisma.subscription.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          pricingModel: {
            select: {
              id: true,
              type: true,
              price: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return {
        success: true,
        subscriptions,
      }

    } catch (error) {
      console.error('Get user subscriptions error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get subscriptions',
      }
    }
  }

  /**
   * Get session usage tracking
   */
  async getSessionUsageTracking(sessionId: string) {
    try {
      const usageTracking = await prisma.usageTracking.findFirst({
        where: { sessionId },
      })

      return {
        success: true,
        usageTracking,
      }

    } catch (error) {
      console.error('Get usage tracking error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get usage tracking',
      }
    }
  }

  /**
   * Create usage tracking record
   */
  private async createUsageTracking(data: UsageTrackingData) {
    return await prisma.usageTracking.create({
      data,
    })
  }
}

// Export singleton instance
export const paymentModelsService = new PaymentModelsService()
