import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processBookingPayment, getPricingModelHandler } from '@/lib/pricing-models'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const bookingPaymentSchema = z.object({
  pricingType: z.enum(['ONE_TIME', 'HOURLY', 'MONTHLY_SUBSCRIPTION']),
  sessionId: z.string().min(1, 'Session ID is required'),
  mentorId: z.string().min(1, 'Mentor ID is required'),
  pricingModelId: z.string().min(1, 'Pricing model ID is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  estimatedDuration: z.number().min(15).max(480).optional(), // 15 minutes to 8 hours
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
    const validatedFields = bookingPaymentSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid booking data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { 
      pricingType, 
      sessionId, 
      mentorId, 
      pricingModelId, 
      paymentMethod,
      startTime,
      endTime,
      estimatedDuration 
    } = validatedFields.data

    // Verify session exists and user has access
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

    if (sessionData.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    if (sessionData.mentorId !== mentorId) {
      return NextResponse.json(
        { error: 'Mentor ID mismatch' },
        { status: 400 }
      )
    }

    // Validate booking based on pricing type
    const handler = getPricingModelHandler(pricingType)
    
    let validationParams: any = {
      mentorId,
      pricingModelId,
    }

    if (pricingType === 'ONE_TIME' && startTime && endTime) {
      validationParams.startTime = new Date(startTime)
      validationParams.endTime = new Date(endTime)
    } else if (pricingType === 'HOURLY') {
      validationParams.startTime = sessionData.startTime
      validationParams.estimatedDuration = estimatedDuration
    } else if (pricingType === 'MONTHLY_SUBSCRIPTION') {
      validationParams.menteeId = session.user.id
    }

    const validation = await handler.validateBooking(validationParams)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Process payment for the specific pricing model
    const result = await processBookingPayment({
      pricingType,
      sessionId,
      userId: session.user.id,
      mentorId,
      pricingModelId,
      paymentMethod,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      estimatedDuration,
    })

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      message: `${pricingType.toLowerCase().replace('_', ' ')} payment processed successfully`,
      pricingType,
    })

  } catch (error) {
    console.error('Pricing model payment error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Payment processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}