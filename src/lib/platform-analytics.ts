// Platform Analytics Service
// Provides comprehensive analytics and monitoring for the platform

import { prisma } from './db'
import { redis } from './redis'

export interface PlatformAnalytics {
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

export interface SessionCompletionMetrics {
  totalSessions: number
  completedSessions: number
  cancelledSessions: number
  noShowSessions: number
  completionRate: number
  averageDuration: number
  satisfactionScore: number
}

export interface UserSatisfactionMetrics {
  averageRating: number
  totalReviews: number
  ratingDistribution: {
    fiveStars: number
    fourStars: number
    threeStars: number
    twoStars: number
    oneStar: number
  }
  npsScore: number
  satisfactionTrend: Array<{
    period: string
    rating: number
    reviews: number
  }>
}

export class PlatformAnalyticsService {
  /**
   * Get comprehensive platform analytics
   */
  async getPlatformAnalytics(startDate?: Date, endDate?: Date): Promise<PlatformAnalytics> {
    const now = new Date()
    const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEndDate = endDate || now

    // Get cached analytics if available (cache for 5 minutes)
    const cacheKey = `platform_analytics:${defaultStartDate.toISOString()}:${defaultEndDate.toISOString()}`
    const cached = await this.getCachedData(cacheKey)
    if (cached) {
      return cached
    }

    const [userMetrics, sessionMetrics, revenueMetrics, engagementMetrics, systemHealth] = await Promise.all([
      this.getUserMetrics(defaultStartDate, defaultEndDate),
      this.getSessionMetrics(defaultStartDate, defaultEndDate),
      this.getRevenueMetrics(defaultStartDate, defaultEndDate),
      this.getEngagementMetrics(defaultStartDate, defaultEndDate),
      this.getSystemHealth(),
    ])

    const analytics: PlatformAnalytics = {
      userMetrics,
      sessionMetrics,
      revenueMetrics,
      engagementMetrics,
      systemHealth,
    }

    // Cache the results
    await this.setCachedData(cacheKey, analytics, 300) // 5 minutes

    return analytics
  }

