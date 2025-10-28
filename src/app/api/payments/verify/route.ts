import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyPayment, processPayment } from '@/lib/payment-utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  gatewayTransactionId: z.string().min(1, 'Gateway transaction ID is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = verifyPaymentSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid verification data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { orderId, gatewayTransactionId, paymentMethod } = validatedFields.data

    // Verify payment with gateway
    const verificationResult = await verifyPayment(orderId, gatewayTransactionId)
    
    if (!verificationResult.success) {
      return NextResponse.json(
        { 
          error: verificationResult.error || 'Payment verification failed',
          success: false,
        },
        { status: 400 }
      )
    }

    // Extract session ID from order (in real system, would fetch from payment gateway)
    // For demo, we'll extract from audit logs
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

    if (!orderLog || !orderLog.details || typeof orderLog.details !== 'object') {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const sessionId = (orderLog.details as any).sessionId
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Invalid order data' },
        { status: 400 }
      )
    }

    // Process the payment
    const paymentResult = await processPayment({
      sessionId,
      amount: verificationResult.amount || 0,
      paymentMethod,
      userId: session.user.id,
    })

    return NextResponse.json({
      success: true,
      transaction: paymentResult.transaction,
      message: 'Payment verified and processed successfully',
      orderId,
      gatewayTransactionId,
    })

  } catch (error) {
    console.error('Payment verification error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Payment verification failed',
        success: false,
      },
      { status: 500 }
    )
  }
}