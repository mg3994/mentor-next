import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paymentModelsService } from '@/lib/payment-models-service'
import { z } from 'zod'

const processSubscriptionSchema = z.object({
  mentorId: z.string().cuid2({ message: 'Invalid mentor ID' }),
  pricingModelId: z.string().cuid2({ message: 'Invalid pricing model ID' }),
  monthlyAmount: z.number().min(0.01, 'Monthly amount must be greater than 0'),
  startDate: z.string().datetime().optional(),
})

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().cuid2({ message: 'Invalid subscription ID' }),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
})

const renewSubscriptionSchema = z.object({
  subscriptionId: z.string().cuid2({ message: 'Invalid subscription ID' }),
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
    const validatedFields = processSubscriptionSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid subscription data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { mentorId, pricingModelId, monthlyAmount, startDate } = validatedFields.data

    // Process subscription payment
    const result = await paymentModelsService.processSubscriptionPayment({
      userId: session.user.id,
      mentorId,
      monthlyAmount,
      pricingModelId,
      startDate: startDate ? new Date(startDate) : undefined,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      transaction: result.transaction,
      nextPaymentDate: result.nextPaymentDate,
      message: 'Subscription created successfully',
    })

  } catch (error) {
    console.error('Process subscription payment error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Subscription processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Cancel subscription
export async function DELETE(request: NextRequest) {
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
    const validatedFields = cancelSubscriptionSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid cancellation data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { subscriptionId, reason } = validatedFields.data

    // Cancel subscription
    const result = await paymentModelsService.cancelSubscription(
      subscriptionId,
      session.user.id,
      reason
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      message: 'Subscription cancelled successfully',
    })

  } catch (error) {
    console.error('Cancel subscription error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Subscription cancellation failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Renew subscription
export async function PUT(request: NextRequest) {
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
    const validatedFields = renewSubscriptionSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid renewal data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { subscriptionId } = validatedFields.data

    // Renew subscription
    const result = await paymentModelsService.processSubscriptionRenewal(subscriptionId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      transaction: result.transaction,
      nextPaymentDate: result.nextPaymentDate,
      message: 'Subscription renewed successfully',
    })

  } catch (error) {
    console.error('Renew subscription error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Subscription renewal failed',
        success: false,
      },
      { status: 500 }
    )
  }
}