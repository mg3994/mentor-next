// Pricing Models Handler
// Specialized payment processing for different pricing models

import { prisma } from './db'
import { createAuditLog, logPaymentAction } from './db-utils'
import { processPayment, PaymentData } from './payment-utils'

export interface PricingModelHandler {
  validateBooking(params: any): Promise<{ valid: boolean; error?: string }>
  calculateAmount(params: any): number
  processPayment(params: any): Promise<any>
  handleUsageTracking?(params: any): Promise<void>
}

// One-time session pricing model
export class OneTimeSessionHandler implements PricingModelHandler {
  async validateBooking(params: {
    mentorId: string
    startTime: Date
    endTime: Date
    pricingModelId: string
  }) {
    const { mentorId, startTime, endTime, pricingModelId } = params

    // Get pricing model
    const pricingModel = await prisma.pricingModel.findFirst({
      where: {
        id: pricingModelId,
        mentorId,
        type: 'ONE_TIME',
        isActive: true,
      },
    })

    if (!pricingModel) {
      return { valid: false, error: 'One-time pricing model not found' }
    }

    // Validate session duration matches pricing model
    const sessionDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60) // minutes
    
    if (pricingModel.duration && Math.abs(sessionDuration - pricingModel.duration) > 5) {
      return { 
        valid: false, 
        error: `Session duration must be ${pricingModel.duration} minutes for this pricing model` 
      }
    }

    // Check for booking conflicts
    const conflictingSession = await prisma.session.findFirst({
      where: {
        mentorId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        OR: [
          {
            startTime: { lte: startTime },
            scheduledEnd: { gt: startTime },
          },
          {
            startTime: { lt: endTime },
            scheduledEnd: { gte: endTime },
          },
          {
            startTime: { gte: startTime },
            scheduledEnd: { lte: endTime },
          },
        ],
      },
    })

    if (conflictingSession) {
      return { valid: false, error: 'Time slot conflicts with existing booking' }
    }

    return { valid: true }
  }

  calculateAmount(params: {
    pricingModel: { price: number; duration?: number }
    duration?: number
  }) {
    const { pricingModel } = params
    return pricingModel.price // Fixed price for one-time sessions
  }

  async processPayment(params: {
    sessionId: string
    userId: string
    amount: number
    paymentMethod: string
  }) {
    const { sessionId, userId, amount, paymentMethod } = params

    // Process payment
    const paymentData: PaymentData = {
      sessionId,
      amount,
      paymentMethod,
      userId,
    }

    const result = await processPayment(paymentData)

    // Log one-time session payment
    await logPaymentAction({
      userId,
      action: 'PAYMENT_COMPLETED',
      transactionId: result.transaction?.id,
      amount,
      details: {
        pricingType: 'ONE_TIME',
        sessionId,
        paymentMethod,
      },
    })

    return result
  }
}

// Hourly session pricing model
export class HourlySessionHandler implements PricingModelHandler {
  async validateBooking(params: {
    mentorId: string
    startTime: Date
    pricingModelId: string
    estimatedDuration?: number
  }) {
    const { mentorId, pricingModelId, estimatedDuration } = params

    // Get pricing model
    const pricingModel = await prisma.pricingModel.findFirst({
      where: {
        id: pricingModelId,
        mentorId,
        type: 'HOURLY',
        isActive: true,
      },
    })

    if (!pricingModel) {
      return { valid: false, error: 'Hourly pricing model not found' }
    }

    // Validate minimum duration (15 minutes)
    if (estimatedDuration && estimatedDuration < 15) {
      return { valid: false, error: 'Minimum session duration is 15 minutes' }
    }

    // Validate maximum duration (8 hours)
    if (estimatedDuration && estimatedDuration > 480) {
      return { valid: false, error: 'Maximum session duration is 8 hours' }
    }

    return { valid: true }
  }

