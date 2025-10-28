import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// Get reviews (for mentor or general listing)
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
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includePrivate = searchParams.get('includePrivate') === 'true'

    if (!mentorId) {
      return NextResponse.json(
        { error: 'Mentor ID is required' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: any = {
      mentorId,
    }

    // Only include public reviews unless user is the mentor or admin
    if (!includePrivate || session.user.id !== mentorId) {
      where.isPublic = true
    }

    // Get reviews with pagination
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
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
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
      }),
      prisma.review.count({ where })
    ])

    // Calculate statistics
    const allReviews = await prisma.review.findMany({
      where: { mentorId, isPublic: true },
      select: { rating: true }
    })

    const stats = {
      totalReviews: allReviews.length,
      averageRating: allReviews.length > 0 
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
        : 0,
      ratingDistribution: {
        1: allReviews.filter(r => r.rating === 1).length,
        2: allReviews.filter(r => r.rating === 2).length,
        3: allReviews.filter(r => r.rating === 3).length,
        4: allReviews.filter(r => r.rating === 4).length,
        5: allReviews.filter(r => r.rating === 5).length,
      }
    }

    // Filter out mentee info for anonymous reviews
    const processedReviews = reviews.map(review => ({
      ...review,
      mentee: review.isAnonymous ? null : review.mentee
    }))

    return NextResponse.json({
      success: true,
      reviews: processedReviews,
      total,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Get reviews error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get reviews',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Create a new review
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
    const { 
      sessionId, 
      rating, 
      title, 
      content, 
      isAnonymous = false, 
      isPublic = true,
      categories 
    } = body

    // Validate required fields
    if (!sessionId || !rating || !title || !content) {
      return NextResponse.json(
        { error: 'Session ID, rating, title, and content are required' },
        { status: 400 }
      )
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Get session and verify access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: { select: { id: true, name: true } },
        mentee: { select: { id: true, name: true } }
      }
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user is the mentee
    if (sessionData.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the mentee can review this session' },
        { status: 403 }
      )
    }

    // Check if session is completed
    if (sessionData.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Can only review completed sessions' },
        { status: 400 }
      )
    }

    // Check if review already exists
    const existingReview = await prisma.review.findFirst({
      where: {
        sessionId,
        menteeId: session.user.id
      }
    })

    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this session' },
        { status: 400 }
      )
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        sessionId,
        mentorId: sessionData.mentorId,
        menteeId: session.user.id,
        rating,
        title: title.trim(),
        content: content.trim(),
        isAnonymous,
        isPublic,
        categories: categories ? JSON.stringify(categories) : null,
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

    // Update mentor's average rating
    await updateMentorRating(sessionData.mentorId)

    // Log review creation
    await createAuditLog({
      userId: session.user.id,
      action: 'REVIEW_CREATED',
      resource: 'review',
      details: {
        reviewId: review.id,
        sessionId,
        mentorId: sessionData.mentorId,
        rating,
        isAnonymous,
        isPublic
      }
    })

    // Filter out mentee info for anonymous reviews
    const processedReview = {
      ...review,
      mentee: review.isAnonymous ? null : review.mentee
    }

    return NextResponse.json({
      success: true,
      review: processedReview,
      message: 'Review submitted successfully'
    })

  } catch (error) {
    console.error('Create review error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create review',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Helper function to update mentor's average rating
async function updateMentorRating(mentorId: string) {
  try {
    const reviews = await prisma.review.findMany({
      where: { mentorId, isPublic: true },
      select: { rating: true }
    })

    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0

    await prisma.mentorProfile.update({
      where: { userId: mentorId },
      data: { 
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: reviews.length
      }
    })

  } catch (error) {
    console.error('Update mentor rating error:', error)
  }
}