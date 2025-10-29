import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paymentModelsService } from '@/lib/payment-models-service'
import { z } from 'zod'

const processOneTimeSchema = z.object({
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }),
  pricingModelId: z.string().cuid2({ message: 'Invalid pricing model ID' }),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  mentorId: z.string().cuid2({ message: 'Invalid mentor ID' }),
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
    const validatedFields = processOneTimeSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid payment data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, pricingModelId, amount, mentorId } = validatedFields.data

    // Process one-time payment
    const result = await paymentModelsService.processOneTimePayment({
      sessionId,
      userId: session.user.id,
      mentorId,
      amount,
      pricingModelId,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      message: 'One-time payment processed successfully',
    })

  } catch (error) {
    console.error('Process one-time payment error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Payment processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}