  calculateAmount(params: {
    pricingModel: { price: number }
    duration: number // in minutes
  }) {
    const { pricingModel, duration } = params
    const hours = Math.ceil(duration / 60) // Round up to nearest hour
    return pricingModel.price * hours
  }

  async processPayment(params: {
    sessionId: string
    userId: string
    amount: number
    paymentMethod: string
    estimatedDuration: number
  }) {
    const { sessionId, userId, amount, paymentMethod, estimatedDuration } = params

    // For hourly sessions, we process an initial payment based on estimated duration
    // Final payment adjustment happens after session completion
    const paymentData: PaymentData = {
      sessionId,
      amount,
      paymentMethod,
      userId,
    }

    const result = await processPayment(paymentData)

    // Create usage tracking record
    await this.createUsageTracking({
      sessionId,
      estimatedDuration,
      estimatedAmount: amount,
      transactionId: result.transaction?.id,
    })

    // Log hourly session payment
    await logPaymentAction({
      userId,
      action: 'PAYMENT_COMPLETED',
      transactionId: result.transaction?.id,
      amount,
      details: {
        pricingType: 'HOURLY',
        sessionId,
        paymentMethod,
        estimatedDuration,
      },
    })

    return result
  }

  async handleUsageTracking(params: {
    sessionId: string
    actualDuration: number
    userId: string
  }) {
    const { sessionId, actualDuration, userId } = params

    try {
      // Get session and original transaction
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          transaction: true,
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

      if (!session || !session.transaction) {
        throw new Error('Session or transaction not found')
      }

      // Get the hourly pricing model
      const pricingModel = session.mentor.mentorProfile?.pricingModels.find(
        (pm: any) => pm.type === 'HOURLY' && pm.isActive
      )

      if (!pricingModel) {
        throw new Error('Hourly pricing model not found')
      }

      // Calculate actual amount based on actual duration
      const actualAmount = this.calculateAmount({
        pricingModel: { price: pricingModel.price },
        duration: actualDuration,
      })

      const originalAmount = session.transaction.amount
      const difference = actualAmount - originalAmount

      // Update session with actual duration
      await prisma.session.update({
        where: { id: sessionId },
        data: { actualDuration },
      })

      // Handle payment adjustment if needed
      if (Math.abs(difference) > 0.01) {
        if (difference > 0) {
          // Additional payment required
          await this.processAdditionalPayment({
            sessionId,
            userId,
            additionalAmount: difference,
            originalTransactionId: session.transaction.id,
          })
        } else {
          // Refund excess payment
          await this.processRefund({
            sessionId,
            userId,
            refundAmount: Math.abs(difference),
            originalTransactionId: session.transaction.id,
          })
        }
      }

      // Log usage tracking completion
      await logPaymentAction({
        userId,
        action: 'PAYMENT_COMPLETED',
        details: {
          pricingType: 'HOURLY_USAGE_TRACKED',
          sessionId,
          actualDuration,
          actualAmount,
          originalAmount,
          adjustment: difference,
        },
      })

    } catch (error) {
      console.error('Usage tracking error:', error)
      throw error
    }
  }

  private async createUsageTracking(params: {
    sessionId: string
    estimatedDuration: number
    estimatedAmount: number
    transactionId?: string
  }) {
    const { sessionId, estimatedDuration, estimatedAmount, transactionId } = params

    await createAuditLog({
      action: 'HOURLY_USAGE_TRACKING_CREATED',
      resource: 'session',
      details: {
        sessionId,
        transactionId,
        estimatedDuration,
        estimatedAmount,
        status: 'pending',
      },
    })
  }

