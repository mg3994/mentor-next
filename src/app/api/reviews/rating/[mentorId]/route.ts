import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: {
    mentorId: string
  }
}

// Get real-time rating information for a mentor
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { mentorId } = params

    // Get mentor profile with current rating
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: mentorId },
      select: {
        averageRating: true,
        totalReviews: true,
        updatedAt: true
      }
    })

    if (!mentorProfile) {
      return NextResponse.json(
        { error: 'Mentor not found' },
        { status: 404 }
      )
    }

    // Get fresh calculation from reviews
    const reviews = await prisma.review.findMany({
      where: { 
        mentorId,
        isPublic: true 
      },
      select: { rating: true }
    })

    const totalReviews = reviews.length
    const averageRating = totalReviews > 0 
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0

    // Update mentor profile if there's a discrepancy
    if (mentorProfile.averageRating !== averageRating || mentorProfile.totalReviews !== totalReviews) {
      await prisma.mentorProfile.update({
        where: { userId: mentorId },
        data: {
          averageRating,
          totalReviews
        }
      })
    }

    return NextResponse.json({
      success: true,
      averageRating,
      totalReviews,
      lastUpdated: new Date()
    })

  } catch (error) {
    console.error('Get real-time rating error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get rating',
        success: false,
      },
      { status: 500 }
    )
  }
}