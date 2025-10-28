'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  MessageSquare,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Filter,
  Download,
  Eye
} from 'lucide-react'
import { 
  ReviewAnalyticsService, 
  type ReviewAnalytics, 
  formatRatingChange, 
  getRatingTrendIcon, 
  getSentimentColor, 
  formatPercentage 
} from '@/lib/review-analytics'

interface ReviewManagementDashboardProps {
  mentorId: string
  mentorName: string
}

export default function ReviewManagementDashboard({ 
  mentorId, 
  mentorName 
}: ReviewManagementDashboardProps) {
  const [analytics, setAnalytics] = useState<ReviewAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m')

  useEffect(() => {
    loadAnalytics()
  }, [mentorId])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const analyticsData = await ReviewAnalyticsService.calculateMentorAnalytics(mentorId)
      setAnalytics(analyticsData)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const renderRatingStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5'
    }

    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="flex items-center space-x-0.5">
        {Array.from({ length: fullStars }).map((_, i) => (
          <Star key={`full-${i}`} className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`} />
        ))}
        {hasHalfStar && (
          <Star className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400 opacity-50`} />
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Star key={`empty-${i}`} className={`${sizeClasses[size]} text-gray-300`} />
        ))}
      </div>
    )
  }

  const renderRatingDistribution = () => {
    if (!analytics) return null

    return (
      <div className="space-y-3">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = analytics.ratingDistribution[rating] || 0
          const percentage = analytics.totalReviews > 0 ? (count / analytics.totalReviews) * 100 : 0
          
          return (
            <div key={rating} className="flex items-center space-x-3">
              <span className="w-4 text-sm font-medium">{rating}</span>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-400 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-sm text-gray-600">{count}</span>
              <span className="w-12 text-xs text-gray-500">{percentage.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthlyTrend = () => {
    if (!analytics || analytics.monthlyStats.length === 0) return null

    const recentMonths = analytics.monthlyStats.slice(-6) // Last 6 months

    return (
      <div className="space-y-3">
        {recentMonths.map((month, index) => (
          <div key={`${month.year}-${month.month}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">{month.month} {month.year}</div>
              <div className="text-sm text-gray-600">{month.totalReviews} reviews</div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2">
                {renderRatingStars(month.averageRating, 'sm')}
                <span className="font-medium">{month.averageRating.toFixed(1)}</span>
              </div>
              {index > 0 && (
                <div className={`text-xs flex items-center space-x-1 ${
                  month.ratingChange > 0 ? 'text-green-600' : 
                  month.ratingChange < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {month.ratingChange > 0 ? <TrendingUp className="h-3 w-3" /> : 
                   month.ratingChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  <span>{formatRatingChange(month.ratingChange)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderCategoryBreakdown = () => {
    if (!analytics) return null

    const categories = [
      { key: 'communication', label: 'Communication', icon: MessageSquare },
      { key: 'expertise', label: 'Expertise', icon: Star },
      { key: 'helpfulness', label: 'Helpfulness', icon: Users },
      { key: 'preparation', label: 'Preparation', icon: CheckCircle }
    ]

    return (
      <div className="grid grid-cols-2 gap-4">
        {categories.map(({ key, label, icon: Icon }) => {
          const rating = analytics.categoryAverages[key as keyof typeof analytics.categoryAverages]
          const percentage = (rating / 5) * 100
          
          return (
            <div key={key} className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Icon className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{rating.toFixed(1)}</span>
                  <span className="text-sm text-gray-600">/5.0</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      rating >= 4.5 ? 'bg-green-500' :
                      rating >= 4.0 ? 'bg-blue-500' :
                      rating >= 3.0 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderTopKeywords = () => {
    if (!analytics || analytics.topKeywords.length === 0) return null

    return (
      <div className="space-y-2">
        {analytics.topKeywords.slice(0, 10).map((keyword, index) => (
          <div key={keyword.keyword} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">#{index + 1}</span>
              <span className="text-sm">{keyword.keyword}</span>
              <Badge 
                variant="outline" 
                className={`text-xs ${getSentimentColor(keyword.sentiment)}`}
              >
                {keyword.sentiment}
              </Badge>
            </div>
            <span className="text-sm text-gray-600">{keyword.frequency}</span>
          </div>
        ))}
      </div>
    )
  }

  const renderRecentActivity = () => {
    if (!analytics || analytics.recentActivity.length === 0) return null

    return (
      <div className="space-y-3">
        {analytics.recentActivity.map((activity, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${
              activity.action === 'created' ? 'bg-green-500' :
              activity.action === 'updated' ? 'bg-blue-500' : 'bg-red-500'
            }`} />
            <div className="flex-1">
              <div className="text-sm">
                Review {activity.action} - {activity.rating} stars
              </div>
              <div className="text-xs text-gray-600">
                {new Date(activity.date).toLocaleDateString()}
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading review analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Review Data</h3>
          <p className="text-gray-600">Analytics will appear here once you receive reviews</p>
        </CardContent>
      </Card>
    )
  }

  const formattedAnalytics = ReviewAnalyticsService.formatAnalyticsForDisplay(analytics)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Analytics</h1>
          <p className="text-gray-600">{formattedAnalytics.summary}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-600">Average Rating</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold">{analytics.averageRating.toFixed(1)}</p>
                  <span className="text-lg">{getRatingTrendIcon(analytics.ratingTrend)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total Reviews</p>
                <p className="text-2xl font-bold">{analytics.totalReviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Positive Sentiment</p>
                <p className="text-2xl font-bold">{formatPercentage(analytics.sentimentAnalysis.positive)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Rating Trend</p>
                <p className="text-2xl font-bold capitalize">{analytics.ratingTrend}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Highlights and Recommendations */}
      {(formattedAnalytics.highlights.length > 0 || formattedAnalytics.recommendations.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formattedAnalytics.highlights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-600">Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {formattedAnalytics.highlights.map((highlight, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {formattedAnalytics.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-600">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {formattedAnalytics.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="distribution" className="space-y-4">
        <TabsList>
          <TabsTrigger value="distribution">Rating Distribution</TabsTrigger>
          <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
          <TabsTrigger value="categories">Category Breakdown</TabsTrigger>
          <TabsTrigger value="keywords">Top Keywords</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {renderRatingDistribution()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Rating Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {renderMonthlyTrend()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {renderCategoryBreakdown()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords">
          <Card>
            <CardHeader>
              <CardTitle>Most Mentioned Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTopKeywords()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Review Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {renderRecentActivity()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}