  private async processAdditionalPayment(params: {
    sessionId: string
    userId: string
    additionalAmount: number
    originalTransactionId: string
  }) {
    const { sessionId, userId, additionalAmount, originalTransactionId } = params

    // Create additional transaction for the difference
    const additionalTransaction = await prisma.transaction.create({
      data: {
        sessionId,
        amount: additionalAmount,
        platformFee: additionalAmount * 0.15, // Platform fee
        mentorEarnings: additionalAmount * 0.85,
        status: 'COMPLETED',
        paymentMethod: 'hourly_adjustment',
        completedAt: new Date(),
      },
    })

    await logPaymentAction({
      userId,
      action: 'PAYMENT_COMPLETED',
      transactionId: additionalTransaction.id,
      amount: additionalAmount,
      details: {
        type: 'hourly_additional_payment',
        originalTransactionId,
        sessionId,
      },
    })
  }

  private async processRefund(params: {
    sessionId: string
    userId: string
    refundAmount: number
    originalTransactionId: string
  }) {
    const { sessionId, userId, refundAmount, originalTransactionId } = params

    // Create refund transaction
    const refundTransaction = await prisma.transaction.create({
      data: {
        sessionId,
        amount: -refundAmount, // Negative amount for refund
        platformFee: 0,
        mentorEarnings: -refundAmount,
        status: 'COMPLETED',
        paymentMethod: 'hourly_refund',
        completedAt: new Date(),
      },
    })

    await logPaymentAction({
      userId,
      action: 'PAYMENT_COMPLETED',
      transactionId: refundTransaction.id,
      amount: refundAmount,
      details: {
        type: 'hourly_refund',
        originalTransactionId,
        sessionId,
      },
    })
  }
}

// Monthly subscription pricing model
export class MonthlySubscriptionHandler implements PricingModelHandler {
  async validateBooking(params: {
    mentorId: string
    menteeId: string
    pricingModelId: string
  }) {
    const { mentorId, menteeId, pricingModelId } = params

    // Get pricing model
    const pricingModel = await prisma.pricingModel.findFirst({
      where: {
        id: pricingModelId,
        mentorId,
        type: 'MONTHLY_SUBSCRIPTION',
        isActive: true,
      },
    })

    if (!pricingModel) {
      return { valid: false, error: 'Monthly subscription pricing model not found' }
    }

    // Check if mentee already has an active subscription with this mentor
    const existingSubscription = await this.getActiveSubscription(menteeId, mentorId)
    
    if (existingSubscription) {
      return { valid: false, error: 'You already have an active subscription with this mentor' }
    }

    return { valid: true }
  }

  calculateAmount(params: {
    pricingModel: { price: number }
  }) {
    const { pricingModel } = params
    return pricingModel.price // Monthly subscription price
  }

  async processPayment(params: {
    sessionId: string
    userId: string
    amount: number
    paymentMethod: string
    mentorId: string
  }) {
    const { sessionId, userId, amount, paymentMethod, mentorId } = params

    // Process subscription payment
    const paymentData: PaymentData = {
      sessionId,
      amount,
      paymentMethod,
      userId,
    }

    const result = await processPayment(paymentData)

    // Create subscription record
    await this.createSubscription({
      menteeId: userId,
      mentorId,
      transactionId: result.transaction?.id,
      amount,
    })

    // Log subscription payment
    await logPaymentAction({
      userId,
      action: 'PAYMENT_COMPLETED',
      transactionId: result.transaction?.id,
      amount,
      details: {
        pricingType: 'MONTHLY_SUBSCRIPTION',
        sessionId,
        paymentMethod,
        mentorId,
      },
    })

    return result
  }

  private async createSubscription(params: {
    menteeId: string
    mentorId: string
    transactionId?: string
    amount: number
  }) {
    const { menteeId, mentorId, transactionId, amount } = params

    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1) // Add one month

