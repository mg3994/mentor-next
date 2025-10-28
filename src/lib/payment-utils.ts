import { prisma } from './db'
import { PLATFORM_FEE_PERCENTAGE } from './constants'
import { createAuditLog } from './db-utils'

// Type definitions for enums
type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
type PricingType = 'ONE_TIME' | 'HOURLY' | 'MONTHLY_SUBSCRIPTION'

// Enum constants
const TransactionStatus = {
  PENDING: 'PENDING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  REFUNDED: 'REFUNDED' as const,
}

const PricingType = {
  ONE_TIME: 'ONE_TIME' as const,
  HOURLY: 'HOURLY' as const,
  MONTHLY_SUBSCRIPTION: 'MONTHLY_SUBSCRIPTION' as const,
}

export interface PaymentData {
  sessionId: string
  amount: number
  paymentMethod: string
  userId: string
}

export interface PayoutData {
  mentorId: string
  amount: number
  transactionIds: string[]
}

// Simplified payment processing (no external gateway)
export async function processPayment(paymentData: PaymentData) {
  const { sessionId, amount, paymentMethod, userId } = paymentData

  try {
    // Get session details
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: true,
        mentee: true,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    // Calculate fees
    const platformFee = amount * PLATFORM_FEE_PERCENTAGE
    const mentorEarnings = amount - platformFee

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        sessionId,
        amount,
        platformFee,
        mentorEarnings,
        status: TransactionStatus.PENDING,
        paymentMethod,
      },
    })

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // For demo purposes, randomly succeed or fail (90% success rate)
    const paymentSuccess = Math.random() > 0.1

    if (paymentSuccess) {
      // Update transaction status
      const completedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          completedAt: new Date(),
        },
      })

      // Create audit log
      await createAuditLog({
        userId,
        action: 'PAYMENT_COMPLETED',
        resource: 'TRANSACTION',
        details: {
          transactionId: transaction.id,
          sessionId,
          amount,
          paymentMethod,
        },
      })

      return {
        success: true,
        transaction: completedTransaction,
        message: 'Payment processed successfully',
      }
    } else {
      // Update transaction status to failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
        },
      })

      // Create audit log
      await createAuditLog({
        userId,
        action: 'PAYMENT_FAILED',
        resource: 'TRANSACTION',
        details: {
          transactionId: transaction.id,
          sessionId,
          amount,
          paymentMethod,
          reason: 'Simulated payment failure',
        },
      })

      throw new Error('Payment processing failed')
    }
  } catch (error) {
    console.error('Payment processing error:', error)
    throw error
  }
}

// Process mentor payout
export async function processMentorPayout(payoutData: PayoutData) {
  const { mentorId, amount, transactionIds } = payoutData

  try {
    // Verify mentor exists
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: {
        mentorProfile: true,
      },
    })

    if (!mentor || !mentor.mentorProfile) {
      throw new Error('Mentor not found')
    }

    // Verify all transactions belong to this mentor and are completed
    const transactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        session: {
          mentorId,
        },
        status: TransactionStatus.COMPLETED,
      },
    })

    if (transactions.length !== transactionIds.length) {
      throw new Error('Invalid transactions for payout')
    }

    // Calculate total payout amount
    const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)

    if (Math.abs(totalEarnings - amount) > 0.01) {
      throw new Error('Payout amount mismatch')
    }

    // Create payout record (simplified - in real system would integrate with banking)
    const payout = await prisma.mentorPayout.create({
      data: {
        mentorId,
        amount,
        transactionIds,
        status: 'COMPLETED',
        processedAt: new Date(),
        payoutMethod: 'platform_credit', // Simplified
      },
    })

    // Create audit log
    await createAuditLog({
      userId: mentorId,
      action: 'PAYOUT_PROCESSED',
      resource: 'PAYOUT',
      details: {
        payoutId: payout.id,
        amount,
        transactionCount: transactionIds.length,
      },
    })

    return {
      success: true,
      payout,
      message: 'Payout processed successfully',
    }
  } catch (error) {
    console.error('Payout processing error:', error)
    throw error
  }
}

