import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MonthlySubscriptionHandler } from '@/lib/pricing-models'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const subscriptionActionSchema = z.object({
  action: z.enum(['create', 'renew', 'cancel']),
  mentorId: z.string().min(1, 'Mentor ID is required'),
  paymentMethod: z.string().optional(),
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
    const validatedFields = subscriptionActionSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid subscription data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { action, mentorId, paymentMethod } = validatedFields.data
    const subscriptionHandler = new MonthlySubscriptionHandler()

    switch (action) {
      case 'create':
        return await handleCreateSubscription(session.user.id, mentorId, paymentMethod || 'card')
      
      case 'renew':
        return await handleRenewSubscription(session.user.id, mentorId, paymentMethod || 'card', subscriptionHandler)
      
      case 'cancel':
        return await handleCancelSubscription(session.user.id, mentorId)
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Subscription management error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Subscription operation failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve user's subscriptions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const mentorId = searchParams.get('mentorId')
    const status = searchParams.get('status') || 'active'

    // Get user's subscriptions from audit logs
    const subscriptionLogs = await prisma.auditLog.findMany({
      where: {
        userId: session.user.id,
        action: 'SUBSCRIPTION_CREATED',
        resource: 'subscription',
        ...(mentorId && {
          details: {
            path: ['mentorId'],
            equals: mentorId,
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
    })

    // Process subscriptions and check status
    const subscriptions = await Promise.all(
      subscriptionLogs.map(async (log: any) => {
        if (!log.details) return null

        const details = log.details as any
        const endDate = new Date(details.endDate)
        const isActive = endDate > new Date()

        // Filter by status if specified
        if (status === 'active' && !isActive) return null
        if (status === 'expired' && isActive) return null

        // Get mentor details
        const mentor = await prisma.user.findUnique({
          where: { id: details.mentorId },
          select: {
            id: true,
            name: true,
            image: true,
            mentorProfile: {
              select: {
                bio: true,
                expertise: true,
                averageRating: true,
                pricingModels: {
                  where: {
                    type: 'MONTHLY_SUBSCRIPTION',
                    isActive: true,
                  },
                },
              },
            },
          },
        })

        return {
          id: log.id,
          mentorId: details.mentorId,
          mentor,
          amount: details.amount,
          startDate: details.startDate,
          endDate: details.endDate,
          status: isActive ? 'active' : 'expired',
          transactionId: details.transactionId,
          createdAt: log.createdAt,
        }
      })
    )

    // Filter out null values
    const validSubscriptions = subscriptions.filter(sub => sub !== null)

    return NextResponse.json({
      success: true,
      subscriptions: validSubscriptions,
      count: validSubscriptions.length,
    })

  } catch (error) {
    console.error('Get subscriptions error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get subscriptions',
        success: false,
      },
      { status: 500 }
    )
  }
}

async function handleCreateSubscription(menteeId: string, mentorId: string, paymentMethod: string) {
  const subscriptionHandler = new MonthlySubscriptionHandler()

  // Validate subscription creation
  const validation = await subscriptionHandler.validateBooking({
    mentorId,
    menteeId,
    pricingModelId: '', // Will be fetched below
  })

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    )
  }

  // Get mentor's subscription pricing model
  const pricingModel = await prisma.pricingModel.findFirst({
    where: {
      mentorId,
      type: 'MONTHLY_SUBSCRIPTION',
      isActive: true,
    },
  })

  if (!pricingModel) {
    return NextResponse.json(
      { error: 'Monthly subscription not available for this mentor' },
      { status: 404 }
    )
  }

  // Create a virtual session for subscription
  const subscriptionSession = await prisma.session.create({
    data: {
      mentorId,
      menteeId,
      startTime: new Date(),
      scheduledEnd: new Date(Date.now() + 60 * 60 * 1000), // 1 hour placeholder
      status: 'COMPLETED',
      pricingType: 'MONTHLY_SUBSCRIPTION',
      agreedPrice: pricingModel.price,
    },
  })

  // Process subscription payment
  const result = await subscriptionHandler.processPayment({
    sessionId: subscriptionSession.id,
    userId: menteeId,
    amount: pricingModel.price,
    paymentMethod,
    mentorId,
  })

  return NextResponse.json({
    success: true,
    subscription: {
      sessionId: subscriptionSession.id,
      mentorId,
      amount: pricingModel.price,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    transaction: result.transaction,
    message: 'Monthly subscription created successfully',
  })
}

async function handleRenewSubscription(
  menteeId: string, 
  mentorId: string, 
  paymentMethod: string,
  subscriptionHandler: MonthlySubscriptionHandler
) {
  const result = await subscriptionHandler.handleSubscriptionRenewal({
    menteeId,
    mentorId,
    paymentMethod,
  })

  return NextResponse.json({
    success: true,
    transaction: result.transaction,
    message: 'Subscription renewed successfully',
  })
}

async function handleCancelSubscription(menteeId: string, mentorId: string) {
  // Mark subscription as cancelled in audit log
  await prisma.auditLog.create({
    data: {
      userId: menteeId,
      action: 'SUBSCRIPTION_CANCELLED',
      resource: 'subscription',
      details: {
        mentorId,
        cancelledAt: new Date().toISOString(),
        reason: 'user_requested',
      },
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Subscription cancelled successfully',
  })
}