// Review Analytics Service
// Handles review statistics, trends, and analytics

export interface ReviewAnalytics {
  totalReviews: number
  averageRating: number
  ratingTrend: 'up' | 'down' | 'stable'
  ratingDistribution: Record<number, number>
  monthlyStats: MonthlyReviewStats[]
  categoryAverages: CategoryAverages
  recentActivity: ReviewActivity[]
  topKeywords: KeywordFrequency[]
  sentimentAnalysis: SentimentAnalysis
}

export interface MonthlyReviewStats {
  month: string
  year: number
  totalReviews: number
  averageRating: number
  ratingChange: number
}

export interface CategoryAverages {
  communication: number
  expertise: number
  helpfulness: number
  preparation: number
}

export interface ReviewActivity {
  date: Date
  action: 'created' | 'updated' | 'deleted'
  reviewId: string
  rating: number
  menteeId: string
}

export interface KeywordFrequency {
  keyword: string
  frequency: number
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface SentimentAnalysis {
  positive: number
  negative: number
  neutral: number
  overallSentiment: 'positive' | 'negative' | 'neutral'
}

export interface ReviewModerationResult {
  isAppropriate: boolean
  confidence: number
  flags: string[]
  suggestedAction: 'approve' | 'review' | 'reject'
}

export class ReviewAnalyticsService {
  // Calculate comprehensive analytics for a mentor
  static async calculateMentorAnalytics(mentorId: string): Promise<ReviewAnalytics> {
    try {
      const response = await fetch(`/api/reviews/analytics/${mentorId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch review analytics')
      }
      
      const analytics = await response.json()
      return analytics.data
      
    } catch (error) {
      console.error('Calculate mentor analytics error:', error)
      throw error
    }
  }

  // Get real-time rating updates
  static async getRealTimeRating(mentorId: string): Promise<{
    averageRating: number
    totalReviews: number
    lastUpdated: Date
  }> {
    try {
      const response = await fetch(`/api/reviews/rating/${mentorId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch real-time rating')
      }
      
      const data = await response.json()
      return data
      
    } catch (error) {
      console.error('Get real-time rating error:', error)
      throw error
    }
  }

  // Moderate review content for inappropriate material
  static async moderateReview(content: string, title: string): Promise<ReviewModerationResult> {
    try {
      const response = await fetch('/api/reviews/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, title }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to moderate review')
      }
      
      const result = await response.json()
      return result.moderation
      
    } catch (error) {
      console.error('Moderate review error:', error)
      // Return safe default if moderation fails
      return {
        isAppropriate: true,
        confidence: 0.5,
        flags: [],
        suggestedAction: 'review'
      }
    }
  }

  // Calculate rating trends
  static calculateRatingTrend(monthlyStats: MonthlyReviewStats[]): 'up' | 'down' | 'stable' {
    if (monthlyStats.length < 2) return 'stable'
    
    const recent = monthlyStats.slice(-3) // Last 3 months
    const changes = recent.slice(1).map((month, index) => 
      month.averageRating - recent[index].averageRating
    )
    
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length
    
    if (avgChange > 0.1) return 'up'
    if (avgChange < -0.1) return 'down'
    return 'stable'
  }

  // Extract keywords from review content
  static extractKeywords(reviews: Array<{ title: string; content: string }>): KeywordFrequency[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ])
    
    const wordCount: Record<string, number> = {}
    
    reviews.forEach(review => {
      const text = `${review.title} ${review.content}`.toLowerCase()
      const words = text.match(/\b\w+\b/g) || []
      
      words.forEach(word => {
        if (word.length > 3 && !stopWords.has(word)) {
          wordCount[word] = (wordCount[word] || 0) + 1
        }
      })
    })
    
