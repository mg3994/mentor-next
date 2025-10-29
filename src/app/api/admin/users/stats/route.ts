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

    // Get user statistics
    const [
      totalUsers,
      totalMentors,
      totalMentees,
      pendingVerifications,
      activeUsers,
      suspendedUsers,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Total mentors
      prisma.user.count({
        where: {
          roles: {
            some: {
              role: Role.MENTOR,
            },
          },
        },
      }),
      
      // Total mentees
      prisma.user.count({
        where: {
          roles: {
            some: {
              role: Role.MENTEE,
            },
          },
        },
      }),
      
      // Pending verifications
      prisma.user.count({
        where: {
          roles: {
            some: {
              status: 'PENDING',
            },
          },
        },
      }),
      
      // Active users
      prisma.user.count({
        where: {
          roles: {
            some: {
              status: 'ACTIVE',
            },
          },
        },
      }),
      
      // Suspended users
      prisma.user.count({
        where: {
          roles: {
            some: {
              status: 'SUSPENDED',
            },
          },
        },
      }),
    ])

    const stats = {
      totalUsers,
      totalMentors,
      totalMentees,
      pendingVerifications,
      activeUsers,
      suspendedUsers,
    }

    return NextResponse.json({
      success: true,
      stats,
    })

  } catch (error) {
    console.error('Get admin user stats error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get user stats',
        success: false,
      },
      { status: 500 }
    )
  }
}