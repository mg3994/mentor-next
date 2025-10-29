import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ReviewAnalyticsService, type ReviewAnalytics, type MonthlyReviewStats } from '@/lib/review-analytics'

interface RouteParams {
  params: Promise<{
    mentorId: string
  }>
}

// Get comprehensive review analytics for a mentor
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { mentorId } = await params

    // Verify access (mentor themselves or admin)
    if (session.user.id !== mentorId) {
      // TODO: Add admin role check here
      return NextResponse.json(
        { error: 'Unauthorized access to analytics' },
        { status: 403 }
      )
    }

    // Get all reviews for the mentor
    const reviews = await prisma.review.findMany({
      where: { 
        mentorId,
        isPublic: true 
      },
      orderBy: { createdAt: 'desc' }
    })

    if (reviews.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalReviews: 0,
          averageRating: 0,
          ratingTrend: 'stable',
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          monthlyStats: [],
          categoryAverages: { communication: 0, expertise: 0, helpfulness: 0, preparation: 0 },
          recentActivity: [],
          topKeywords: [],
          sentimentAnalysis: { positive: 0, negative: 0, neutral: 0, overallSentiment: 'neutral' }
        } as ReviewAnalytics
      })
    }

    // Calculate basic statistics
    const totalReviews = reviews.length
    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++
    })

    // Calculate monthly statistics
    const monthlyStats: MonthlyReviewStats[] = []
    const monthlyData: Record<string, { total: number; sum: number; count: number }> = {}

    reviews.forEach(review => {
      const date = new Date(review.createdAt)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      
      if (!monthlyData[key]) {
        monthlyData[key] = { total: 0, sum: 0, count: 0 }
      }
      
      monthlyData[key].total++
      monthlyData[key].sum += review.rating
      monthlyData[key].count++
    })

    Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, data], index, array) => {
        const [year, month] = key.split('-').map(Number)
        const averageRating = data.sum / data.count
        const prevMonth = index > 0 ? array[index - 1][1].sum / array[index - 1][1].count : averageRating
        
        monthlyStats.push({
          month: new Date(year, month).toLocaleString('default', { month: 'long' }),
          year,
          totalReviews: data.total,
          averageRating,
          ratingChange: averageRating - prevMonth
        })
      })

    // Calculate rating trend
    const ratingTrend = ReviewAnalyticsService.calculateRatingTrend(monthlyStats)

    // Calculate category averages
    const categoryAverages = ReviewAnalyticsService.calculateCategoryAverages(
      reviews.map(review => ({ 
        categories: review.categories || undefined 
      }))
    )

    // Get recent activity (last 10 reviews)
    const recentActivity = reviews.slice(0, 10).map(review => ({
      date: review.createdAt,
      action: 'created' as const,
      reviewId: review.id,
      rating: review.rating,
      menteeId: review.menteeId
    }))

    // Extract top keywords
    const topKeywords = ReviewAnalyticsService.extractKeywords(
      reviews.map(r => ({ title: r.title, content: r.content }))
    )

    // Analyze sentiment
    const sentimentAnalysis = ReviewAnalyticsService.analyzeReviewSentiment(
      reviews.map(r => ({ rating: r.rating, content: r.content }))
    )

    const analytics: ReviewAnalytics = {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingTrend,
      ratingDistribution,
      monthlyStats,
      categoryAverages,
      recentActivity,
      topKeywords,
      sentimentAnalysis
    }

    return NextResponse.json({
      success: true,
      data: analytics
    })

  } catch (error) {
    console.error('Get review analytics error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get review analytics',
        success: false,
      },
      { status: 500 }
    )
  }
}