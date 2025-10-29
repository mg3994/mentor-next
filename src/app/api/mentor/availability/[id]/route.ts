import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive must be a boolean' },
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

    // Check if availability slot belongs to the mentor
    const availability = await prisma.availability.findFirst({
      where: {
        id,
        mentorId: mentorProfile.id,
      },
    })

    if (!availability) {
      return NextResponse.json(
        { error: 'Availability slot not found' },
        { status: 404 }
      )
    }

    // Update availability status
    const updatedAvailability = await prisma.availability.update({
      where: { id },
      data: { isActive },
    })

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'AVAILABILITY_UPDATED',
      resource: 'AVAILABILITY',
      details: {
        availabilityId: id,
        isActive,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Availability slot updated successfully',
      availability: updatedAvailability,
    })

  } catch (error) {
    console.error('Update availability error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

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

    // Check if availability slot belongs to the mentor
    const availability = await prisma.availability.findFirst({
      where: {
        id,
        mentorId: mentorProfile.id,
      },
    })

    if (!availability) {
      return NextResponse.json(
        { error: 'Availability slot not found' },
        { status: 404 }
      )
    }

    // Check if there are any upcoming sessions using this availability
    const upcomingSessions = await prisma.session.count({
      where: {
        mentorId: session.user.id,
        startTime: {
          gte: new Date(),
        },
        status: {
          in: ['SCHEDULED', 'IN_PROGRESS'],
        },
      },
    })

    if (upcomingSessions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete availability slot with upcoming sessions' },
        { status: 409 }
      )
    }

    // Delete availability slot
    await prisma.availability.delete({
      where: { id },
    })

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'AVAILABILITY_DELETED',
      resource: 'AVAILABILITY',
      details: {
        availabilityId: id,
        dayOfWeek: availability.dayOfWeek,
        startTime: availability.startTime,
        endTime: availability.endTime,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Availability slot deleted successfully',
    })

  } catch (error) {
    console.error('Delete availability error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}