import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: {
    sessionId: string
  }
}

// Get review for a specific session
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = params

    // Verify session access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this session
    const hasAccess = 
      sessionData.mentorId === session.user.id || 
      sessionData.menteeId === session.user.id

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    // Get review for this session
    const review = await prisma.review.findFirst({
      where: {
        sessionId,
      },
      include: {
        mentee: {
          select: {
            id: true,
            name: true,
          }
        },
        session: {
          select: {
            id: true,
            topic: true,
            duration: true,
          }
        }
      }
    })

    if (!review) {
      return NextResponse.json(
        { error: 'No review found for this session' },
        { status: 404 }
      )
    }

    // Filter out mentee info for anonymous reviews (unless user is the mentee)
    const processedReview = {
      ...review,
      mentee: (review.isAnonymous && review.menteeId !== session.user.id) ? null : review.mentee
    }

    return NextResponse.json({
      success: true,
      review: processedReview
    })

  } catch (error) {
    console.error('Get session review error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get session review',
        success: false,
      },
      { status: 500 }
    )
  }
}