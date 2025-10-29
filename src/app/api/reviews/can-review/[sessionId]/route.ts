import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{
    sessionId: string
  }>
}

// Check if user can review a session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    // Get session data
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: { select: { id: true, name: true } },
        mentee: { select: { id: true, name: true } }
      }
    })

    if (!sessionData) {
      return NextResponse.json({
        canReview: false,
        reason: 'Session not found'
      })
    }

    // Check if user is the mentee
    if (sessionData.menteeId !== session.user.id) {
      return NextResponse.json({
        canReview: false,
        reason: 'Only the mentee can review this session'
      })
    }

    // Check if session is completed
    if (sessionData.status !== 'COMPLETED') {
      return NextResponse.json({
        canReview: false,
        reason: 'Session must be completed before reviewing'
      })
    }

    // Check if review already exists
    const existingReview = await prisma.review.findFirst({
      where: {
        sessionId,
        menteeId: session.user.id
      },
      include: {
        mentee: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (existingReview) {
      // Check if review can still be edited (within 7 days)
      const now = new Date()
      const reviewDate = new Date(existingReview.createdAt)
      const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
      const canEdit = daysSinceReview <= 7

      return NextResponse.json({
        canReview: false,
        reason: 'Review already exists for this session',
        existingReview: {
          ...existingReview,
          mentee: existingReview.isAnonymous ? null : existingReview.mentee
        },
        canEdit,
        editTimeRemaining: canEdit ? Math.max(0, 7 - daysSinceReview) : 0
      })
    }

    // Check if session ended recently (allow reviews up to 30 days after completion)
    const sessionEndDate = sessionData.endTime || sessionData.scheduledEnd
    if (sessionEndDate) {
      const now = new Date()
      const daysSinceEnd = (now.getTime() - new Date(sessionEndDate).getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysSinceEnd > 30) {
        return NextResponse.json({
          canReview: false,
          reason: 'Review period has expired (30 days after session completion)'
        })
      }
    }

    return NextResponse.json({
      canReview: true,
      session: {
        id: sessionData.id,
        topic: sessionData.topic,
        mentor: sessionData.mentor,
        scheduledStartTime: sessionData.startTime,
        duration: sessionData.duration
      }
    })

  } catch (error) {
    console.error('Can review session error:', error)
    
    return NextResponse.json(
      { 
        canReview: false,
        reason: 'Failed to check review eligibility'
      },
      { status: 500 }
    )
  }
}