    return Object.entries(wordCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([keyword, frequency]) => ({
        keyword,
        frequency,
        sentiment: this.analyzeKeywordSentiment(keyword)
      }))
  }

  // Simple sentiment analysis for keywords
  private static analyzeKeywordSentiment(keyword: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'excellent', 'great', 'amazing', 'wonderful', 'fantastic', 'helpful', 'knowledgeable',
      'professional', 'patient', 'clear', 'thorough', 'insightful', 'valuable', 'recommend',
      'perfect', 'outstanding', 'brilliant', 'effective', 'supportive', 'encouraging'
    ]
    
    const negativeWords = [
      'terrible', 'awful', 'bad', 'poor', 'disappointing', 'unhelpful', 'confusing',
      'unprofessional', 'impatient', 'unclear', 'rushed', 'waste', 'boring', 'difficult',
      'frustrating', 'inadequate', 'unsatisfactory', 'problematic'
    ]
    
    if (positiveWords.includes(keyword.toLowerCase())) return 'positive'
    if (negativeWords.includes(keyword.toLowerCase())) return 'negative'
    return 'neutral'
  }

  // Analyze overall sentiment of reviews
  static analyzeReviewSentiment(reviews: Array<{ rating: number; content: string }>): SentimentAnalysis {
    let positive = 0
    let negative = 0
    let neutral = 0
    
    reviews.forEach(review => {
      if (review.rating >= 4) {
        positive++
      } else if (review.rating <= 2) {
        negative++
      } else {
        neutral++
      }
    })
    
    const total = reviews.length
    const overallSentiment = positive > negative 
      ? (positive > neutral ? 'positive' : 'neutral')
      : (negative > neutral ? 'negative' : 'neutral')
    
    return {
      positive: total > 0 ? (positive / total) * 100 : 0,
      negative: total > 0 ? (negative / total) * 100 : 0,
      neutral: total > 0 ? (neutral / total) * 100 : 0,
      overallSentiment
    }
  }

  // Calculate category averages from review data
  static calculateCategoryAverages(reviews: Array<{ categories?: string }>): CategoryAverages {
    const totals = { communication: 0, expertise: 0, helpfulness: 0, preparation: 0 }
    const counts = { communication: 0, expertise: 0, helpfulness: 0, preparation: 0 }
    
    reviews.forEach(review => {
      if (review.categories) {
        try {
          const categories = JSON.parse(review.categories)
          Object.keys(totals).forEach(key => {
            if (categories[key] && categories[key] > 0) {
              totals[key as keyof CategoryAverages] += categories[key]
              counts[key as keyof CategoryAverages]++
            }
          })
        } catch (e) {
          // Ignore parsing errors
        }
      }
    })
    
    return {
      communication: counts.communication > 0 ? totals.communication / counts.communication : 0,
      expertise: counts.expertise > 0 ? totals.expertise / counts.expertise : 0,
      helpfulness: counts.helpfulness > 0 ? totals.helpfulness / counts.helpfulness : 0,
      preparation: counts.preparation > 0 ? totals.preparation / counts.preparation : 0,
    }
  }

  // Format analytics for display
  static formatAnalyticsForDisplay(analytics: ReviewAnalytics): {
    summary: string
    highlights: string[]
    recommendations: string[]
  } {
    const { averageRating, totalReviews, ratingTrend, sentimentAnalysis } = analytics
    
    const summary = `${totalReviews} reviews with ${averageRating.toFixed(1)}/5.0 average rating`
    
    const highlights: string[] = []
    const recommendations: string[] = []
    
    // Rating highlights
    if (averageRating >= 4.5) {
      highlights.push('Excellent overall rating')
    } else if (averageRating >= 4.0) {
      highlights.push('Strong positive feedback')
    } else if (averageRating >= 3.0) {
      highlights.push('Mixed feedback with room for improvement')
    } else {
      highlights.push('Needs significant improvement')
    }
    
    // Trend highlights
    if (ratingTrend === 'up') {
      highlights.push('Rating trending upward')
    } else if (ratingTrend === 'down') {
      highlights.push('Rating declining - needs attention')
      recommendations.push('Review recent feedback for improvement areas')
    }
    
    // Sentiment highlights
    if (sentimentAnalysis.positive > 70) {
      highlights.push('Overwhelmingly positive sentiment')
    } else if (sentimentAnalysis.negative > 30) {
      highlights.push('Significant negative feedback')
      recommendations.push('Address common concerns in negative reviews')
    }
    
    // Category recommendations
    const categoryAverages = analytics.categoryAverages
    const lowestCategory = Object.entries(categoryAverages)
      .sort(([, a], [, b]) => a - b)[0]
    
    if (lowestCategory && lowestCategory[1] < 4.0) {
      recommendations.push(`Focus on improving ${lowestCategory[0]} (${lowestCategory[1].toFixed(1)}/5.0)`)
    }
    
    return { summary, highlights, recommendations }
  }

  // Check if review needs moderation
  static needsModeration(review: { rating: number; title: string; content: string }): boolean {
    // Flag for manual review if:
    // 1. Very low rating with short content (potential spam)
    // 2. Contains excessive caps
    // 3. Very long content (potential spam)
    // 4. Contains certain keywords
    
    const suspiciousKeywords = ['spam', 'fake', 'bot', 'scam', 'fraud']
    const text = `${review.title} ${review.content}`.toLowerCase()
    
    // Low rating with minimal content
    if (review.rating <= 2 && review.content.length < 20) {
      return true
    }
    
    // Excessive caps
    const capsRatio = (review.content.match(/[A-Z]/g) || []).length / review.content.length
    if (capsRatio > 0.5 && review.content.length > 10) {
      return true
    }
    
    // Very long content
    if (review.content.length > 2000) {
      return true
    }
    
    // Suspicious keywords
    if (suspiciousKeywords.some(keyword => text.includes(keyword))) {
      return true
    }
    
    return false
  }
}

// Utility functions

export function formatRatingChange(change: number): string {
  if (change > 0) return `+${change.toFixed(1)}`
  if (change < 0) return change.toFixed(1)
  return '0.0'
}

export function getRatingTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '📈'
    case 'down': return '📉'
    case 'stable': return '➡️'
  }
}

export function getSentimentColor(sentiment: 'positive' | 'negative' | 'neutral'): string {
  switch (sentiment) {
    case 'positive': return 'text-green-600'
    case 'negative': return 'text-red-600'
    case 'neutral': return 'text-gray-600'
  }
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`
}