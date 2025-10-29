import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { razorpayService } from '@/lib/razorpay-service'
import { convertFromRazorpayAmount } from '@/lib/razorpay-config'
import { createTransactionWithAudit } from '@/lib/db-utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Razorpay order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID is required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature is required'),
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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = validatedFields.data

    // Verify payment signature with Razorpay
    const isSignatureValid = razorpayService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    })
    
    if (!isSignatureValid) {
      return NextResponse.json(
        { 
          error: 'Invalid payment signature',
          success: false,
        },
        { status: 400 }
      )
    }

    // Get payment details from Razorpay
    const payment = await razorpayService.getPayment(razorpay_payment_id)
    const order = await razorpayService.getOrder(razorpay_order_id)

    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return NextResponse.json(
        { 
          error: 'Payment not successful',
          success: false,
        },
        { status: 400 }
      )
    }

    // Extract session ID from order notes
    const sessionId = order.notes.sessionId
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Invalid order data' },
        { status: 400 }
      )
    }

    // Get session details
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: true,
        mentee: true,
      },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user is the mentee for this session
    if (sessionData.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    // Calculate platform fee and mentor earnings
    const amount = convertFromRazorpayAmount(payment.amount)
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
        paymentMethod: payment.method,
      },
      session.user.id,
      {
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    )

    // Update session status to paid
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'SCHEDULED',
      },
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        amount,
        platformFee,
        mentorEarnings,
        status: transaction.status,
      },
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
      },
      message: 'Payment verified and processed successfully',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
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