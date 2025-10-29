import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { platformAnalyticsService } from '@/lib/platform-analytics'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { z } from 'zod'

const satisfactionAnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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

    // Check if user is admin
    const isAdmin = hasRole(session.user.roles, Role.ADMIN)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    }

    // Validate query parameters
    const validatedParams = satisfactionAnalyticsQuerySchema.safeParse(queryParams)
    if (!validatedParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedParams.error.issues },
        { status: 400 }
      )
    }

    const { startDate, endDate } = validatedParams.data

    // Parse dates
    const parsedStartDate = startDate ? new Date(startDate) : undefined
    const parsedEndDate = endDate ? new Date(endDate) : undefined

    // Get user satisfaction metrics
    const satisfactionMetrics = await platformAnalyticsService.getUserSatisfactionMetrics(
      parsedStartDate,
      parsedEndDate
    )

    return NextResponse.json({
      success: true,
      satisfactionMetrics,
      period: {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      },
    })

  } catch (error) {
    console.error('Get satisfaction analytics error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get satisfaction analytics',
        success: false,
      },
      { status: 500 }
    )
  }
}