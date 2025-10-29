'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Star,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Loader2,
  AlertTriangle,
  Database,
  Wifi,
  Server
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface PlatformAnalytics {
  userMetrics: {
    totalUsers: number
    activeUsers: number
    newUsersToday: number
    newUsersThisWeek: number
    newUsersThisMonth: number
    userGrowthRate: number
    mentorCount: number
    menteeCount: number
    verifiedMentors: number
    pendingMentors: number
  }
  sessionMetrics: {
    totalSessions: number
    completedSessions: number
    cancelledSessions: number
    noShowSessions: number
    averageSessionDuration: number
    sessionCompletionRate: number
    sessionsToday: number
    sessionsThisWeek: number
    sessionsThisMonth: number
    sessionGrowthRate: number
  }
  revenueMetrics: {
    totalRevenue: number
    monthlyRevenue: number
    weeklyRevenue: number
    dailyRevenue: number
    averageTransactionValue: number
    totalTransactions: number
    revenueGrowthRate: number
    platformFees: number
    mentorEarnings: number
  }
  engagementMetrics: {
    averageRating: number
    totalReviews: number
    positiveReviews: number
    negativeReviews: number
    repeatBookingRate: number
    userRetentionRate: number
    averageSessionsPerUser: number
  }
  systemHealth: {
    databaseStatus: 'healthy' | 'warning' | 'error'
    redisStatus: 'healthy' | 'warning' | 'error'
    apiResponseTime: number
    errorRate: number
    uptime: number
    activeConnections: number
  }
}

export default function PlatformAnalytics() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/analytics/platform')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      
      const data = await response.json()
      setAnalytics(data.analytics)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load analytics data</p>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Platform Analytics</h2>
        <p className="text-muted-foreground">
          Comprehensive platform metrics and system health monitoring
        </p>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.userMetrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.userMetrics.userGrowthRate.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.sessionMetrics.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.sessionMetrics.sessionCompletionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.revenueMetrics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              +{analytics.revenueMetrics.revenueGrowthRate.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.engagementMetrics.averageRating.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {analytics.engagementMetrics.totalReviews} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>
            Current system status and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span className="text-sm">Database</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(analytics.systemHealth.databaseStatus)}
                <span className={`text-sm capitalize ${getStatusColor(analytics.systemHealth.databaseStatus)}`}>
                  {analytics.systemHealth.databaseStatus}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4" />
                <span className="text-sm">Redis Cache</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(analytics.systemHealth.redisStatus)}
                <span className={`text-sm capitalize ${getStatusColor(analytics.systemHealth.redisStatus)}`}>
                  {analytics.systemHealth.redisStatus}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4" />
                <span className="text-sm">API Response</span>
              </div>
              <span className="text-sm font-medium">
                {analytics.systemHealth.apiResponseTime.toFixed(0)}ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Uptime</span>
              <span className="text-sm font-medium">
                {analytics.systemHealth.uptime.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Error Rate</span>
              <span className="text-sm font-medium">
                {analytics.systemHealth.errorRate.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Active Connections</span>
              <span className="text-sm font-medium">
                {analytics.systemHealth.activeConnections}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>
              User registration and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm">Active Users</span>
                <span className="font-medium">{analytics.userMetrics.activeUsers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">New Users Today</span>
                <span className="font-medium">{analytics.userMetrics.newUsersToday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">New Users This Week</span>
                <span className="font-medium">{analytics.userMetrics.newUsersThisWeek}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">New Users This Month</span>
                <span className="font-medium">{analytics.userMetrics.newUsersThisMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Mentors</span>
                <span className="font-medium">{analytics.userMetrics.mentorCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Verified Mentors</span>
                <span className="font-medium">{analytics.userMetrics.verifiedMentors}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Performance</CardTitle>
            <CardDescription>
              Session completion and quality metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm">Completion Rate</span>
                <span className="font-medium">
                  {analytics.sessionMetrics.sessionCompletionRate.toFixed(1)}%
                </span>
              </div>
              <Progress value={analytics.sessionMetrics.sessionCompletionRate} className="h-2" />
              
              <div className="flex justify-between">
                <span className="text-sm">Avg Duration</span>
                <span className="font-medium">
                  {Math.round(analytics.sessionMetrics.averageSessionDuration)} min
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Sessions Today</span>
                <span className="font-medium">{analytics.sessionMetrics.sessionsToday}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Sessions This Month</span>
                <span className="font-medium">{analytics.sessionMetrics.sessionsThisMonth}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Cancelled Sessions</span>
                <span className="font-medium">{analytics.sessionMetrics.cancelledSessions}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Analytics</CardTitle>
          <CardDescription>
            Platform revenue and transaction metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.revenueMetrics.monthlyRevenue)}
              </div>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(analytics.revenueMetrics.weeklyRevenue)}
              </div>
              <p className="text-sm text-muted-foreground">Weekly Revenue</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(analytics.revenueMetrics.platformFees)}
              </div>
              <p className="text-sm text-muted-foreground">Platform Fees</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(analytics.revenueMetrics.averageTransactionValue)}
              </div>
              <p className="text-sm text-muted-foreground">Avg Transaction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>User Engagement</CardTitle>
          <CardDescription>
            User satisfaction and retention metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {analytics.engagementMetrics.averageRating.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground">Average Rating</p>
              <div className="flex justify-center mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-4 w-4 ${
                      i < Math.floor(analytics.engagementMetrics.averageRating) 
                        ? 'text-yellow-400 fill-current' 
                        : 'text-gray-300'
                    }`} 
                  />
                ))}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {analytics.engagementMetrics.repeatBookingRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">Repeat Booking Rate</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {analytics.engagementMetrics.userRetentionRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">User Retention</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}