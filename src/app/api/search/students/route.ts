import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role, RoleStatus } from '@prisma/client'

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
    const query = searchParams.get('q') || ''
    const interests = searchParams.get('interests')?.split(',').filter(Boolean) || []
    const timezone = searchParams.get('timezone') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      userId: {
        not: session.user.id, // Exclude current user
      },
      user: {
        roles: {
          some: {
            role: Role.MENTEE,
            status: RoleStatus.ACTIVE,
          },
        },
      },
    }

    // Text search in learning goals
    if (query) {
      where.OR = [
        { learningGoals: { contains: query, mode: 'insensitive' } },
        { user: { name: { contains: query, mode: 'insensitive' } } },
      ]
    }

    // Interests filter
    if (interests.length > 0) {
      where.interests = { hasSome: interests }
    }

    // Timezone filter
    if (timezone) {
      where.timezone = timezone
    }

    // Get students
    const [students, total] = await Promise.all([
      prisma.menteeProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.menteeProfile.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Search students error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}