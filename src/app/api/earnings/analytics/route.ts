import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { earningsAnalyticsService } from '@/lib/earnings-analytics'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional(),
  compare: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is a mentor
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: session.user.id,
        role: 'MENTOR',
        status: 'ACTIVE',
      },
    })

    if (userRoles.length === 0) {
      return NextResponse.json(
        { error: 'Mentor access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      period: searchParams.get('period'),
      compare: searchParams.get('compare') === 'true',
    }

    // Validate query parameters
    const validatedParams = analyticsQuerySchema.safeParse(queryParams)
    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedParams.error.issues },
        { status: 400 }
      )
    }

    const { startDate, endDate, period, compare } = validatedParams.data

    // Parse dates
    const parsedStartDate = startDate ? new Date(startDate) : undefined
    const parsedEndDate = endDate ? new Date(endDate) : undefined

    // Get earnings analytics
    const analytics = await earningsAnalyticsService.getMentorEarningsAnalytics(
      session.user.id,
      parsedStartDate,
      parsedEndDate
    )

    let comparison = null
    if (compare && parsedStartDate && parsedEndDate) {
      // Calculate previous period for comparison
      const periodLength = parsedEndDate.getTime() - parsedStartDate.getTime()
      const previousStart = new Date(parsedStartDate.getTime() - periodLength)
      const previousEnd = new Date(parsedStartDate.getTime())

      comparison = await earningsAnalyticsService.compareEarningsPeriods(
        session.user.id,
        parsedStartDate,
        parsedEndDate,
        previousStart,
        previousEnd
      )
    }

    return NextResponse.json({
      success: true,
      analytics,
      comparison,
      period: {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      },
    })

  } catch (error) {
    console.error('Get earnings analytics error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get earnings analytics',
        success: false,
      },
      { status: 500 }
    )
  }
}