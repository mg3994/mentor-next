import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
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

    // Get mentor and session statistics
    const [
      pendingMentorApplications,
      totalSessions,
      completedSessions,
      totalRevenue,
    ] = await Promise.all([
      // Pending mentor applications
      prisma.mentorProfile.count({
        where: {
          isVerified: false,
          user: {
            roles: {
              some: {
                role: Role.MENTOR,
                status: 'PENDING',
              },
            },
          },
        },
      }),
      
      // Total sessions
      prisma.session.count(),
      
      // Completed sessions
      prisma.session.count({
        where: {
          status: 'COMPLETED',
        },
      }),
      
      // Total revenue (sum of all completed transactions)
      prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),
    ])

    const stats = {
      pendingMentorApplications,
      totalSessions,
      completedSessions,
      totalRevenue: totalRevenue._sum.amount || 0,
    }

    return NextResponse.json({
      success: true,
      stats,
    })

  } catch (error) {
    console.error('Get mentor stats error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get mentor stats',
        success: false,
      },
      { status: 500 }
    )
  }
}