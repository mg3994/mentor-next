import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// Get specific ticket with messages
export async function GET(
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

    // Get ticket with messages
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id // Users can only access their own tickets
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        assignee: {
          select: { id: true, name: true }
        },
        messages: {
          include: {
            ticket: false // Avoid circular reference
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      ticket
    })

  } catch (error) {
    console.error('Get ticket error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get ticket',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Update ticket (admin only for status changes)
export async function PUT(
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
    const { status, assignedTo, priority } = body

    // Check if user is admin (for now, allow any authenticated user to update their own tickets)
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: session.user.id
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or access denied' },
        { status: 404 }
      )
    }

    // Update ticket
    const updatedTicket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(status && { status }),
        ...(assignedTo && { assignedTo }),
        ...(priority && { priority }),
        ...(status === 'RESOLVED' || status === 'CLOSED' ? { resolvedAt: new Date() } : {})
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

    // Log the update
    await createAuditLog({
      userId: session.user.id,
      action: 'SUPPORT_TICKET_UPDATED',
      resource: 'support_ticket',
      details: {
        ticketId,
        changes: { status, assignedTo, priority }
      }
    })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: 'Ticket updated successfully'
    })

  } catch (error) {
    console.error('Update ticket error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update ticket',
        success: false,
      },
      { status: 500 }
    )
  }
}