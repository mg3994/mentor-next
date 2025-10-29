// Enhanced Earnings Analytics Service
import { prisma } from './db'

export interface EarningsAnalytics {
  totalEarnings: number
  monthlyEarnings: number
  weeklyEarnings: number
  dailyEarnings: number
  sessionCount: number
  averageSessionEarning: number
  topPerformingDays: Array<{ date: string; earnings: number }>
  earningsTrend: Array<{ period: string; earnings: number }>
  paymentMethodBreakdown: Array<{ method: string; earnings: number; count: number }>
  pricingModelBreakdown: Array<{ type: string; earnings: number; count: number }>
  subscriptionMetrics: {
    activeSubscriptions: number
    monthlyRecurringRevenue: number
    churnRate: number
    averageSubscriptionValue: number
  }
  hourlyMetrics: {
    totalHours: number
    averageHourlyRate: number
    utilizationRate: number
  }
}

export interface EarningsComparison {
  currentPeriod: number
  previousPeriod: number
  growthRate: number
  growthAmount: number
}

export interface PayoutAnalytics {
  totalPayouts: number
  pendingPayouts: number
  completedPayouts: number
  averagePayoutAmount: number
  payoutFrequency: string
  nextPayoutDate: Date | null
  payoutHistory: Array<{
    date: Date
    amount: number
    status: string
    method: string
  }>
}

export class EarningsAnalyticsService {
  async getMentorEarningsAnalytics(
    mentorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EarningsAnalytics> {
    const now = new Date()
    const defaultStartDate = startDate || new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const defaultEndDate = endDate || now

    // Get transactions with session data
    const transactions = await prisma.transaction.findMany({
      where: {
        session: {
          mentorId,
        },
        status: 'COMPLETED',
        completedAt: {
          gte: defaultStartDate,
          lte: defaultEndDate,
        },
      },
      include: {
        session: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
    })

    // Get subscription data
    const subscriptions = await prisma.subscription.findMany({
      where: {
        mentorId,
        status: 'ACTIVE',
      },
    })

    // Calculate basic metrics
    const totalEarnings = transactions.reduce((sum, t) => sum + t.mentorEarnings, 0)
    const sessionCount = transactions.length
    const averageSessionEarning = sessionCount > 0 ? totalEarnings / sessionCount : 0

    // Calculate period-specific earnings
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const monthlyEarnings = transactions
      .filter(t => t.completedAt && t.completedAt >= monthStart && t.completedAt <= monthEnd)
      .reduce((sum, t) => sum + t.mentorEarnings, 0)

    const weeklyEarnings = transactions
      .filter(t => t.completedAt && t.completedAt >= weekStart)
      .reduce((sum, t) => sum + t.mentorEarnings, 0)

    const dailyEarnings = transactions
      .filter(t => t.completedAt && t.completedAt >= dayStart)
      .reduce((sum, t) => sum + t.mentorEarnings, 0)

    // Calculate top performing days
    const dailyEarningsMap = new Map<string, number>()
    transactions.forEach(t => {
      if (t.completedAt) {
        const dateKey = t.completedAt.toISOString().split('T')[0]
        dailyEarningsMap.set(dateKey, (dailyEarningsMap.get(dateKey) || 0) + t.mentorEarnings)
      }
    })

    const topPerformingDays = Array.from(dailyEarningsMap.entries())
      .map(([date, earnings]) => ({ date, earnings }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10)

    // Calculate earnings trend (last 12 months)
    const earningsTrend = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthTransactions = transactions.filter(t => 
        t.completedAt && t.completedAt >= monthStart && t.completedAt <= monthEnd
      )
      
      const earnings = monthTransactions.reduce((sum, t) => sum + t.mentorEarnings, 0)
      
      earningsTrend.push({
        period: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        earnings,
      })
    }

    // Payment method breakdown
    const paymentMethodMap = new Map<string, { earnings: number; count: number }>()
    transactions.forEach(t => {
      const method = t.paymentMethod || 'unknown'
      const current = paymentMethodMap.get(method) || { earnings: 0, count: 0 }
      paymentMethodMap.set(method, {
        earnings: current.earnings + t.mentorEarnings,
        count: current.count + 1,
      })
    })

    const paymentMethodBreakdown = Array.from(paymentMethodMap.entries())
      .map(([method, data]) => ({ method, ...data }))

    // Pricing model breakdown
    const pricingModelMap = new Map<string, { earnings: number; count: number }>()
    transactions.forEach(t => {
      if (t.session) {
        const type = t.session.pricingType || 'unknown'
        const current = pricingModelMap.get(type) || { earnings: 0, count: 0 }
        pricingModelMap.set(type, {
          earnings: current.earnings + t.mentorEarnings,
          count: current.count + 1,
        })
      }
    })

    const pricingModelBreakdown = Array.from(pricingModelMap.entries())
      .map(([type, data]) => ({ type, ...data }))

    // Subscription metrics
    const activeSubscriptions = subscriptions.length
    const monthlyRecurringRevenue = subscriptions.reduce((sum: number, s: any) => {
      const platformFee = s.amount * 0.05
      return sum + (s.amount - platformFee)
    }, 0)

    const churnRate = 0 // Placeholder
    const averageSubscriptionValue = activeSubscriptions > 0 ? monthlyRecurringRevenue / activeSubscriptions : 0

    // Hourly metrics
    const hourlyTransactions = transactions.filter(t => t.session?.pricingType === 'HOURLY')
    const totalHours = hourlyTransactions.length * 1 // Simplified: assume 1 hour per session
    const hourlyEarnings = hourlyTransactions.reduce((sum, t) => sum + t.mentorEarnings, 0)
    const averageHourlyRate = totalHours > 0 ? hourlyEarnings / totalHours : 0
    const utilizationRate = 0.75 // Placeholder

    return {
      totalEarnings,
      monthlyEarnings,
      weeklyEarnings,
      dailyEarnings,
      sessionCount,
      averageSessionEarning,
      topPerformingDays,
      earningsTrend,
      paymentMethodBreakdown,
      pricingModelBreakdown,
      subscriptionMetrics: {
        activeSubscriptions,
        monthlyRecurringRevenue,
        churnRate,
        averageSubscriptionValue,
      },
      hourlyMetrics: {
        totalHours,
        averageHourlyRate,
        utilizationRate,
      },
    }
  }

  async compareEarningsPeriods(
    mentorId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<EarningsComparison> {
    const [currentTransactions, previousTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          session: { mentorId },
          status: 'COMPLETED',
          completedAt: {
            gte: currentStart,
            lte: currentEnd,
          },
        },
      }),
      prisma.transaction.findMany({
        where: {
          session: { mentorId },
          status: 'COMPLETED',
          completedAt: {
            gte: previousStart,
            lte: previousEnd,
          },
        },
      }),
    ])