// Get mentor earnings summary
export async function getMentorEarnings(mentorId: string) {
  try {
    // Get completed transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        session: {
          mentorId,
        },
        status: TransactionStatus.COMPLETED,
      },
      include: {
        session: {
          select: {
            id: true,
            startTime: true,
            pricingType: true,
            mentee: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
    })

    // Get processed payouts
    const payouts = await prisma.mentorPayout.findMany({
      where: { mentorId },
      orderBy: {
        processedAt: 'desc',
      },
    })

    // Calculate totals
    const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
    const totalPayouts = payouts.reduce((sum: number, p: any) => sum + p.amount, 0)
    const pendingEarnings = totalEarnings - totalPayouts

    // Get this month's earnings
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthlyTransactions = transactions.filter(
      (t: any) => t.completedAt && t.completedAt >= startOfMonth
    )
    const monthlyEarnings = monthlyTransactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)

    return {
      totalEarnings,
      totalPayouts,
      pendingEarnings,
      monthlyEarnings,
      transactionCount: transactions.length,
      transactions: transactions.slice(0, 10), // Recent 10 transactions
      payouts: payouts.slice(0, 5), // Recent 5 payouts
    }
  } catch (error) {
    console.error('Get mentor earnings error:', error)
    throw error
  }
}

// Process refund for cancelled session
export async function processRefund(sessionId: string, userId: string) {
  try {
    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: {
            mentor: true,
            mentee: true,
          },
        },
      },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new Error('Cannot refund non-completed transaction')
    }

    // Update transaction status
    const refundedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TransactionStatus.REFUNDED,
      },
    })

    // Create audit log
    await createAuditLog({
      userId,
      action: 'REFUND_PROCESSED',
      resource: 'TRANSACTION',
      details: {
        transactionId: transaction.id,
        sessionId,
        amount: transaction.amount,
        reason: 'Session cancelled',
      },
    })

    return {
      success: true,
      transaction: refundedTransaction,
      message: 'Refund processed successfully',
    }
  } catch (error) {
    console.error('Refund processing error:', error)
    throw error
  }
}

// Enhanced payment gateway simulation
export interface PaymentGatewayConfig {
  name: string
  enabled: boolean
  supportedMethods: string[]
  processingFee: number
  currency: string
}

export const PAYMENT_GATEWAY_CONFIG: PaymentGatewayConfig = {
  name: 'Internal Payment System',
  enabled: true,
  supportedMethods: ['card', 'upi', 'wallet', 'bank_transfer'],
  processingFee: 0.029, // 2.9% processing fee
  currency: 'USD',
}

// Enhanced payment methods with more realistic options
export function getAvailablePaymentMethods() {
  return [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      description: 'Visa, Mastercard, American Express',
      icon: '💳',
      processingFee: 0.029,
      enabled: true,
    },
    {
      id: 'upi',
      name: 'UPI Payment',
      description: 'Pay using UPI ID or QR code',
      icon: '📱',
      processingFee: 0.0,
      enabled: true,
    },
    {
      id: 'wallet',
      name: 'Digital Wallet',
      description: 'PayPal, Google Pay, Apple Pay',
      icon: '👛',
      processingFee: 0.025,
      enabled: true,
    },
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      description: 'Direct bank account transfer',
      icon: '🏦',
      processingFee: 0.01,
      enabled: true,
    },
    {
      id: 'platform_credit',
      name: 'Platform Credit',
      description: 'Use your platform credit balance',
      icon: '⭐',
      processingFee: 0.0,
      enabled: true,
    },
  ].filter(method => method.enabled)
}

// Payment gateway webhook simulation
export interface WebhookPayload {
  eventType: 'payment.success' | 'payment.failed' | 'payment.pending'
  transactionId: string
  gatewayTransactionId: string
  amount: number
  currency: string
  paymentMethod: string
  timestamp: string
  signature: string
}

