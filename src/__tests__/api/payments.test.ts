import { describe, it, expect, beforeEach } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import createOrderHandler from '@/app/api/payments/create-order/route'
import verifyHandler from '@/app/api/payments/verify/route'

// Mock payment service
jest.mock('@/lib/payment-service', () => ({
  PaymentService: jest.fn().mockImplementation(() => ({
    createPaymentOrder: jest.fn(),
    verifyPayment: jest.fn(),
  })),
}))

// Mock auth
jest.mock('@/lib/auth-utils', () => ({
  getServerSession: jest.fn(),
}))

describe('Payment API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/payments/create-order', () => {
    it('should create payment order successfully', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { PaymentService } = require('@/lib/payment-service')

      getServerSession.mockResolvedValue({
        user: { id: 'user123' },
      })

      const mockPaymentService = new PaymentService()
      mockPaymentService.createPaymentOrder.mockResolvedValue({
        orderId: 'order_123',
        amount: 2500,
        currency: 'INR',
        transactionId: 'txn123',
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          sessionId: 'session123',
        },
      })

      const response = await createOrderHandler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.orderId).toBe('order_123')
      expect(data.amount).toBe(2500)
      expect(mockPaymentService.createPaymentOrder).toHaveBeenCalledWith(
        'session123',
        'user123'
      )
    })

    it('should return error for unauthenticated user', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      
      getServerSession.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: {
          sessionId: 'session123',
        },
      })

      const response = await createOrderHandler.POST(req)

      expect(response.status).toBe(401)
    })

    it('should handle payment service errors', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { PaymentService } = require('@/lib/payment-service')

      getServerSession.mockResolvedValue({
        user: { id: 'user123' },
      })

      const mockPaymentService = new PaymentService()
      mockPaymentService.createPaymentOrder.mockRejectedValue(
        new Error('Session not found')
      )

      const { req } = createMocks({
        method: 'POST',
        body: {
          sessionId: 'invalid_session',
        },
      })

      const response = await createOrderHandler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Session not found')
    })
  })

  describe('POST /api/payments/verify', () => {
    it('should verify payment successfully', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { PaymentService } = require('@/lib/payment-service')

      getServerSession.mockResolvedValue({
        user: { id: 'user123' },
      })

      const mockPaymentService = new PaymentService()
      mockPaymentService.verifyPayment.mockResolvedValue({
        success: true,
        transactionId: 'txn123',
        sessionId: 'session123',
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'signature_123',
        },
      })

      const response = await verifyHandler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.transactionId).toBe('txn123')
    })

    it('should handle payment verification failure', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { PaymentService } = require('@/lib/payment-service')

      getServerSession.mockResolvedValue({
        user: { id: 'user123' },
      })

      const mockPaymentService = new PaymentService()
      mockPaymentService.verifyPayment.mockResolvedValue({
        success: false,
        error: 'Payment verification failed',
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'invalid_signature',
        },
      })

      const response = await verifyHandler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Payment verification failed')
    })

    it('should validate required payment fields', async () => {
      const { getServerSession } = require('@/lib/auth-utils')

      getServerSession.mockResolvedValue({
        user: { id: 'user123' },
      })

      const { req } = createMocks({
        method: 'POST',
        body: {
          razorpay_order_id: 'order_123',
          // Missing payment_id and signature
        },
      })

      const response = await verifyHandler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })
  })
})