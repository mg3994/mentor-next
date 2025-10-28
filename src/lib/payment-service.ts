// Comprehensive Payment Service
// This service provides a unified interface for all payment operations

import { prisma } from './db'
import { 
  processPayment, 
  processMentorPayout, 
  createPaymentOrder, 
  verifyPayment,
  generatePaymentReceipt,
  PaymentData,
  PayoutData,
  PaymentOrder
} from './payment-utils'
import { 
  getPaymentMethodById, 
  validatePaymentAmount, 
  calculateProcessingFee,
  RISK_CONFIG,
  PAYOUT_CONFIG
} from './payment-config'
import { createAuditLog, logPaymentAction } from './db-utils'

export class PaymentService {
  
  // Initialize a new payment session
  async initializePayment(params: {
    sessionId: string
    userId: string
    pricingModelId: string
    duration?: number
    currency?: string
    country?: string
  }) {
    try {
      const { sessionId, userId, pricingModelId, duration, currency = 'USD', country = 'US' } = params

      // Get session and pricing details
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
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
          mentee: true,
        },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      if (session.menteeId !== userId) {
        throw new Error('Unauthorized access to session')
      }

      // Get pricing model
      const pricingModel = session.mentor.mentorProfile?.pricingModels.find(
        (pm: any) => pm.id === pricingModelId && pm.isActive
      )

      if (!pricingModel) {
        throw new Error('Pricing model not found or inactive')
      }

      // Calculate amount
      const baseAmount = this.calculateAmount(pricingModel.type, pricingModel.price, duration)
      
      // Validate amount and get available payment methods
      const availablePaymentMethods = await this.getAvailablePaymentMethods(
        baseAmount, 
        currency, 
        country
      )

      if (availablePaymentMethods.length === 0) {
        throw new Error('No payment methods available for this transaction')
      }

      // Create payment order
      const order = await createPaymentOrder({
        amount: baseAmount,
        currency,
        description: `Session with ${session.mentor.name}`,
        customerInfo: {
          userId,
          name: session.mentee.name || 'Unknown',
          email: session.mentee.email || '',
        },
        metadata: {
          sessionId,
          mentorId: session.mentorId,
          pricingType: pricingModel.type,
        },
      })

      // Log payment initialization
      await logPaymentAction({
        userId,
        action: 'PAYMENT_CREATED',
        details: {
          orderId: order.orderId,
          sessionId,
          amount: baseAmount,
          currency,
        },
      })

      return {
        success: true,
        order,
        paymentMethods: availablePaymentMethods,
        session: {
          id: session.id,
          startTime: session.startTime,
          mentor: {
            name: session.mentor.name,
            image: session.mentor.image,
          },
        },
        pricingModel: {
          type: pricingModel.type,
          price: pricingModel.price,
          description: pricingModel.description,
        },
      }

    } catch (error) {
      console.error('Payment initialization error:', error)
      throw error
    }
  }

  // Process a payment
  async processPayment(params: {
    orderId: string
    paymentMethodId: string
    userId: string
    gatewayTransactionId?: string
  }) {
    try {
      const { orderId, paymentMethodId, userId, gatewayTransactionId } = params

      // Get order details from audit log
      const orderLog = await prisma.auditLog.findFirst({
        where: {
          action: 'PAYMENT_ORDER_CREATED',
          resource: 'payment_order',
          details: {
            path: ['orderId'],
            equals: orderId,
          },
        },
      })

      if (!orderLog || !orderLog.details) {
        throw new Error('Order not found')
      }

      const orderDetails = orderLog.details as any
      const sessionId = orderDetails.sessionId
      const amount = orderDetails.amount

      // Validate payment method
      const paymentMethod = getPaymentMethodById(paymentMethodId)
      if (!paymentMethod) {
        throw new Error('Invalid payment method')
      }

      // Risk assessment
      const riskAssessment = await this.assessRisk(userId, amount, paymentMethodId)
      if (!riskAssessment.approved) {
        throw new Error(`Payment blocked: ${riskAssessment.reason}`)
      }

      // Process payment
      const paymentData: PaymentData = {
        sessionId,
        amount,
        paymentMethod: paymentMethodId,
        userId,
      }

      const result = await processPayment(paymentData)

      // Log successful payment
      await logPaymentAction({
        userId,
        action: 'PAYMENT_COMPLETED',
        transactionId: result.transaction?.id,
        amount,
        details: {
          orderId,
          paymentMethodId,
          gatewayTransactionId,
        },
      })

      return result

    } catch (error) {
      console.error('Payment processing error:', error)
      
      // Log failed payment
      await logPaymentAction({
        userId: params.userId,
        action: 'PAYMENT_FAILED',
        details: {
          orderId: params.orderId,
          paymentMethodId: params.paymentMethodId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      throw error
    }
  }

  // Process mentor payout
  async processPayout(params: {
    mentorId: string
    amount: number
    transactionIds: string[]
    payoutMethod?: string
  }) {
    try {
      const { mentorId, amount, transactionIds, payoutMethod = 'bank_transfer' } = params

      // Validate payout amount
      if (amount < PAYOUT_CONFIG.minAmount) {
        throw new Error(`Minimum payout amount is ${PAYOUT_CONFIG.minAmount}`)
      }

      if (amount > PAYOUT_CONFIG.maxAmount) {
        throw new Error(`Maximum payout amount is ${PAYOUT_CONFIG.maxAmount}`)
      }

      // Check if mentor has sufficient earnings
      const transactions = await prisma.transaction.findMany({
        where: {
          id: { in: transactionIds },
          session: { mentorId },
          status: 'COMPLETED',
        },
      })

      if (transactions.length !== transactionIds.length) {
        throw new Error('Invalid transactions for payout')
      }

      const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
      if (Math.abs(totalEarnings - amount) > 0.01) {
        throw new Error('Payout amount mismatch')
      }

      // Process payout
      const payoutData: PayoutData = {
        mentorId,
        amount,
        transactionIds,
      }

      const result = await processMentorPayout(payoutData)

      // Log payout
      await logPaymentAction({
        userId: mentorId,
        action: 'PAYOUT_PROCESSED',
        amount,
        details: {
          payoutId: result.payout?.id,
          transactionCount: transactionIds.length,
          payoutMethod,
        },
      })

      return result

    } catch (error) {
      console.error('Payout processing error:', error)
      throw error
    }
  }

  // Get available payment methods for a transaction
  async getAvailablePaymentMethods(amount: number, currency: string, country: string) {
    const { getPaymentMethodsByCountry, getPaymentMethodsByCurrency } = await import('./payment-config')
    
    // Get methods available for country and currency
    const countryMethods = getPaymentMethodsByCountry(country)
    const currencyMethods = getPaymentMethodsByCurrency(currency)
    
    // Find intersection
    const availableMethods = countryMethods.filter(method => 
      currencyMethods.some(cm => cm.id === method.id)
    )

    // Filter by amount limits
    return availableMethods.filter(method => {
      const validation = validatePaymentAmount(amount, method.id, currency)
      return validation.valid
    }).map(method => ({
      id: method.id,
      name: method.name,
      type: method.type,
      processingFee: calculateProcessingFee(amount, method.id),
      instantSettlement: method.instantSettlement,
      requiresVerification: method.requiresVerification,
    }))
  }

  // Risk assessment for payments
  async assessRisk(userId: string, amount: number, paymentMethodId: string): Promise<{
    approved: boolean
    reason?: string
    riskScore: number
  }> {
    try {
      let riskScore = 0

      // Check daily spending limit
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const dailyTransactions = await prisma.transaction.findMany({
        where: {
          session: {
            menteeId: userId,
          },
          status: 'COMPLETED',
          completedAt: {
            gte: today,
          },
        },
      })

      const dailySpent = dailyTransactions.reduce((sum: number, t: any) => sum + t.amount, 0)
      
      if (dailySpent + amount > RISK_CONFIG.maxDailyAmount) {
        return {
          approved: false,
          reason: 'Daily spending limit exceeded',
          riskScore: 100,
        }
      }

      // Check monthly spending limit
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      
      const monthlyTransactions = await prisma.transaction.findMany({
        where: {
          session: {
            menteeId: userId,
          },
          status: 'COMPLETED',
          completedAt: {
            gte: monthStart,
          },
        },
      })

      const monthlySpent = monthlyTransactions.reduce((sum: number, t: any) => sum + t.amount, 0)
      
      if (monthlySpent + amount > RISK_CONFIG.maxMonthlyAmount) {
        return {
          approved: false,
          reason: 'Monthly spending limit exceeded',
          riskScore: 100,
        }
      }

      // Check for suspicious amounts
      if (amount > RISK_CONFIG.suspiciousAmountThreshold) {
        riskScore += 30
      }

      // Check velocity (multiple transactions in short time)
      if (RISK_CONFIG.velocityCheckEnabled) {
        const recentTransactions = await prisma.transaction.findMany({
          where: {
            session: {
              menteeId: userId,
            },
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
            },
          },
        })

        if (recentTransactions.length > 5) {
          riskScore += 40
        }
      }

      // Risk score assessment
      const approved = riskScore < 70 // Approve if risk score is below 70

      return {
        approved,
        reason: approved ? undefined : 'High risk transaction',
        riskScore,
      }

    } catch (error) {
      console.error('Risk assessment error:', error)
      return {
        approved: false,
        reason: 'Risk assessment failed',
        riskScore: 100,
      }
    }
  }

  // Calculate amount based on pricing type
  private calculateAmount(pricingType: string, basePrice: number, duration?: number): number {
    switch (pricingType) {
      case 'ONE_TIME':
        return basePrice
      case 'HOURLY':
        const hours = duration ? duration / 60 : 1
        return basePrice * hours
      case 'MONTHLY_SUBSCRIPTION':
        return basePrice
      default:
        return basePrice
    }
  }

  // Get payment receipt
  async getPaymentReceipt(transactionId: string, userId: string) {
    try {
      // Verify user has access to this transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          OR: [
            { session: { menteeId: userId } },
            { session: { mentorId: userId } },
          ],
        },
      })

      if (!transaction) {
        throw new Error('Transaction not found or access denied')
      }

      return await generatePaymentReceipt(transactionId)

    } catch (error) {
      console.error('Get receipt error:', error)
      throw error
    }
  }

  // Get payment history for a user
  async getPaymentHistory(userId: string, params: {
    page?: number
    limit?: number
    status?: string
    startDate?: Date
    endDate?: Date
  } = {}) {
    try {
      const { page = 1, limit = 10, status, startDate, endDate } = params
      const skip = (page - 1) * limit

      const where: any = {
        OR: [
          { session: { menteeId: userId } },
          { session: { mentorId: userId } },
        ],
      }

      if (status) {
        where.status = status
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            session: {
              include: {
                mentor: {
                  select: { name: true, image: true },
                },
                mentee: {
                  select: { name: true, image: true },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.transaction.count({ where }),
      ])

      return {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }

    } catch (error) {
      console.error('Get payment history error:', error)
      throw error
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService()