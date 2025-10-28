'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Star, 
  StarHalf,
  MessageSquare,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  SortAsc,
  Eye,
  EyeOff,
  TrendingUp
} from 'lucide-react'
import { ReviewService, type ReviewData, type ReviewStats, formatReviewDate, truncateReviewContent } from '@/lib/review-service'

interface MentorReviewsDisplayProps {
  mentorId: string
  mentorName: string
  showHeader?: boolean
  maxReviews?: number
  compact?: boolean
}

export default function MentorReviewsDisplay({
  mentorId,
  mentorName,
  showHeader = true,
  maxReviews,
  compact = false
}: MentorReviewsDisplayProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [showAllReviews, setShowAllReviews] = useState(false)

  useEffect(() => {
    loadReviews()
  }, [mentorId, sortBy, filterRating])

  const loadReviews = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await ReviewService.getMentorReviews(mentorId, {
        limit: maxReviews || (showAllReviews ? 100 : 10),
        offset: 0
      })
      
      let filteredReviews = result.reviews

      // Apply rating filter
      if (filterRating) {
        filteredReviews = filteredReviews.filter(review => review.rating === filterRating)
      }

      // Apply sorting
      filteredReviews.sort((a, b) => {
        switch (sortBy) {
          case 'newest':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          case 'oldest':
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          case 'highest':
            return b.rating - a.rating
          case 'lowest':
            return a.rating - b.rating
          default:
            return 0
        }
      })

      setReviews(filteredReviews)
      setStats(result.stats)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  const toggleReviewExpansion = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews)
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId)
    } else {
      newExpanded.add(reviewId)
    }
    setExpandedReviews(newExpanded)
  }

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5'
    }

    const { fullStars, halfStar, emptyStars } = ReviewService.generateStarDisplay(rating)

    return (
      <div className="flex items-center space-x-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`} />
        ))}
        
        {/* Half star */}
        {halfStar && (
          <StarHalf className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`} />
        )}
        
        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className={`${sizeClasses[size]} text-gray-300`} />
        ))}
      </div>
    )
  }

  const renderRatingDistribution = () => {
    if (!stats) return null

    return (
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = stats.ratingDistribution[rating] || 0
          const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
          
          return (
            <div key={rating} className="flex items-center space-x-2 text-sm">
              <span className="w-8">{rating}</span>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-400 h-2 rounded-full" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-gray-600">{count}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderReviewCard = (review: ReviewData) => {
    const isExpanded = expandedReviews.has(review.id)
    const shouldTruncate = !compact && review.content.length > 150
    const displayContent = shouldTruncate && !isExpanded 
      ? truncateReviewContent(review.content, 150)
      : review.content

    return (
      <Card key={review.id} className="mb-4">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {renderStars(review.rating)}
                  <span className="font-semibold">{review.rating}/5</span>
                  {review.isAnonymous && (
                    <Badge variant="secondary" className="text-xs">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Anonymous
                    </Badge>
                  )}
                </div>
                
                <h4 className="font-semibold text-gray-900">{review.title}</h4>
              </div>
              
              <div className="text-right text-sm text-gray-500">
                <div>{formatReviewDate(review.createdAt)}</div>
                {review.mentee && !review.isAnonymous && (
                  <div className="flex items-center space-x-1 mt-1">
                    <User className="h-3 w-3" />
                    <span>{review.mentee.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="text-gray-700">
              <p className="whitespace-pre-wrap">{displayContent}</p>
              
              {shouldTruncate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleReviewExpansion(review.id)}
                  className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-700"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Read more
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Session Info */}
            {review.session && !compact && (
              <div className="text-xs text-gray-500 border-t pt-2">
                <div className="flex items-center space-x-4">
                  <span>Session: {review.session.topic}</span>
                  {review.session.duration && (
                    <span>Duration: {Math.round(review.session.duration / 60)} minutes</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading reviews...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      {showHeader && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Reviews for {mentorName}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overall Rating */}
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-900">
                    {ReviewService.formatRating(stats.averageRating)}
                  </div>
                  <div className="flex items-center justify-center space-x-2 mt-2">
                    {renderStars(stats.averageRating, 'lg')}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Based on {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-1">
                    {ReviewService.getRatingDescription(stats.averageRating)}
                  </div>
                </div>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Rating Distribution</h4>
                {renderRatingDistribution()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Sorting */}
      {!compact && reviews.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4">
                {/* Sort Options */}
                <div className="flex items-center space-x-2">
                  <SortAsc className="h-4 w-4" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest">Highest Rated</option>
                    <option value="lowest">Lowest Rated</option>
                  </select>
                </div>

                {/* Rating Filter */}
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <select
                    value={filterRating || ''}
                    onChange={(e) => setFilterRating(e.target.value ? parseInt(e.target.value) : null)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Showing {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div>
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
              <p className="text-gray-600">
                {filterRating 
                  ? `No ${filterRating}-star reviews found`
                  : 'This mentor hasn\'t received any reviews yet'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {reviews.map(renderReviewCard)}
            
            {/* Load More Button */}
            {!showAllReviews && stats && reviews.length < stats.totalReviews && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => setShowAllReviews(true)}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Load More Reviews ({stats.totalReviews - reviews.length} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}