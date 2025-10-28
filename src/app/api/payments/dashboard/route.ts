import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('type') || 'mentee' // 'mentee' or 'mentor'
    const period = searchParams.get('period') || 'month' // 'week', 'month', 'year'

    let dashboard: any = {}

    if (userType === 'mentee') {
      dashboard = await getMenteeDashboard(session.user.id, period)
    } else if (userType === 'mentor') {
      dashboard = await getMentorDashboard(session.user.id, period)
    } else {
      return NextResponse.json(
        { error: 'Invalid user type. Must be "mentee" or "mentor"' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      dashboard,
      userType,
      period,
    })

  } catch (error) {
    console.error('Payment dashboard error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to load payment dashboard',
        success: false,
      },
      { status: 500 }
    )
  }
}

async function getMenteeDashboard(userId: string, period: string) {
  const dateRange = getDateRange(period)

  // Get all transactions for mentee
  const transactions = await prisma.transaction.findMany({
    where: {
      session: {
        menteeId: userId,
      },
      status: 'COMPLETED',
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      session: {
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  })

  // Categorize by pricing model
  const oneTimePayments = transactions.filter((t: any) => t.session.pricingType === 'ONE_TIME')
  const hourlyPayments = transactions.filter((t: any) => t.session.pricingType === 'HOURLY')
  const subscriptionPayments = transactions.filter((t: any) => t.session.pricingType === 'MONTHLY_SUBSCRIPTION')

  // Calculate totals
  const totalSpent = transactions.reduce((sum: number, t: any) => sum + t.amount, 0)
  const oneTimeTotal = oneTimePayments.reduce((sum: number, t: any) => sum + t.amount, 0)
  const hourlyTotal = hourlyPayments.reduce((sum: number, t: any) => sum + t.amount, 0)
  const subscriptionTotal = subscriptionPayments.reduce((sum: number, t: any) => sum + t.amount, 0)

  // Get active subscriptions
  const activeSubscriptions = await getActiveSubscriptions(userId)

  // Get upcoming sessions
  const upcomingSessions = await prisma.session.findMany({
    where: {
      menteeId: userId,
      status: 'SCHEDULED',
      startTime: {
        gte: new Date(),
      },
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      transaction: true,
    },
    orderBy: { startTime: 'asc' },
    take: 5,
  })

  return {
    summary: {
      totalSpent,
      totalSessions: transactions.length,
      activeSubscriptions: activeSubscriptions.length,
      upcomingSessions: upcomingSessions.length,
    },
    breakdown: {
      oneTime: {
        total: oneTimeTotal,
        count: oneTimePayments.length,
        percentage: totalSpent > 0 ? (oneTimeTotal / totalSpent) * 100 : 0,
      },
      hourly: {
        total: hourlyTotal,
        count: hourlyPayments.length,
        percentage: totalSpent > 0 ? (hourlyTotal / totalSpent) * 100 : 0,
      },
      subscription: {
        total: subscriptionTotal,
        count: subscriptionPayments.length,
        percentage: totalSpent > 0 ? (subscriptionTotal / totalSpent) * 100 : 0,
      },
    },
    recentTransactions: transactions.slice(0, 10),
    activeSubscriptions,
    upcomingSessions,
  }
}

async function getMentorDashboard(userId: string, period: string) {
  const dateRange = getDateRange(period)

  // Get all transactions for mentor
  const transactions = await prisma.transaction.findMany({
    where: {
      session: {
        mentorId: userId,
      },
      status: 'COMPLETED',
      completedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    include: {
      session: {
        include: {
          mentee: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  })

  // Categorize by pricing model
  const oneTimeEarnings = transactions.filter((t: any) => t.session.pricingType === 'ONE_TIME')
  const hourlyEarnings = transactions.filter((t: any) => t.session.pricingType === 'HOURLY')
  const subscriptionEarnings = transactions.filter((t: any) => t.session.pricingType === 'MONTHLY_SUBSCRIPTION')

  // Calculate earnings
  const totalEarnings = transactions.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
  const totalRevenue = transactions.reduce((sum: number, t: any) => sum + t.amount, 0)
  const platformFees = transactions.reduce((sum: number, t: any) => sum + t.platformFee, 0)

  const oneTimeTotal = oneTimeEarnings.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
  const hourlyTotal = hourlyEarnings.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)
  const subscriptionTotal = subscriptionEarnings.reduce((sum: number, t: any) => sum + t.mentorEarnings, 0)

  // Get mentor's active subscribers
  const activeSubscribers = await getActiveSubscribers(userId)

  // Get upcoming sessions
  const upcomingSessions = await prisma.session.findMany({
    where: {
      mentorId: userId,
      status: 'SCHEDULED',
      startTime: {
        gte: new Date(),
      },
    },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      transaction: true,
    },
    orderBy: { startTime: 'asc' },
    take: 5,
  })

  // Get payout history
  const payouts = await prisma.mentorPayout.findMany({
    where: {
      mentorId: userId,
      processedAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    },
    orderBy: { processedAt: 'desc' },
    take: 10,
  })

  const totalPayouts = payouts.reduce((sum: number, p: any) => sum + p.amount, 0)
  const pendingEarnings = totalEarnings - totalPayouts

  return {
    summary: {
      totalEarnings,
      totalRevenue,
      platformFees,
      totalPayouts,
      pendingEarnings,
      totalSessions: transactions.length,
      activeSubscribers: activeSubscribers.length,
      upcomingSessions: upcomingSessions.length,
    },
    breakdown: {
      oneTime: {
        earnings: oneTimeTotal,
        count: oneTimeEarnings.length,
        percentage: totalEarnings > 0 ? (oneTimeTotal / totalEarnings) * 100 : 0,
      },
      hourly: {
        earnings: hourlyTotal,
        count: hourlyEarnings.length,
        percentage: totalEarnings > 0 ? (hourlyTotal / totalEarnings) * 100 : 0,
      },
      subscription: {
        earnings: subscriptionTotal,
        count: subscriptionEarnings.length,
        percentage: totalEarnings > 0 ? (subscriptionTotal / totalEarnings) * 100 : 0,
      },
    },
    recentTransactions: transactions.slice(0, 10),
    activeSubscribers,
    upcomingSessions,
    payoutHistory: payouts,
  }
}

async function getActiveSubscriptions(menteeId: string) {
  const subscriptionLogs = await prisma.auditLog.findMany({
    where: {
      userId: menteeId,
      action: 'SUBSCRIPTION_CREATED',
      resource: 'subscription',
      createdAt: {
        gte: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // Last 31 days
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const activeSubscriptions = []

  for (const log of subscriptionLogs) {
    if (!log.details) continue

    const details = log.details as any
    const endDate = new Date(details.endDate)
    
    if (endDate > new Date()) {
      // Get mentor details
      const mentor = await prisma.user.findUnique({
        where: { id: details.mentorId },
        select: {
          id: true,
          name: true,
          image: true,
          mentorProfile: {
            select: {
              expertise: true,
              averageRating: true,
            },
          },
        },
      })

      activeSubscriptions.push({
        mentorId: details.mentorId,
        mentor,
        amount: details.amount,
        startDate: details.startDate,
        endDate: details.endDate,
        daysRemaining: Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })
    }
  }

  return activeSubscriptions
}

async function getActiveSubscribers(mentorId: string) {
  const subscriptionLogs = await prisma.auditLog.findMany({
    where: {
      action: 'SUBSCRIPTION_CREATED',
      resource: 'subscription',
      details: {
        path: ['mentorId'],
        equals: mentorId,
      },
      createdAt: {
        gte: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // Last 31 days
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const activeSubscribers = []

  for (const log of subscriptionLogs) {
    if (!log.details || !log.userId) continue

    const details = log.details as any
    const endDate = new Date(details.endDate)
    
    if (endDate > new Date()) {
      // Get mentee details
      const mentee = await prisma.user.findUnique({
        where: { id: log.userId },
        select: {
          id: true,
          name: true,
          image: true,
        },
      })

      activeSubscribers.push({
        menteeId: log.userId,
        mentee,
        amount: details.amount,
        startDate: details.startDate,
        endDate: details.endDate,
        daysRemaining: Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })
    }
  }

  return activeSubscribers
}

function getDateRange(period: string) {
  const now = new Date()
  let start: Date
  let end: Date = new Date(now)

  switch (period) {
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'year':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return { start, end }
}