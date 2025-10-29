import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// Update ticket status (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { ticketId } = params
    const body = await request.json()
    const { status, assignedTo } = body

    // Validate status
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Check if user has admin role or is the ticket owner
    const userRoles = await prisma.userRole.findMany({
      where: { userId: session.user.id }
    })
    
    const isAdmin = userRoles.some(role => role.role === 'ADMIN')
    
    // Get ticket
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (!isAdmin && ticket.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Non-admin users can only close their own tickets
    if (!isAdmin && status && status !== 'CLOSED') {
      return NextResponse.json(
        { error: 'Only administrators can change ticket status to ' + status },
        { status: 403 }
      )
    }

    // Update ticket
    const updateData: any = {}
    if (status) updateData.status = status
    if (assignedTo && isAdmin) updateData.assignedTo = assignedTo
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date()
    }

    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        assignee: {
          select: { id: true, name: true }
        }
      }
    })

    // Log the update
    await createAuditLog({
      userId: session.user.id,
      action: 'SUPPORT_TICKET_STATUS_UPDATED',
      resource: 'support_ticket',
      details: {
        ticketId,
        oldStatus: ticket.status,
        newStatus: status,
        assignedTo,
        isAdmin
      }
    })

    // Add system message about status change
    if (status && status !== ticket.status) {
      await prisma.supportMessage.create({
        data: {
          ticketId,
          senderId: session.user.id,
          message: `Ticket status changed from ${ticket.status} to ${status}`,
          isStaff: isAdmin
        }
      })
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket status updated successfully'
    })

  } catch (error) {
    console.error('Update ticket status error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update ticket status',
        success: false,
      },
      { status: 500 }
    )
  }
}