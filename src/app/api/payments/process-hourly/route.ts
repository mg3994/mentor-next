import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paymentModelsService } from '@/lib/payment-models-service'
import { z } from 'zod'

const processHourlySchema = z.object({
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }),
  pricingModelId: z.string().cuid2({ message: 'Invalid pricing model ID' }),
  hourlyRate: z.number().min(0.01, 'Hourly rate must be greater than 0'),
  estimatedHours: z.number().min(0.25, 'Minimum 15 minutes').max(8, 'Maximum 8 hours'),
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
    const validatedFields = processHourlySchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid payment data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, pricingModelId, hourlyRate, estimatedHours, mentorId } = validatedFields.data

    // Process hourly payment
    const result = await paymentModelsService.processHourlyPayment({
      sessionId,
      userId: session.user.id,
      mentorId,
      hourlyRate,
      estimatedHours,
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
      usageTracking: result.usageTracking,
      message: 'Hourly payment processed successfully',
    })

  } catch (error) {
    console.error('Process hourly payment error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Hourly payment processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Complete hourly session
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
    const { sessionId, actualMinutes } = body

    if (!sessionId || !actualMinutes || actualMinutes < 1) {
      return NextResponse.json(
        { error: 'Invalid session completion data' },
        { status: 400 }
      )
    }

    // Complete hourly session
    const result = await paymentModelsService.completeHourlySession(sessionId, actualMinutes)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      usageTracking: result.usageTracking,
      message: 'Hourly session completed successfully',
    })

  } catch (error) {
    console.error('Complete hourly session error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Session completion failed',
        success: false,
      },
      { status: 500 }
    )
  }
}