import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// Reopen ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { ticketId } = await params
    const body = await request.json()
    const { reason } = body

    // Get ticket
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id // Users can only reopen their own tickets
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or access denied' },
        { status: 404 }
      )
    }

    if (ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      return NextResponse.json(
        { error: 'Only closed or resolved tickets can be reopened' },
        { status: 400 }
      )
    }

    // Check if ticket was closed more than 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    if (ticket.resolvedAt && ticket.resolvedAt < thirtyDaysAgo) {
      return NextResponse.json(
        { error: 'Cannot reopen tickets that were closed more than 30 days ago' },
        { status: 400 }
      )
    }

    // Reopen ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'OPEN',
        resolvedAt: null
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        assignee: {
          select: { id: true, name: true }
        }
      }
    })

    // Add system message about reopening
    const reopenMessage = reason 
      ? `Ticket reopened by user. Reason: ${reason}`
      : 'Ticket reopened by user'

    await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: session.user.id,
        message: reopenMessage,
        isStaff: false
      }
    })

    // Log the reopening
    await createAuditLog({
      userId: session.user.id,
      action: 'SUPPORT_TICKET_REOPENED',
      resource: 'support_ticket',
      details: {
        ticketId,
        reason,
        reopenedBy: 'user'
      }
    })

    // Notify support team
    await notifySupportTeam(updatedTicket)

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket reopened successfully'
    })

  } catch (error) {
    console.error('Reopen ticket error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to reopen ticket',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Helper function to notify support team
async function notifySupportTeam(ticket: any) {
  try {
    // In a production environment, this would send notifications via email, Slack, etc.
    console.log('Ticket reopened:', {
      id: ticket.id,
      subject: ticket.subject,
      priority: ticket.priority,
      user: ticket.user.name
    })

    // Log notification
    await createAuditLog({
      userId: 'system',
      action: 'SUPPORT_TEAM_NOTIFIED',
      resource: 'support_notification',
      details: {
        ticketId: ticket.id,
        notificationType: 'TICKET_REOPENED',
        priority: ticket.priority
      }
    })

  } catch (error) {
    console.error('Failed to notify support team:', error)
  }
}