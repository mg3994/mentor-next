'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Star, 
  StarHalf,
  MessageSquare,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { ReviewService, type ReviewFormData, type ReviewData } from '@/lib/review-service'

interface PostSessionReviewProps {
  sessionId: string
  mentorName: string
  sessionTopic: string
  sessionDate: Date
  onReviewSubmitted?: (review: ReviewData) => void
  onReviewUpdated?: (review: ReviewData) => void
}

export default function PostSessionReview({
  sessionId,
  mentorName,
  sessionTopic,
  sessionDate,
  onReviewSubmitted,
  onReviewUpdated
}: PostSessionReviewProps) {
  const [canReview, setCanReview] = useState(false)
  const [existingReview, setExistingReview] = useState<ReviewData | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [categories, setCategories] = useState({
    communication: 0,
    expertise: 0,
    helpfulness: 0,
    preparation: 0
  })

  useEffect(() => {
    checkReviewEligibility()
  }, [sessionId])

  const checkReviewEligibility = async () => {
    try {
      setLoading(true)
      const result = await ReviewService.canReviewSession(sessionId)
      
      setCanReview(result.canReview)
      
      if (result.existingReview) {
        setExistingReview(result.existingReview)
        setCanEdit(result.canEdit === true)
        
        // Populate form with existing review data
        setRating(result.existingReview.rating)
        setTitle(result.existingReview.title)
        setContent(result.existingReview.content)
        setIsAnonymous(result.existingReview.isAnonymous)
        setIsPublic(result.existingReview.isPublic)
        
        // Parse categories if they exist
        if (result.existingReview.categories && typeof result.existingReview.categories === 'string') {
          try {
            const parsedCategories = JSON.parse(result.existingReview.categories)
            setCategories(parsedCategories)
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
      
      if (!result.canReview && result.reason) {
        setError(result.reason)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check review eligibility')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const reviewData: ReviewFormData = {
        rating,
        title: title.trim(),
        content: content.trim(),
        isAnonymous,
        isPublic,
        categories: Object.values(categories).some(v => v > 0) ? categories : undefined
      }

      // Validate form
      const validation = ReviewService.validateReview(reviewData)
      if (!validation.isValid) {
        setError(validation.errors.join(', '))
        return
      }

      let result: ReviewData

      if (existingReview && isEditing) {
        // Update existing review
        result = await ReviewService.updateReview(existingReview.id, reviewData)
        setSuccess('Review updated successfully!')
        onReviewUpdated?.(result)
      } else {
        // Create new review
        result = await ReviewService.submitReview(sessionId, reviewData)
        setSuccess('Review submitted successfully!')
        onReviewSubmitted?.(result)
      }

      setExistingReview(result)
      setIsEditing(false)
      setCanEdit(ReviewService.canEditReview(result))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!existingReview || !window.confirm('Are you sure you want to delete this review?')) {
      return
    }

    try {
      setSubmitting(true)
      await ReviewService.deleteReview(existingReview.id)
      
      setExistingReview(null)
      setCanReview(true)
      setIsEditing(false)
      
      // Reset form
      setRating(0)
      setTitle('')
      setContent('')
      setIsAnonymous(false)
      setIsPublic(true)
      setCategories({ communication: 0, expertise: 0, helpfulness: 0, preparation: 0 })
      
      setSuccess('Review deleted successfully!')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete review')
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (currentRating: number, onRate?: (rating: number) => void, onHover?: (rating: number) => void) => {
    const displayRating = onHover ? hoverRating || currentRating : currentRating
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRate?.(star)}
            onMouseEnter={() => onHover?.(star)}
            onMouseLeave={() => onHover?.(0)}
            disabled={!onRate}
            className={`${onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <Star
              className={`h-6 w-6 ${
                star <= displayRating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  const renderCategoryRating = (category: keyof typeof categories, label: string) => {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setCategories(prev => ({ ...prev, [category]: star }))}
              disabled={!!(existingReview && !isEditing)}
              className="cursor-pointer hover:scale-110 transition-transform disabled:cursor-default"
            >
              <Star
                className={`h-4 w-4 ${
                  star <= categories[category]
                    ? 'fill-blue-400 text-blue-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
          <span className="text-sm text-gray-600 ml-2">
            {categories[category] > 0 ? `${categories[category]}/5` : 'Not rated'}
          </span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading review information...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!canReview && !existingReview) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Unable to review this session'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>
            {existingReview ? 'Your Review' : 'Review Your Session'}
          </span>
          {existingReview && (
            <Badge variant={existingReview.isPublic ? 'default' : 'secondary'}>
              {existingReview.isPublic ? 'Public' : 'Private'}
            </Badge>
          )}
        </CardTitle>
        
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Session with {mentorName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>{sessionTopic}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>{sessionDate.toLocaleDateString()}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Existing Review Display */}
        {existingReview && !isEditing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {renderStars(existingReview.rating)}
                <span className="text-lg font-semibold">{existingReview.rating}/5</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg">{existingReview.title}</h3>
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">{existingReview.content}</p>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                {existingReview.isAnonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{existingReview.isAnonymous ? 'Anonymous' : 'Public'}</span>
              </div>
              
              <span>•</span>
              
              <span>
                Posted {new Date(existingReview.createdAt).toLocaleDateString()}
              </span>
              
              {canEdit && (
                <>
                  <span>•</span>
                  <span className="text-blue-600">
                    {ReviewService.getEditTimeRemaining(existingReview)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Review Form */}
        {(canReview || isEditing) && (
          <div className="space-y-6">
            {/* Overall Rating */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Overall Rating *</label>
              <div className="flex items-center space-x-4">
                {renderStars(rating, setRating, setHoverRating)}
                <span className="text-lg font-semibold">
                  {rating > 0 ? `${rating}/5` : 'Select rating'}
                </span>
              </div>
              {rating > 0 && (
                <p className="text-sm text-gray-600">
                  {ReviewService.getRatingDescription(rating)}
                </p>
              )}
            </div>

            {/* Category Ratings */}
            <div className="space-y-4">
              <h4 className="font-medium">Detailed Ratings (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCategoryRating('communication', 'Communication')}
                {renderCategoryRating('expertise', 'Expertise')}
                {renderCategoryRating('helpfulness', 'Helpfulness')}
                {renderCategoryRating('preparation', 'Preparation')}
              </div>
            </div>

            {/* Review Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience..."
                maxLength={100}
              />
              <div className="text-xs text-gray-500 text-right">
                {title.length}/100 characters
              </div>
            </div>

            {/* Review Content */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Review *</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your detailed experience with this mentor..."
                rows={6}
                maxLength={2000}
              />
              <div className="text-xs text-gray-500 text-right">
                {content.length}/2000 characters
              </div>
            </div>

            {/* Privacy Options */}
            <div className="space-y-4">
              <h4 className="font-medium">Privacy Settings</h4>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Make this review public on the mentor's profile</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Post anonymously (hide my name)</span>
                </label>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating === 0 || !title.trim() || !content.trim()}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isEditing ? 'Updating...' : 'Submitting...'}
                  </>
                ) : (
                  isEditing ? 'Update Review' : 'Submit Review'
                )}
              </Button>
              
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}