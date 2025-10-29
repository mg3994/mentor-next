import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { earningsAnalyticsService } from '@/lib/earnings-analytics'
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

    // Get payout analytics
    const payoutAnalytics = await earningsAnalyticsService.getMentorPayoutAnalytics(session.user.id)

    return NextResponse.json({
      success: true,
      payoutAnalytics,
    })

  } catch (error) {
    console.error('Get payout analytics error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get payout analytics',
        success: false,
      },
      { status: 500 }
    )
  }
}