import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createPaymentOrder, calculateSessionPrice } from '@/lib/payment-utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createOrderSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  pricingModelId: z.string().min(1, 'Pricing model ID is required'),
  duration: z.number().min(15).optional(), // For hourly sessions
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
    const validatedFields = createOrderSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid order data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, pricingModelId, duration } = validatedFields.data

    // Get session details
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: {
          include: {
            mentorProfile: {
              include: {
                pricingModels: true,
              },
            },
          },
        },
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

    // Get pricing model
    const pricingModel = sessionData.mentor.mentorProfile?.pricingModels.find(
      (pm: any) => pm.id === pricingModelId && pm.isActive
    )

    if (!pricingModel) {
      return NextResponse.json(
        { error: 'Pricing model not found or inactive' },
        { status: 404 }
      )
    }

    // Calculate total amount
    const baseAmount = calculateSessionPrice(
      pricingModel.type as any,
      pricingModel.price,
      duration
    )

    // Create payment order
    const order = await createPaymentOrder({
      amount: baseAmount,
      currency: 'USD',
      description: `Session with ${sessionData.mentor.name}`,
      customerInfo: {
        userId: session.user.id,
        name: session.user.name || 'Unknown',
        email: session.user.email || '',
      },
      metadata: {
        sessionId,
        mentorId: sessionData.mentorId,
        pricingType: pricingModel.type,
      },
    })

    return NextResponse.json({
      success: true,
      order,
      session: {
        id: sessionData.id,
        startTime: sessionData.startTime,
        mentor: {
          name: sessionData.mentor.name,
          image: sessionData.mentor.image,
        },
      },
      pricingModel: {
        type: pricingModel.type,
        price: pricingModel.price,
        description: pricingModel.description,
      },
    })

  } catch (error) {
    console.error('Create payment order error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create payment order',
        success: false,
      },
      { status: 500 }
    )
  }
}