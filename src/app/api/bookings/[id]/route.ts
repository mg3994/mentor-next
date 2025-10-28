import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { canAccessSession } from '@/lib/auth-utils'
import { SessionStatus } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = params

    // Get session details
    const sessionData = await prisma.session.findUnique({
      where: { id },
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
        files: {
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            uploadedAt: true,
            uploadedBy: true,
          },
        },
        notes: {
          select: {
            id: true,
            content: true,
            createdBy: true,
            createdAt: true,
          },
        },
      },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if user can access this session
    if (!canAccessSession(session.user.id, sessionData)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      session: sessionData,
    })

  } catch (error) {
    console.error('Get session error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { status, endTime } = body

    // Get session details
    const sessionData = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        mentorId: true,
        menteeId: true,
        status: true,
        startTime: true,
        scheduledEnd: true,
      },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if user can access this session
    if (!canAccessSession(session.user.id, sessionData)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [], // Cannot change completed sessions
      CANCELLED: [], // Cannot change cancelled sessions
      NO_SHOW: [], // Cannot change no-show sessions
    }

    if (!validTransitions[sessionData.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot change status from ${sessionData.status} to ${status}` },
        { status: 400 }
      )
    }

    // Additional validation for cancellation
    if (status === 'CANCELLED') {
      const sessionStart = new Date(sessionData.startTime)
      const now = new Date()
      const hoursUntilSession = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      if (hoursUntilSession < 2) {
        return NextResponse.json(
          { error: 'Cannot cancel session less than 2 hours before start time' },
          { status: 400 }
        )
      }
    }

    // Update session
    const updateData: any = { status }
    if (endTime && status === 'COMPLETED') {
      updateData.endTime = new Date(endTime)
      // Calculate actual duration
      const actualDuration = Math.round((new Date(endTime).getTime() - sessionData.startTime.getTime()) / (1000 * 60))
      updateData.actualDuration = actualDuration
    }

    const updatedSession = await prisma.session.update({
      where: { id },
      data: updateData,
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

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_STATUS_UPDATED',
      resource: 'SESSION',
      details: {
        sessionId: id,
        oldStatus: sessionData.status,
        newStatus: status,
        endTime,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    // TODO: Send notification emails
    // TODO: Process refunds for cancelled sessions
    // TODO: Process mentor payments for completed sessions

    return NextResponse.json({
      success: true,
      message: 'Session updated successfully',
      session: updatedSession,
    })

  } catch (error) {
    console.error('Update session error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}