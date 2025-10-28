import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { earningsService } from '@/lib/earnings-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

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
    const type = searchParams.get('type') || 'summary' // 'summary', 'history', 'projections'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const pricingType = searchParams.get('pricingType')

    // Verify user is a mentor
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

    let result: any = {}

    switch (type) {
      case 'summary':
        result = await earningsService.getRealTimeEarnings(session.user.id)
        break
        
      case 'history':
        result = await earningsService.getEarningsHistory(session.user.id, {
          page,
          limit,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          pricingType: pricingType || undefined,
        })
        break
        
      case 'projections':
        const earnings = await earningsService.getRealTimeEarnings(session.user.id)
        result = {
          projectedMonthlyEarnings: earnings.projectedMonthlyEarnings,
          averageSessionEarnings: earnings.averageSessionEarnings,
          sessionsCompleted: earnings.sessionsCompleted,
          projectedAnnualEarnings: earnings.projectedMonthlyEarnings * 12,
        }
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result,
      type,
    })

  } catch (error) {
    console.error('Earnings API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get earnings data',
        success: false,
      },
      { status: 500 }
    )
  }
}