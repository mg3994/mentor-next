import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { systemHealthService } from '@/lib/system-health'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

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
    const includeHistory = searchParams.get('history') === 'true'
    const includeAlerts = searchParams.get('alerts') === 'true'

    // Get system health
    const health = await systemHealthService.getSystemHealth()

    const response: any = {
      success: true,
      health,
    }

    // Include historical data if requested
    if (includeHistory) {
      response.history = await systemHealthService.getHealthHistory(24)
    }

    // Include alerts if requested
    if (includeAlerts) {
      response.alerts = await systemHealthService.getSystemAlerts()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Get system health error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get system health',
        success: false,
      },
      { status: 500 }
    )
  }
}