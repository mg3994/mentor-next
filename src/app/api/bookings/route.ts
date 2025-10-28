import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sessionBookingSchema } from '@/lib/validations'
import { createAuditLog, createTransaction } from '@/lib/db-utils'
import { hasRole } from '@/lib/auth-utils'
import { Role, SessionStatus, TransactionStatus, PricingType } from '@prisma/client'
import { PLATFORM_FEE_PERCENTAGE } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has mentee role
    const isMentee = hasRole(session.user.roles, Role.MENTEE)
    if (!isMentee) {
      return NextResponse.json(
        { error: 'Mentee role required to book sessions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = sessionBookingSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid booking data', details: validatedFields.error.errors },
        { status: 400 }
      )
    }

    const { mentorId, startTime, scheduledEnd, pricingType, agreedPrice } = validatedFields.data

    // Prevent self-booking
    if (mentorId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot book a session with yourself' },
        { status: 400 }
      )
    }

    // Verify mentor exists and is active
    const mentor = await prisma.user.findFirst({
      where: {
        id: mentorId,
        roles: {
          some: {
            role: Role.MENTOR,
            status: 'ACTIVE',
          },
        },
      },
      include: {
        mentorProfile: true,
      },
    })

    if (!mentor || !mentor.mentorProfile?.isVerified) {
      return NextResponse.json(
        { error: 'Mentor not found or not verified' },
        { status: 404 }
      )
    }

    // Check for scheduling conflicts
    const conflictingSession = await prisma.session.findFirst({
      where: {
        mentorId,
        status: {
          in: [SessionStatus.SCHEDULED, SessionStatus.IN_PROGRESS],
        },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { scheduledEnd: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: scheduledEnd } },
              { scheduledEnd: { gte: scheduledEnd } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { scheduledEnd: { lte: scheduledEnd } },
            ],
          },
        ],
      },
    })

    if (conflictingSession) {
      return NextResponse.json(
        { error: 'Time slot is no longer available' },
        { status: 409 }
      )
    }

    // Create session
    const newSession = await prisma.session.create({
      data: {
        mentorId,
        menteeId: session.user.id,
        startTime,
        scheduledEnd,
        status: SessionStatus.SCHEDULED,
        pricingType: pricingType as PricingType,
        agreedPrice,
        sessionLink: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        mentee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create transaction record
    const platformFee = agreedPrice * PLATFORM_FEE_PERCENTAGE
    const mentorEarnings = agreedPrice - platformFee

    const transaction = await createTransaction({
      sessionId: newSession.id,
      amount: agreedPrice,
      platformFee,
      mentorEarnings,
      paymentMethod: 'platform_credit', // Simplified for demo
    })

    // Create audit logs
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_BOOKED',
      resource: 'SESSION',
      details: {
        sessionId: newSession.id,
        mentorId,
        startTime,
        scheduledEnd,
        agreedPrice,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    // TODO: Send notification emails to both mentor and mentee
    // TODO: Create calendar events
    // TODO: Process actual payment

    return NextResponse.json({
      success: true,
      message: 'Session booked successfully',
      session: {
        id: newSession.id,
        startTime: newSession.startTime,
        scheduledEnd: newSession.scheduledEnd,
        mentor: newSession.mentor,
        sessionLink: newSession.sessionLink,
      },
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
      },
    })

  } catch (error) {
    console.error('Session booking error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      OR: [
        { mentorId: session.user.id },
        { menteeId: session.user.id },
      ],
    }

    if (status) {
      where.status = status
    }

    // Get user's sessions
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          mentee: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          transaction: {
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          startTime: 'desc',
        },
      }),
      prisma.session.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get sessions error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}