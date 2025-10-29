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

    // Get pending mentor applications
    const applications = await prisma.mentorProfile.findMany({
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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      applications,
    })

  } catch (error) {
    console.error('Get pending mentor applications error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get pending applications',
        success: false,
      },
      { status: 500 }
    )
  }
}