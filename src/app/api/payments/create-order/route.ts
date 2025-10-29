import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { razorpayService } from '@/lib/razorpay-service'
import { getAvailablePaymentMethods, validatePaymentAmount } from '@/lib/razorpay-config'
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

    // Calculate total amount based on pricing type
    let baseAmount: number
    switch (pricingModel.type) {
      case 'ONE_TIME':
        baseAmount = pricingModel.price
        break
      case 'HOURLY':
        const hours = duration ? duration / 60 : 1
        baseAmount = pricingModel.price * hours
        break
      case 'MONTHLY_SUBSCRIPTION':
        baseAmount = pricingModel.price
        break
      default:
        baseAmount = pricingModel.price
    }

    // Validate payment amount
    const validation = validatePaymentAmount(baseAmount, 'upi')
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Create Razorpay order
    const order = await razorpayService.createOrder({
      amount: baseAmount,
      currency: 'INR',
      sessionId,
      userId: session.user.id,
      description: `Session with ${sessionData.mentor.name}`,
      notes: {
        mentorId: sessionData.mentorId,
        pricingType: pricingModel.type,
        duration: duration?.toString() || '',
      },
    })

    // Get available payment methods
    const availablePaymentMethods = getAvailablePaymentMethods()

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: baseAmount,
        currency: order.currency,
        receipt: order.receipt,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      paymentMethods: availablePaymentMethods,
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