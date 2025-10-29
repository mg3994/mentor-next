import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Search tickets (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin role
    const userRoles = await prisma.userRole.findMany({
      where: { userId: session.user.id }
    })
    
    const isAdmin = userRoles.some(role => role.role === 'ADMIN')
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const statuses = searchParams.getAll('status')
    const categories = searchParams.getAll('category')
    const priorities = searchParams.getAll('priority')
    const assignedTo = searchParams.get('assignedTo')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    // Text search in subject and description
    if (query.trim()) {
      where.OR = [
        { subject: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    }

    // Filter by status
    if (statuses.length > 0) {
      where.status = { in: statuses }
    }

    // Filter by category
    if (categories.length > 0) {
      where.category = { in: categories }
    }

    // Filter by priority
    if (priorities.length > 0) {
      where.priority = { in: priorities }
    }

    // Filter by assigned user
    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    // Get tickets with pagination
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          assignee: {
            select: { id: true, name: true }
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: [
          { priority: 'desc' }, // High priority first
          { createdAt: 'desc' }  // Then newest first
        ],
        take: limit,
        skip: offset,
      }),
      prisma.supportTicket.count({ where })
    ])

    return NextResponse.json({
      success: true,
      tickets,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Search tickets error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to search tickets',
        success: false,
      },
      { status: 500 }
    )
  }
}