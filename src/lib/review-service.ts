// Review Service
// Handles session reviews, ratings, and feedback management

export interface ReviewData {
  id: string
  sessionId: string
  mentorId: string
  menteeId: string
  rating: number
  title: string
  content: string
  isAnonymous: boolean
  isPublic: boolean
  categories?: string
  createdAt: Date
  updatedAt: Date
  mentee?: {
    id: string
    name: string
  }
  session?: {
    id: string
    topic: string
    duration: number
  }
}

export interface ReviewStats {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
  recentReviews: ReviewData[]
  topReviews: ReviewData[]
}

export interface ReviewFormData {
  rating: number
  title: string
  content: string
  isAnonymous: boolean
  isPublic: boolean
  categories?: {
    communication: number
    expertise: number
    helpfulness: number
    preparation: number
  }
}

export class ReviewService {
  // Submit a new review
  static async submitReview(sessionId: string, reviewData: ReviewFormData): Promise<ReviewData> {
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          ...reviewData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to submit review')
      }

      const result = await response.json()
      return result.review

    } catch (error) {
      console.error('Submit review error:', error)
      throw error
    }
  }

  // Update an existing review
  static async updateReview(reviewId: string, reviewData: Partial<ReviewFormData>): Promise<ReviewData> {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update review')
      }

      const result = await response.json()
      return result.review

    } catch (error) {
      console.error('Update review error:', error)
      throw error
    }
  }

  // Get reviews for a mentor
  static async getMentorReviews(
    mentorId: string,
    options: {
      limit?: number
      offset?: number
      includePrivate?: boolean
    } = {}
  ): Promise<{ reviews: ReviewData[]; total: number; stats: ReviewStats }> {
    try {
      const params = new URLSearchParams({
        mentorId,
        limit: (options.limit || 10).toString(),
        offset: (options.offset || 0).toString(),
        includePrivate: (options.includePrivate || false).toString(),
      })

      const response = await fetch(`/api/reviews?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch reviews')
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('Get mentor reviews error:', error)
      throw error
    }
  }

  // Get review for a specific session
  static async getSessionReview(sessionId: string): Promise<ReviewData | null> {
    try {
      const response = await fetch(`/api/reviews/session/${sessionId}`)

      if (response.status === 404) {
        return null // No review exists yet
      }

      if (!response.ok) {
        throw new Error('Failed to fetch session review')
      }

      const result = await response.json()
      return result.review

    } catch (error) {
      console.error('Get session review error:', error)
      throw error
    }
  }

  // Delete a review
  static async deleteReview(reviewId: string): Promise<void> {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete review')
      }

    } catch (error) {
      console.error('Delete review error:', error)
      throw error
    }
  }

  // Check if user can review a session
  static async canReviewSession(sessionId: string): Promise<{
    canReview: boolean
    reason?: string
    existingReview?: ReviewData
  }> {
    try {
      const response = await fetch(`/api/reviews/can-review/${sessionId}`)

      if (!response.ok) {
        throw new Error('Failed to check review eligibility')
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('Can review session error:', error)
      return { canReview: false, reason: 'Check failed' }
    }
  }

  // Validate review data
  static validateReview(reviewData: ReviewFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Rating validation
    if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
      errors.push('Rating must be between 1 and 5 stars')
    }

    // Title validation
    if (!reviewData.title || reviewData.title.trim().length === 0) {
      errors.push('Review title is required')
    } else if (reviewData.title.length > 100) {
      errors.push('Review title must be 100 characters or less')
    }

    // Content validation
    if (!reviewData.content || reviewData.content.trim().length === 0) {
      errors.push('Review content is required')
    } else if (reviewData.content.length < 10) {
      errors.push('Review content must be at least 10 characters')
    } else if (reviewData.content.length > 2000) {
      errors.push('Review content must be 2000 characters or less')
    }

    // Category ratings validation (if provided)
    if (reviewData.categories) {
      const categoryNames = ['communication', 'expertise', 'helpfulness', 'preparation']
      for (const category of categoryNames) {
        const rating = reviewData.categories[category as keyof typeof reviewData.categories]
        if (rating && (rating < 1 || rating > 5)) {
          errors.push(`${category} rating must be between 1 and 5 stars`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Calculate review statistics
  static calculateStats(reviews: ReviewData[]): ReviewStats {
    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recentReviews: [],
        topReviews: []
      }
    }

    const totalReviews = reviews.length
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews.forEach(review => {
      ratingDistribution[review.rating as keyof typeof ratingDistribution]++
    })

    // Get recent reviews (last 5)
    const recentReviews = reviews
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    // Get top reviews (highest rated, then most recent)
    const topReviews = reviews
      .filter(review => review.rating >= 4)
      .sort((a, b) => {
        if (a.rating !== b.rating) {
          return b.rating - a.rating
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      .slice(0, 5)

    return {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingDistribution,
      recentReviews,
      topReviews
    }
  }

  // Format rating for display
  static formatRating(rating: number): string {
    return rating.toFixed(1)
  }

  // Get rating color
  static getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'text-green-600'
    if (rating >= 3.5) return 'text-yellow-600'
    if (rating >= 2.5) return 'text-orange-600'
    return 'text-red-600'
  }

  // Get rating description
  static getRatingDescription(rating: number): string {
    if (rating >= 4.5) return 'Excellent'
    if (rating >= 3.5) return 'Good'
    if (rating >= 2.5) return 'Average'
    if (rating >= 1.5) return 'Below Average'
    return 'Poor'
  }

  // Generate star display
  static generateStarDisplay(rating: number): { fullStars: number; halfStar: boolean; emptyStars: number } {
    const fullStars = Math.floor(rating)
    const halfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0)

    return { fullStars, halfStar, emptyStars }
  }

  // Check if review can be edited
  static canEditReview(review: ReviewData): boolean {
    const now = new Date()
    const reviewDate = new Date(review.createdAt)
    const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
    
    return daysSinceReview <= 7 // Can edit within 7 days
  }

  // Get time remaining for editing
  static getEditTimeRemaining(review: ReviewData): string {
    const now = new Date()
    const reviewDate = new Date(review.createdAt)
    const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
    const daysRemaining = Math.max(0, 7 - daysSinceReview)

    if (daysRemaining === 0) return 'Editing period expired'
    if (daysRemaining < 1) {
      const hoursRemaining = Math.floor(daysRemaining * 24)
      return `${hoursRemaining} hours remaining to edit`
    }
    return `${Math.ceil(daysRemaining)} days remaining to edit`
  }
}

// Utility functions

export function createReviewFormData(
  rating: number,
  title: string,
  content: string,
  options: {
    isAnonymous?: boolean
    isPublic?: boolean
    categories?: ReviewFormData['categories']
  } = {}
): ReviewFormData {
  return {
    rating,
    title,
    content,
    isAnonymous: options.isAnonymous || false,
    isPublic: options.isPublic !== false, // Default to public
    categories: options.categories
  }
}

export function formatReviewDate(date: Date): string {
  const now = new Date()
  const reviewDate = new Date(date)
  const diffMs = now.getTime() - reviewDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return reviewDate.toLocaleDateString()
}

export function truncateReviewContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength).trim() + '...'
}