    // Create subscription record in audit log (in a real system, would have a dedicated subscriptions table)
    await createAuditLog({
      userId: menteeId,
      action: 'SUBSCRIPTION_CREATED',
      resource: 'subscription',
      details: {
        mentorId,
        transactionId,
        amount,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: 'active',
      },
    })
  }

  private async getActiveSubscription(menteeId: string, mentorId: string) {
    // Check for active subscription in audit logs
    const subscription = await prisma.auditLog.findFirst({
      where: {
        userId: menteeId,
        action: 'SUBSCRIPTION_CREATED',
        resource: 'subscription',
        details: {
          path: ['mentorId'],
          equals: mentorId,
        },
        createdAt: {
          gte: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // Last 31 days
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!subscription || !subscription.details) return null

    const details = subscription.details as any
    const endDate = new Date(details.endDate)
    
    // Check if subscription is still active
    return endDate > new Date() ? subscription : null
  }

  async handleSubscriptionRenewal(params: {
    menteeId: string
    mentorId: string
    paymentMethod: string
  }) {
    const { menteeId, mentorId, paymentMethod } = params

    try {
      // Get current subscription
      const currentSubscription = await this.getActiveSubscription(menteeId, mentorId)
      
      if (!currentSubscription) {
        throw new Error('No active subscription found for renewal')
      }

      // Get pricing model
      const pricingModel = await prisma.pricingModel.findFirst({
        where: {
          mentorId,
          type: 'MONTHLY_SUBSCRIPTION',
          isActive: true,
        },
      })

      if (!pricingModel) {
        throw new Error('Subscription pricing model not found')
      }

      // Create renewal session (virtual session for subscription)
      const renewalSession = await prisma.session.create({
        data: {
          mentorId,
          menteeId,
          startTime: new Date(),
          scheduledEnd: new Date(Date.now() + 60 * 60 * 1000), // 1 hour placeholder
          status: 'COMPLETED',
          pricingType: 'MONTHLY_SUBSCRIPTION',
          agreedPrice: pricingModel.price,
        },
      })

      // Process renewal payment
      const result = await this.processPayment({
        sessionId: renewalSession.id,
        userId: menteeId,
        amount: pricingModel.price,
        paymentMethod,
        mentorId,
      })

      return result

    } catch (error) {
      console.error('Subscription renewal error:', error)
      throw error
    }
  }
}

// Factory function to get the appropriate pricing model handler
export function getPricingModelHandler(pricingType: string): PricingModelHandler {
  switch (pricingType) {
    case 'ONE_TIME':
      return new OneTimeSessionHandler()
    case 'HOURLY':
      return new HourlySessionHandler()
    case 'MONTHLY_SUBSCRIPTION':
      return new MonthlySubscriptionHandler()
    default:
      throw new Error(`Unsupported pricing model: ${pricingType}`)
  }
}

// Unified booking function that uses the appropriate handler
export async function processBookingPayment(params: {
  pricingType: string
  sessionId: string
  userId: string
  mentorId: string
  pricingModelId: string
  paymentMethod: string
  startTime?: Date
  endTime?: Date
  estimatedDuration?: number
}) {
  const handler = getPricingModelHandler(params.pricingType)
  
  // Get pricing model details
  const pricingModel = await prisma.pricingModel.findUnique({
    where: { id: params.pricingModelId },
  })

  if (!pricingModel) {
    throw new Error('Pricing model not found')
  }

  // Calculate amount based on pricing type
  let amount: number
  
  switch (params.pricingType) {
    case 'ONE_TIME':
      amount = handler.calculateAmount({ pricingModel })
      break
    case 'HOURLY':
      if (!params.estimatedDuration) {
        throw new Error('Estimated duration required for hourly sessions')
      }
      amount = handler.calculateAmount({ 
        pricingModel, 
        duration: params.estimatedDuration 
      })
      break
    case 'MONTHLY_SUBSCRIPTION':
      amount = handler.calculateAmount({ pricingModel })
      break
    default:
      throw new Error(`Unsupported pricing type: ${params.pricingType}`)
  }

  // Process payment using the specific handler
  return await handler.processPayment({
    sessionId: params.sessionId,
    userId: params.userId,
    amount,
    paymentMethod: params.paymentMethod,
    mentorId: params.mentorId,
    estimatedDuration: params.estimatedDuration,
  })
}