import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { availabilitySchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/db-utils'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has mentor role
    const isMentor = hasRole(session.user.roles, Role.MENTOR)
    if (!isMentor) {
      return NextResponse.json(
        { error: 'Mentor role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = availabilitySchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validatedFields.error.errors },
        { status: 400 }
      )
    }

    const { dayOfWeek, startTime, endTime } = validatedFields.data

    // Validate time range
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      )
    }

    // Get mentor profile
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!mentorProfile) {
      return NextResponse.json(
        { error: 'Mentor profile not found' },
        { status: 404 }
      )
    }

    // Check for overlapping availability on the same day
    const overlapping = await prisma.availability.findFirst({
      where: {
        mentorId: mentorProfile.id,
        dayOfWeek,
        isActive: true,
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
      },
    })

    if (overlapping) {
      return NextResponse.json(
        { error: 'This time slot overlaps with existing availability' },
        { status: 409 }
      )
    }

    // Create availability slot
    const availability = await prisma.availability.create({
      data: {
        mentorId: mentorProfile.id,
        dayOfWeek,
        startTime,
        endTime,
        isActive: true,
      },
    })

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'AVAILABILITY_CREATED',
      resource: 'AVAILABILITY',
      details: {
        availabilityId: availability.id,
        dayOfWeek,
        startTime,
        endTime,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Availability slot created successfully',
      availability,
    })

  } catch (error) {
    console.error('Create availability error:', error)
    
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

    // Check if user has mentor role
    const isMentor = hasRole(session.user.roles, Role.MENTOR)
    if (!isMentor) {
      return NextResponse.json(
        { error: 'Mentor role required' },
        { status: 403 }
      )
    }

    // Get mentor profile
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!mentorProfile) {
      return NextResponse.json(
        { error: 'Mentor profile not found' },
        { status: 404 }
      )
    }

    // Get all availability slots
    const availability = await prisma.availability.findMany({
      where: {
        mentorId: mentorProfile.id,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      availability,
    })

  } catch (error) {
    console.error('Get availability error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}