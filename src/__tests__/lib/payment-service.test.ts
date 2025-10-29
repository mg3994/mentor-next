import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { PaymentService } from '@/lib/payment-service'

// Mock Razorpay
jest.mock('@/lib/razorpay-service', () => ({
  createOrder: jest.fn(),
  verifyPayment: jest.fn(),
  processRefund: jest.fn(),
}))

// Mock database
jest.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('PaymentService', () => {
  let paymentService: PaymentService
  
  beforeEach(() => {
    paymentService = new PaymentService()
    jest.clearAllMocks()
  })

  describe('createPaymentOrder', () => {
    it('should create a payment order for one-time session', async () => {
      const mockSession = {
        id: 'session123',
        pricingModel: {
          type: 'ONE_TIME',
          price: 2500,
        },
        mentee: {
          user: {
            email: 'mentee@example.com',
          },
        },
      }

      const mockOrder = {
        id: 'order_123',
        amount: 2500,
        currency: 'INR',
      }

      const { createOrder } = require('@/lib/razorpay-service')
      createOrder.mockResolvedValue(mockOrder)

      const { prisma } = require('@/lib/db')
      prisma.session.findUnique.mockResolvedValue(mockSession)
      prisma.transaction.create.mockResolvedValue({
        id: 'txn123',
        orderId: 'order_123',
      })

      const result = await paymentService.createPaymentOrder('session123', 'user123')

      expect(result).toEqual({
        orderId: 'order_123',
        amount: 2500,
        currency: 'INR',
        transactionId: 'txn123',
      })
      expect(createOrder).toHaveBeenCalledWith({
        amount: 2500,
        currency: 'INR',
        receipt: expect.stringContaining('session123'),
      })
    })

    it('should throw error for invalid session', async () => {
      const { prisma } = require('@/lib/db')
      prisma.session.findUnique.mockResolvedValue(null)

      await expect(
        paymentService.createPaymentOrder('invalid_session', 'user123')
      ).rejects.toThrow('Session not found')
    })
  })

  describe('verifyPayment', () => {
    it('should verify and process successful payment', async () => {
      const paymentData = {
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: 'signature_123',
      }

      const mockTransaction = {
        id: 'txn123',
        orderId: 'order_123',
        status: 'PENDING',
        session: {
          id: 'session123',
          mentorId: 'mentor123',
        },
      }

      const { verifyPayment } = require('@/lib/razorpay-service')
      verifyPayment.mockReturnValue(true)

      const { prisma } = require('@/lib/db')
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction)
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        status: 'COMPLETED',
      })

      const result = await paymentService.verifyPayment(paymentData)

      expect(result.success).toBe(true)
      expect(verifyPayment).toHaveBeenCalledWith(paymentData)
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn123' },
        data: {
          status: 'COMPLETED',
          paymentId: 'pay_123',
          completedAt: expect.any(Date),
        },
      })
    })

    it('should handle payment verification failure', async () => {
      const paymentData = {
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: 'invalid_signature',
      }

      const { verifyPayment } = require('@/lib/razorpay-service')
      verifyPayment.mockReturnValue(false)

      const result = await paymentService.verifyPayment(paymentData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Payment verification failed')
    })
  })

  describe('processRefund', () => {
    it('should process refund for completed transaction', async () => {
      const mockTransaction = {
        id: 'txn123',
        paymentId: 'pay_123',
        amount: 2500,
        status: 'COMPLETED',
      }

      const mockRefund = {
        id: 'rfnd_123',
        amount: 2500,
        status: 'processed',
      }

      const { processRefund } = require('@/lib/razorpay-service')
      processRefund.mockResolvedValue(mockRefund)

      const { prisma } = require('@/lib/db')
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction)
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        status: 'REFUNDED',
      })

      const result = await paymentService.processRefund('txn123', 'Session cancelled')

      expect(result.success).toBe(true)
      expect(processRefund).toHaveBeenCalledWith('pay_123', {
        amount: 2500,
        notes: { reason: 'Session cancelled' },
      })
    })

    it('should throw error for non-refundable transaction', async () => {
      const mockTransaction = {
        id: 'txn123',
        status: 'PENDING',
      }

      const { prisma } = require('@/lib/db')
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction)

      await expect(
        paymentService.processRefund('txn123', 'Test refund')
      ).rejects.toThrow('Transaction cannot be refunded')
    })
  })
})