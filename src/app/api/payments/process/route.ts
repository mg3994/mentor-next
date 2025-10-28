import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processPayment, validatePaymentMethod } from '@/lib/payment-utils'
import { z } from 'zod'

const paymentSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  paymentMethod: z.string().min(1),
  amount: z.number().min(0.01),
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
    const validatedFields = paymentSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid payment data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, paymentMethod, amount } = validatedFields.data

    // Validate payment method
    if (!validatePaymentMethod(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      )
    }

    // Process payment
    const result = await processPayment({
      sessionId,
      amount,
      paymentMethod,
      userId: session.user.id,
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Payment processing error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Payment processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}