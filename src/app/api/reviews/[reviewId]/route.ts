import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

interface RouteParams {
  params: {
    reviewId: string
  }
}

// Update a review
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { reviewId } = params
    const body = await request.json()
    const { rating, title, content, isAnonymous, isPublic, categories } = body

    // Get existing review
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        session: { select: { mentorId: true } }
      }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (existingReview.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only edit your own reviews' },
        { status: 403 }
      )
    }

    // Check if review can still be edited (within 7 days)
    const now = new Date()
    const reviewDate = new Date(existingReview.createdAt)
    const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceReview > 7) {
      return NextResponse.json(
        { error: 'Reviews can only be edited within 7 days of creation' },
        { status: 400 }
      )
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Update review
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(rating !== undefined && { rating }),
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(isAnonymous !== undefined && { isAnonymous }),
        ...(isPublic !== undefined && { isPublic }),
        ...(categories !== undefined && { categories: categories ? JSON.stringify(categories) : null }),
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

    // Update mentor's average rating if rating changed
    if (rating !== undefined && rating !== existingReview.rating) {
      await updateMentorRating(existingReview.session.mentorId)
    }

    // Log review update
    await createAuditLog({
      userId: session.user.id,
      action: 'REVIEW_UPDATED',
      resource: 'review',
      details: {
        reviewId,
        changes: {
          ...(rating !== undefined && { rating: { from: existingReview.rating, to: rating } }),
          ...(title !== undefined && { title: 'updated' }),
          ...(content !== undefined && { content: 'updated' }),
          ...(isAnonymous !== undefined && { isAnonymous }),
          ...(isPublic !== undefined && { isPublic }),
        }
      }
    })

    // Filter out mentee info for anonymous reviews
    const processedReview = {
      ...updatedReview,
      mentee: updatedReview.isAnonymous ? null : updatedReview.mentee
    }

    return NextResponse.json({
      success: true,
      review: processedReview,
      message: 'Review updated successfully'
    })

  } catch (error) {
    console.error('Update review error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update review',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Delete a review
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { reviewId } = params

    // Get existing review
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        session: { select: { mentorId: true } }
      }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    // Verify ownership (or admin access)
    if (existingReview.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own reviews' },
        { status: 403 }
      )
    }

    // Delete review
    await prisma.review.delete({
      where: { id: reviewId }
    })

    // Update mentor's average rating
    await updateMentorRating(existingReview.session.mentorId)

    // Log review deletion
    await createAuditLog({
      userId: session.user.id,
      action: 'REVIEW_DELETED',
      resource: 'review',
      details: {
        reviewId,
        mentorId: existingReview.session.mentorId,
        rating: existingReview.rating
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully'
    })

  } catch (error) {
    console.error('Delete review error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to delete review',
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