import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// Close ticket
export async function POST(
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
    const { reason } = body

    // Get ticket
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id // Users can only close their own tickets
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or access denied' },
        { status: 404 }
      )
    }

    if (ticket.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Ticket is already closed' },
        { status: 400 }
      )
    }

    // Close ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        resolvedAt: new Date()
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

    // Add system message about closure
    const closeMessage = reason 
      ? `Ticket closed by user. Reason: ${reason}`
      : 'Ticket closed by user'

    await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: session.user.id,
        message: closeMessage,
        isStaff: false
      }
    })

    // Log the closure
    await createAuditLog({
      userId: session.user.id,
      action: 'SUPPORT_TICKET_CLOSED',
      resource: 'support_ticket',
      details: {
        ticketId,
        reason,
        closedBy: 'user'
      }
    })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket closed successfully'
    })

  } catch (error) {
    console.error('Close ticket error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to close ticket',
        success: false,
      },
      { status: 500 }
    )
  }
}