export function generateWebhookSignature(payload: Omit<WebhookPayload, 'signature'>): string {
  // Simulate webhook signature generation (in real system would use HMAC)
  const data = JSON.stringify(payload)
  return Buffer.from(data).toString('base64').substring(0, 32)
}

export function verifyWebhookSignature(payload: WebhookPayload): boolean {
  // Simulate webhook signature verification
  const { signature, ...data } = payload
  const expectedSignature = generateWebhookSignature(data)
  return signature === expectedSignature
}

// Enhanced payment order creation
export interface PaymentOrder {
  orderId: string
  amount: number
  currency: string
  description: string
  customerInfo: {
    userId: string
    name: string
    email: string
  }
  metadata: {
    sessionId: string
    mentorId: string
    pricingType: string
  }
  expiresAt: Date
}

export async function createPaymentOrder(orderData: Omit<PaymentOrder, 'orderId' | 'expiresAt'>): Promise<PaymentOrder> {
  // Generate unique order ID
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  
  // Set expiration (15 minutes from now)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  
  const order: PaymentOrder = {
    ...orderData,
    orderId,
    expiresAt,
  }
  
  // In a real system, this would be stored in the payment gateway
  // For now, we'll store it in our database for tracking
  await prisma.auditLog.create({
    data: {
      action: 'PAYMENT_ORDER_CREATED',
      resource: 'payment_order',
      details: {
        orderId,
        amount: order.amount,
        sessionId: order.metadata.sessionId,
        expiresAt: order.expiresAt.toISOString(),
      },
    },
  })
  
  return order
}

// Payment verification simulation
export async function verifyPayment(orderId: string, gatewayTransactionId: string): Promise<{
  success: boolean
  transactionId?: string
  amount?: number
  paymentMethod?: string
  error?: string
}> {
  try {
    // Simulate payment gateway verification API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // For demo purposes, simulate different outcomes based on transaction ID
    const lastDigit = gatewayTransactionId.slice(-1)
    const isSuccess = parseInt(lastDigit) < 9 // 90% success rate
    
    if (isSuccess) {
      return {
        success: true,
        transactionId: gatewayTransactionId,
        amount: Math.floor(Math.random() * 1000) + 50, // Random amount for demo
        paymentMethod: 'card',
      }
    } else {
      return {
        success: false,
        error: 'Payment verification failed',
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification error',
    }
  }
}

// Validate payment method
export function validatePaymentMethod(paymentMethod: string): boolean {
  const availableMethods = getAvailablePaymentMethods()
  return availableMethods.some(method => method.id === paymentMethod)
}

// Calculate pricing for different models
export function calculateSessionPrice(
  pricingType: PricingType,
  basePrice: number,
  duration?: number
): number {
  switch (pricingType) {
    case PricingType.ONE_TIME:
      return basePrice
    case PricingType.HOURLY:
      const hours = duration ? duration / 60 : 1
      return basePrice * hours
    case PricingType.MONTHLY_SUBSCRIPTION:
      return basePrice
    default:
      return basePrice
  }
}

// Generate payment receipt data
export async function generatePaymentReceipt(transactionId: string) {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        session: {
          include: {
            mentor: {
              select: {
                name: true,
                email: true,
              },
            },
            mentee: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    return {
      transactionId: transaction.id,
      amount: transaction.amount,
      platformFee: transaction.platformFee,
      mentorEarnings: transaction.mentorEarnings,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
      session: {
        id: transaction.session.id,
        startTime: transaction.session.startTime,
        scheduledEnd: transaction.session.scheduledEnd,
        pricingType: transaction.session.pricingType,
        mentor: transaction.session.mentor,
        mentee: transaction.session.mentee,
      },
    }
  } catch (error) {
    console.error('Generate receipt error:', error)
    throw error
  }
}