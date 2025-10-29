import { prisma } from './db'
import { razorpayService } from './razorpay-service'

export class PaymentService {
  async createPaymentOrder(sessionId: string, userId: string) {
    // Find session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentee: true,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (session.menteeId !== userId) {
      throw new Error('Unauthorized')
    }

    // Create Razorpay order
    const order = await razorpayService.createOrder({
      amount: session.agreedPrice,
      currency: 'INR',
      receipt: `session_${sessionId}`,
      sessionId: sessionId,
      userId: userId,
      description: `Payment for session ${sessionId}`,
    })

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        sessionId,
        orderId: order.id,
        amount: session.agreedPrice,
        currency: 'INR',
        platformFee: session.agreedPrice * 0.1, // 10% platform fee
        mentorEarnings: session.agreedPrice * 0.9, // 90% to mentor
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

  async verifyPayment(paymentData: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) {
    // Verify payment signature
    const isValid = razorpayService.verifyPaymentSignature(paymentData)
    
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

  async processRefund(transactionId: string, reason: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction) {
      throw new Error('Transaction not found')
    }

    if (transaction.status !== 'COMPLETED') {
      throw new Error('Transaction cannot be refunded')
    }

    if (!transaction.paymentId) {
      throw new Error('Payment ID not found')
    }

    // Process refund with Razorpay
    const refund = await razorpayService.createRefund(transaction.paymentId, transaction.amount, { reason })

    // Update transaction status
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'REFUNDED',
        refundId: refund.id,
        refundedAt: new Date(),
      },
    })

    return { success: true, refundId: refund.id }
  }

  async getTransactionHistory(userId: string) {
    return prisma.transaction.findMany({
      where: {
        session: {
          OR: [
            { menteeId: userId },
            { mentorId: userId },
          ],
        },
      },
      include: {
        session: {
          include: {
            mentor: true,
            mentee: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getEarnings(mentorId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      session: { mentorId },
      status: 'COMPLETED',
    }

    if (startDate || endDate) {
      where.completedAt = {}
      if (startDate) where.completedAt.gte = startDate
      if (endDate) where.completedAt.lte = endDate
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        session: {
          include: {
            mentee: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    })

    const totalEarnings = transactions.reduce((sum, t) => sum + t.amount, 0)
    const platformFee = totalEarnings * 0.1 // 10% platform fee
    const netEarnings = totalEarnings - platformFee

    return {
      totalEarnings,
      platformFee,
      netEarnings,
      transactionCount: transactions.length,
      transactions,
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService()