import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Get support statistics (admin only)
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

    // Get basic counts
    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      ticketsByCategory,
      ticketsByPriority,
      ticketsByStatus
    ] = await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      
      // Group by category
      prisma.supportTicket.groupBy({
        by: ['category'],
        _count: { id: true }
      }),
      
      // Group by priority
      prisma.supportTicket.groupBy({
        by: ['priority'],
        _count: { id: true }
      }),
      
      // Group by status
      prisma.supportTicket.groupBy({
        by: ['status'],
        _count: { id: true }
      })
    ])

    // Calculate average response time (time from creation to first staff message)
    const ticketsWithFirstResponse = await prisma.supportTicket.findMany({
      include: {
        messages: {
          where: { isStaff: true },
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      },
      where: {
        messages: {
          some: { isStaff: true }
        }
      }
    })

    let totalResponseTime = 0
    let responseCount = 0

    ticketsWithFirstResponse.forEach(ticket => {
      if (ticket.messages.length > 0) {
        const responseTime = ticket.messages[0].createdAt.getTime() - ticket.createdAt.getTime()
        totalResponseTime += responseTime / (1000 * 60) // Convert to minutes
        responseCount++
      }
    })

    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0

    // Calculate average resolution time (time from creation to resolution)
    const resolvedTicketsWithTime = await prisma.supportTicket.findMany({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null }
      }
    })

    let totalResolutionTime = 0
    let resolutionCount = 0

    resolvedTicketsWithTime.forEach(ticket => {
      if (ticket.resolvedAt) {
        const resolutionTime = ticket.resolvedAt.getTime() - ticket.createdAt.getTime()
        totalResolutionTime += resolutionTime / (1000 * 60) // Convert to minutes
        resolutionCount++
      }
    })

    const averageResolutionTime = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0

    // Format category counts
    const categoryMap: Record<string, number> = {}
    ticketsByCategory.forEach(item => {
      categoryMap[item.category] = item._count.id
    })

    // Format priority counts
    const priorityMap: Record<string, number> = {}
    ticketsByPriority.forEach(item => {
      priorityMap[item.priority] = item._count.id
    })

    // Format status counts
    const statusMap: Record<string, number> = {}
    ticketsByStatus.forEach(item => {
      statusMap[item.status] = item._count.id
    })

    const stats = {
      totalTickets,
      openTickets,
      resolvedTickets,
      averageResponseTime: Math.round(averageResponseTime),
      averageResolutionTime: Math.round(averageResolutionTime),
      ticketsByCategory: categoryMap,
      ticketsByPriority: priorityMap,
      ticketsByStatus: statusMap
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Get support stats error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get support statistics',
        success: false,
      },
      { status: 500 }
    )
  }
}