    const currentPeriod = currentTransactions.reduce((sum, t) => sum + t.mentorEarnings, 0)
    const previousPeriod = previousTransactions.reduce((sum, t) => sum + t.mentorEarnings, 0)
    
    const growthAmount = currentPeriod - previousPeriod
    const growthRate = previousPeriod > 0 ? (growthAmount / previousPeriod) * 100 : 0

    return {
      currentPeriod,
      previousPeriod,
      growthRate,
      growthAmount,
    }
  }

  async getMentorPayoutAnalytics(mentorId: string): Promise<PayoutAnalytics> {
    const payouts = await prisma.mentorPayout.findMany({
      where: { mentorId },
      orderBy: { createdAt: 'desc' },
    })

    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0)
    const pendingPayouts = payouts
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0)
    const completedPayouts = payouts
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0)
    
    const averagePayoutAmount = payouts.length > 0 ? totalPayouts / payouts.length : 0

    // Calculate next payout date (assuming weekly payouts)
    const lastPayout = payouts.find(p => p.status === 'COMPLETED')
    const nextPayoutDate = lastPayout && lastPayout.processedAt
      ? new Date(lastPayout.processedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const payoutHistory = payouts.slice(0, 20).map(p => ({
      date: p.processedAt || p.createdAt,
      amount: p.amount,
      status: p.status,
      method: p.payoutMethod || 'bank_transfer',
    }))

    return {
      totalPayouts,
      pendingPayouts,
      completedPayouts,
      averagePayoutAmount,
      payoutFrequency: 'weekly',
      nextPayoutDate,
      payoutHistory,
    }
  }

  async generateTaxReport(mentorId: string, taxYear: number) {
    const startDate = new Date(taxYear, 0, 1)
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59)

    const transactions = await prisma.transaction.findMany({
      where: {
        session: { mentorId },
        status: 'COMPLETED',
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        session: {
          include: {
            mentee: {
              select: { name: true, email: true },
            },
          },
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    })

    const totalEarnings = transactions.reduce((sum, t) => sum + t.mentorEarnings, 0)
    const totalSessions = transactions.length
    const totalPlatformFees = transactions.reduce((sum, t) => sum + t.platformFee, 0)
    const grossRevenue = transactions.reduce((sum, t) => sum + t.amount, 0)

    // Monthly breakdown
    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const monthTransactions = transactions.filter(t => 
        t.completedAt && t.completedAt.getMonth() === i
      )
      
      return {
        month,
        monthName: new Date(taxYear, i, 1).toLocaleString('default', { month: 'long' }),
        earnings: monthTransactions.reduce((sum, t) => sum + t.mentorEarnings, 0),
        sessions: monthTransactions.length,
        grossRevenue: monthTransactions.reduce((sum, t) => sum + t.amount, 0),
      }
    })

    // Payment method breakdown
    const paymentMethods = transactions.reduce((acc, t) => {
      const method = t.paymentMethod || 'unknown'
      acc[method] = (acc[method] || 0) + t.mentorEarnings
      return acc
    }, {} as Record<string, number>)

    return {
      taxYear,
      mentorId,
      reportGeneratedAt: new Date(),
      summary: {
        totalEarnings,
        totalSessions,
        totalPlatformFees,
        grossRevenue,
        netEarnings: totalEarnings,
      },
      monthlyBreakdown,
      paymentMethods,
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.completedAt,
        amount: t.amount,
        platformFee: t.platformFee,
        earnings: t.mentorEarnings,
        paymentMethod: t.paymentMethod,
        sessionId: t.sessionId,
        menteeName: t.session?.mentee?.name,
        menteeEmail: t.session?.mentee?.email,
      })),
    }
  }
}

export const earningsAnalyticsService = new EarningsAnalyticsService()