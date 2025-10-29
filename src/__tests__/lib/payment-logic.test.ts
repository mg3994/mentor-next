import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock payment service
const mockCreateOrder = jest.fn()
const mockVerifyPayment = jest.fn()
const mockProcessRefund = jest.fn()

jest.mock('@/lib/razorpay-service', () => ({
    createOrder: mockCreateOrder,
    verifyPayment: mockVerifyPayment,
    processRefund: mockProcessRefund,
}))

// Mock database
const mockPrisma = {
    transaction: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
    },
    session: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
}

jest.mock('@/lib/db', () => ({
    prisma: mockPrisma,
}))

// Payment logic functions to test
const createPaymentOrderLogic = async (sessionId: string, userId: string) => {
    const { prisma } = require('@/lib/db')
    const { createOrder } = require('@/lib/razorpay-service')
    
    // Find session
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
            pricingModel: true,
            mentee: { include: { user: true } },
        },
    })

    if (!session) {
        throw new Error('Session not found')
    }

    if (session.menteeId !== userId) {
        throw new Error('Unauthorized')
    }

    // Create Razorpay order
    const order = await createOrder({
        amount: session.pricingModel.price,
        currency: 'INR',
        receipt: `session_${sessionId}`,
    })

    // Create transaction record
    const transaction = await prisma.transaction.create({
        data: {
            sessionId,
            orderId: order.id,
            amount: session.pricingModel.price,
            currency: 'INR',
            status: 'PENDING',
        },
    })

    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        transactionId: transaction.id,
    }
}

const verifyPaymentLogic = async (paymentData: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
}) => {
    const { prisma } = require('@/lib/db')
    const { verifyPayment } = require('@/lib/razorpay-service')
    
    // Verify payment signature
    const isValid = verifyPayment(paymentData)
    
    if (!isValid) {
        return { success: false, error: 'Payment verification failed' }
    }

    // Find transaction
    const transaction = await prisma.transaction.findUnique({
        where: { orderId: paymentData.razorpay_order_id },
        include: { session: true },
    })

    if (!transaction) {
        return { success: false, error: 'Transaction not found' }
    }

    // Update transaction status
    await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
            status: 'COMPLETED',
            paymentId: paymentData.razorpay_payment_id,
            completedAt: new Date(),
        },
    })

    return {
        success: true,
        transactionId: transaction.id,
        sessionId: transaction.sessionId,
    }
}

describe('Payment Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('createPaymentOrderLogic', () => {
        it('should create payment order successfully', async () => {
            const mockSession = {
                id: 'session123',
                menteeId: 'user123',
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

            const mockTransaction = {
                id: 'txn123',
                orderId: 'order_123',
            }

            mockPrisma.session.findUnique.mockResolvedValue(mockSession)
            mockCreateOrder.mockResolvedValue(mockOrder)
            mockPrisma.transaction.create.mockResolvedValue(mockTransaction)

            const result = await createPaymentOrderLogic('session123', 'user123')

            expect(result).toEqual({
                orderId: 'order_123',
                amount: 2500,
                currency: 'INR',
                transactionId: 'txn123',
            })
            expect(mockCreateOrder).toHaveBeenCalledWith({
                amount: 2500,
                currency: 'INR',
                receipt: 'session_session123',
            })
        })

        it('should throw error for invalid session', async () => {
            mockPrisma.session.findUnique.mockResolvedValue(null)

            await expect(
                createPaymentOrderLogic('invalid_session', 'user123')
            ).rejects.toThrow('Session not found')
        })

        it('should throw error for unauthorized user', async () => {
            const mockSession = {
                id: 'session123',
                menteeId: 'different_user',
                pricingModel: { price: 2500 },
            }

            mockPrisma.session.findUnique.mockResolvedValue(mockSession)

            await expect(
                createPaymentOrderLogic('session123', 'user123')
            ).rejects.toThrow('Unauthorized')
        })
    })

    describe('verifyPaymentLogic', () => {
        it('should verify and process successful payment', async () => {
            const paymentData = {
                razorpay_order_id: 'order_123',
                razorpay_payment_id: 'pay_123',
                razorpay_signature: 'signature_123',
            }

            const mockTransaction = {
                id: 'txn123',
                orderId: 'order_123',
                sessionId: 'session123',
                status: 'PENDING',
            }

            mockVerifyPayment.mockReturnValue(true)
            mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction)
            mockPrisma.transaction.update.mockResolvedValue({
                ...mockTransaction,
                status: 'COMPLETED',
            })

            const result = await verifyPaymentLogic(paymentData)

            expect(result.success).toBe(true)
            expect(result.transactionId).toBe('txn123')
            expect(result.sessionId).toBe('session123')
            expect(mockVerifyPayment).toHaveBeenCalledWith(paymentData)
            expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
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

            mockVerifyPayment.mockReturnValue(false)

            const result = await verifyPaymentLogic(paymentData)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Payment verification failed')
        })

        it('should handle missing transaction', async () => {
            const paymentData = {
                razorpay_order_id: 'order_123',
                razorpay_payment_id: 'pay_123',
                razorpay_signature: 'signature_123',
            }

            mockVerifyPayment.mockReturnValue(true)
            mockPrisma.transaction.findUnique.mockResolvedValue(null)

            const result = await verifyPaymentLogic(paymentData)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Transaction not found')
        })
    })
})