  /**
   * Get user metrics
   */
  private async getUserMetrics(startDate: Date, endDate: Date) {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      previousMonthUsers,
      mentorCount,
      menteeCount,
      verifiedMentors,
      pendingMentors,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          roles: {
            some: {
              status: 'ACTIVE',
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: yesterday,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: lastWeek,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: lastMonth,
          },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            lt: lastMonth,
          },
        },
      }),
      prisma.user.count({
        where: {
          roles: {
            some: {
              role: 'MENTOR',
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          roles: {
            some: {
              role: 'MENTEE',
            },
          },
        },
      }),
      prisma.mentorProfile.count({
        where: {
          isVerified: true,
        },
      }),
      prisma.mentorProfile.count({
        where: {
          isVerified: false,
        },
      }),
    ])

    const userGrowthRate = previousMonthUsers > 0 
      ? ((newUsersThisMonth - previousMonthUsers) / previousMonthUsers) * 100 
      : 0

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      userGrowthRate,
      mentorCount,
      menteeCount,
      verifiedMentors,
      pendingMentors,
    }
  }

  /**
   * Get session metrics
   */
  private async getSessionMetrics(startDate: Date, endDate: Date) {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalSessions,
      completedSessions,
      cancelledSessions,
      noShowSessions,
      sessionsToday,
      sessionsThisWeek,
      sessionsThisMonth,
      previousMonthSessions,
      averageDurationResult,
    ] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.session.count({
        where: { status: 'CANCELLED' },
      }),
      prisma.session.count({
        where: { status: 'NO_SHOW' },
      }),
      prisma.session.count({
        where: {
          createdAt: {
            gte: yesterday,
          },
        },
      }),
      prisma.session.count({
        where: {
          createdAt: {
            gte: lastWeek,
          },
        },
      }),
      prisma.session.count({
        where: {
          createdAt: {
            gte: lastMonth,
          },
        },
      }),
      prisma.session.count({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            lt: lastMonth,
          },
        },
      }),
      prisma.session.aggregate({
        where: {
          status: 'COMPLETED',
          actualDuration: {
            not: null,
          },
        },
        _avg: {
          actualDuration: true,
        },
      }),
    ])

    const sessionCompletionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
    const sessionGrowthRate = previousMonthSessions > 0 
      ? ((sessionsThisMonth - previousMonthSessions) / previousMonthSessions) * 100 
      : 0
    const averageSessionDuration = averageDurationResult._avg.actualDuration || 0

    return {
      totalSessions,
      completedSessions,
      cancelledSessions,
      noShowSessions,
      averageSessionDuration,
      sessionCompletionRate,
      sessionsToday,
      sessionsThisWeek,
      sessionsThisMonth,
      sessionGrowthRate,
    }
  }

  /**
   * Get revenue metrics
   */
  private async getRevenueMetrics(startDate: Date, endDate: Date) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalRevenueResult,
      monthlyRevenueResult,
      weeklyRevenueResult,
      dailyRevenueResult,
      previousMonthRevenueResult,
      totalTransactions,
      platformFeesResult,
      mentorEarningsResult,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: weekStart },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: dayStart },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            lt: lastMonth,
          },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformFee: true },
      }),
      prisma.transaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { mentorEarnings: true },
      }),
    ])

    const totalRevenue = totalRevenueResult._sum.amount || 0
    const monthlyRevenue = monthlyRevenueResult._sum.amount || 0
    const weeklyRevenue = weeklyRevenueResult._sum.amount || 0
    const dailyRevenue = dailyRevenueResult._sum.amount || 0
    const previousMonthRevenue = previousMonthRevenueResult._sum.amount || 0
    const platformFees = platformFeesResult._sum.platformFee || 0
    const mentorEarnings = mentorEarningsResult._sum.mentorEarnings || 0

    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const revenueGrowthRate = previousMonthRevenue > 0 
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0

    return {
      totalRevenue,
      monthlyRevenue,
      weeklyRevenue,
      dailyRevenue,
      averageTransactionValue,
      totalTransactions,
      revenueGrowthRate,
      platformFees,
      mentorEarnings,
    }
  }

  /**
   * Get engagement metrics
   */
  private async getEngagementMetrics(startDate: Date, endDate: Date) {
    const [
      averageRatingResult,
      totalReviews,
      positiveReviews,
      negativeReviews,
      repeatBookings,
      totalBookings,
      userSessionCounts,
    ] = await Promise.all([
      prisma.review.aggregate({
        _avg: { rating: true },
      }),
      prisma.review.count(),
      prisma.review.count({
        where: { rating: { gte: 4 } },
      }),
      prisma.review.count({
        where: { rating: { lte: 2 } },
      }),
      prisma.session.groupBy({
        by: ['menteeId'],
        having: {
          menteeId: {
            _count: {
              gt: 1,
            },
          },
        },
        _count: {
          menteeId: true,
        },
      }),
      prisma.session.count(),
      prisma.session.groupBy({
        by: ['menteeId'],
        _count: {
          menteeId: true,
        },
      }),
    ])

    const averageRating = averageRatingResult._avg.rating || 0
    const repeatBookingRate = totalBookings > 0 ? (repeatBookings.length / totalBookings) * 100 : 0
    const averageSessionsPerUser = userSessionCounts.length > 0 
      ? userSessionCounts.reduce((sum, user) => sum + user._count.menteeId, 0) / userSessionCounts.length 
      : 0

    // Simple user retention calculation (users who had sessions in both current and previous month)
    const userRetentionRate = 75 // Placeholder - would need more complex calculation

    return {
      averageRating,
      totalReviews,
      positiveReviews,
      negativeReviews,
      repeatBookingRate,
      userRetentionRate,
      averageSessionsPerUser,
    }
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealth() {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`
      const databaseStatus: 'healthy' | 'warning' | 'error' = 'healthy'

      // Test Redis connection
      let redisStatus: 'healthy' | 'warning' | 'error' = 'healthy'
      try {
        await redis.ping()
      } catch (error) {
        redisStatus = 'error'
      }

      // Mock other metrics (in real implementation, these would come from monitoring tools)
      const apiResponseTime = Math.random() * 200 + 50 // 50-250ms
      const errorRate = Math.random() * 2 // 0-2%
      const uptime = 99.9 // 99.9%
      const activeConnections = Math.floor(Math.random() * 100) + 20 // 20-120

      return {
        databaseStatus,
        redisStatus,
        apiResponseTime,
        errorRate,
        uptime,
        activeConnections,
      }
    } catch (error) {
      return {
        databaseStatus: 'error' as const,
        redisStatus: 'error' as const,
        apiResponseTime: 0,
        errorRate: 100,
        uptime: 0,
        activeConnections: 0,
      }
    }
  }

  /**
   * Get session completion and satisfaction metrics
   */
  async getSessionCompletionMetrics(startDate?: Date, endDate?: Date): Promise<SessionCompletionMetrics> {
    const now = new Date()
    const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEndDate = endDate || now

    const [
      totalSessions,
      completedSessions,
      cancelledSessions,
      noShowSessions,
      averageDurationResult,
      averageRatingResult,
    ] = await Promise.all([
      prisma.session.count({
        where: {
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
      }),
      prisma.session.count({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
      }),
      prisma.session.count({
        where: {
          status: 'CANCELLED',
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
      }),
      prisma.session.count({
        where: {
          status: 'NO_SHOW',
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
      }),
      prisma.session.aggregate({
        where: {
          status: 'COMPLETED',
          actualDuration: { not: null },
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
        _avg: { actualDuration: true },
      }),
      prisma.review.aggregate({
        where: {
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
        _avg: { rating: true },
      }),
    ])

    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
    const averageDuration = averageDurationResult._avg.actualDuration || 0
    const satisfactionScore = averageRatingResult._avg.rating || 0

    return {
      totalSessions,
      completedSessions,
      cancelledSessions,
      noShowSessions,
      completionRate,
      averageDuration,
      satisfactionScore,
    }
  }

  /**
   * Get user satisfaction metrics
   */
  async getUserSatisfactionMetrics(startDate?: Date, endDate?: Date): Promise<UserSatisfactionMetrics> {
    const now = new Date()
    const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEndDate = endDate || now

    const [
      averageRatingResult,
      totalReviews,
      ratingCounts,
    ] = await Promise.all([
      prisma.review.aggregate({
        where: {
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
        _avg: { rating: true },
      }),
      prisma.review.count({
        where: {
          createdAt: {
            gte: defaultStartDate,
            lte: defaultEndDate,
          },
        },
      }),
      Promise.all([
        prisma.review.count({ where: { rating: 5 } }),
        prisma.review.count({ where: { rating: 4 } }),
        prisma.review.count({ where: { rating: 3 } }),
        prisma.review.count({ where: { rating: 2 } }),
        prisma.review.count({ where: { rating: 1 } }),
      ]),
    ])

    const averageRating = averageRatingResult._avg.rating || 0
    const [fiveStars, fourStars, threeStars, twoStars, oneStar] = ratingCounts

    // Calculate NPS score (simplified)
    const promoters = fiveStars + fourStars
    const detractors = oneStar + twoStars
    const npsScore = totalReviews > 0 ? ((promoters - detractors) / totalReviews) * 100 : 0

    // Generate satisfaction trend (last 6 months)
    const satisfactionTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const [monthRating, monthReviews] = await Promise.all([
        prisma.review.aggregate({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
          },
          _avg: { rating: true },
        }),
        prisma.review.count({
          where: {
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ])

      satisfactionTrend.push({
        period: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        rating: monthRating._avg.rating || 0,
        reviews: monthReviews,
      })
    }

    return {
      averageRating,
      totalReviews,
      ratingDistribution: {
        fiveStars,
        fourStars,
        threeStars,
        twoStars,
        oneStar,
      },
      npsScore,
      satisfactionTrend,
    }
  }

  /**
   * Cache helper methods
   */
  private async getCachedData(key: string): Promise<any> {
    try {
      const cached = await redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  private async setCachedData(key: string, data: any, ttl: number): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(data))
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }
}

// Export singleton instance
export const platformAnalyticsService = new PlatformAnalyticsService()