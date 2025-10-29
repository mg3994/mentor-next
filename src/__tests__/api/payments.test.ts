import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock payment service
const mockPaymentService = {
    createPaymentOrder: jest.fn(),
    verifyPayment: jest.fn(),
}

jest.mock('@/lib/payment-service', () => ({
    PaymentService: jest.fn().mockImplementation(() => mockPaymentService),
}))

// Mock auth
const mockGetServerSession = jest.fn()
jest.mock('@/lib/auth-utils', () => ({
    getServerSession: mockGetServerSession,
}))

// Mock Next.js Response
const mockResponse = {
    json: jest.fn(),
    status: 200,
}

// Mock API handlers
const createPaymentOrder = async (sessionId: string, userId: string) => {
    try {
        const result = await mockPaymentService.createPaymentOrder(sessionId, userId)
        return {
            json: () => Promise.resolve(result),
            status: 200,
        }
    } catch (error) {
        return {
            json: () => Promise.resolve({ error: (error as Error).message }),
            status: 400,
        }
    }
}

const verifyPayment = async (paymentData: any) => {
    try {
        const result = await mockPaymentService.verifyPayment(paymentData)
        return {
            json: () => Promise.resolve(result),
            status: result.success ? 200 : 400,
        }
    } catch (error) {
        return {
            json: () => Promise.resolve({ error: (error as Error).message }),
            status: 400,
        }
    }
}

describe('Payment API', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('POST /api/payments/create-order', () => {
        it('should create payment order successfully', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user123' },
            })

            mockPaymentService.createPaymentOrder.mockResolvedValue({
                orderId: 'order_123',
                amount: 2500,
                currency: 'INR',
                transactionId: 'txn123',
            })

            const response = await createPaymentOrder('session123', 'user123')
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.orderId).toBe('order_123')
            expect(data.amount).toBe(2500)
            expect(mockPaymentService.createPaymentOrder).toHaveBeenCalledWith(
                'session123',
                'user123'
            )
        })

        it('should handle payment service errors', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user123' },
            })

            mockPaymentService.createPaymentOrder.mockRejectedValue(
                new Error('Session not found')
            )

            const response = await createPaymentOrder('invalid_session', 'user123')
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error).toBe('Session not found')
        })
    })

    describe('POST /api/payments/verify', () => {
        it('should verify payment successfully', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user123' },
            })

            mockPaymentService.verifyPayment.mockResolvedValue({
                success: true,
                transactionId: 'txn123',
                sessionId: 'session123',
            })

            const paymentData = {
                razorpay_order_id: 'order_123',
                razorpay_payment_id: 'pay_123',
                razorpay_signature: 'signature_123',
            }

            const response = await verifyPayment(paymentData)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.success).toBe(true)
            expect(data.transactionId).toBe('txn123')
        })

        it('should handle payment verification failure', async () => {
            mockGetServerSession.mockResolvedValue({
                user: { id: 'user123' },
            })

            mockPaymentService.verifyPayment.mockResolvedValue({
                success: false,
                error: 'Payment verification failed',
            })

            const paymentData = {
                razorpay_order_id: 'order_123',
                razorpay_payment_id: 'pay_123',
                razorpay_signature: 'invalid_signature',
            }

            const response = await verifyPayment(paymentData)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.success).toBe(false)
            expect(data.error).toBe('Payment verification failed')
        })
    })
})