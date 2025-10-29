import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Add message to ticket
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

    // Verify ticket exists and user has access
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

    // Check if ticket is closed
    if (ticket.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Cannot add messages to closed tickets' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const content = formData.get('content') as string

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or less' },
        { status: 400 }
      )
    }

    // Create message
    const message = await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId: session.user.id,
        message: content.trim(),
        isStaff: false // Regular users are not staff
      }
    })

    // Handle file attachments
    const attachments: string[] = []
    const attachmentKeys = Array.from(formData.keys()).filter(key => key.startsWith('attachment_'))
    
    if (attachmentKeys.length > 0) {
      const uploadDir = join(process.cwd(), 'uploads', 'support', ticketId, 'messages', message.id)
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      for (const key of attachmentKeys) {
        const file = formData.get(key) as File
        if (file && file.size > 0) {
          // Validate file
          if (file.size > 10 * 1024 * 1024) { // 10MB limit
            continue // Skip files that are too large
          }

          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
          if (!allowedTypes.includes(file.type)) {
            continue // Skip unsupported file types
          }

          // Save file
          const timestamp = Date.now()
          const fileName = `${timestamp}-${file.name}`
          const filePath = join(uploadDir, fileName)
          
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          await writeFile(filePath, buffer)
          
          attachments.push(fileName)
        }
      }
    }

    // Update ticket status to IN_PROGRESS if it was OPEN
    if (ticket.status === 'OPEN') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' }
      })
    }

    // Log message creation
    await createAuditLog({
      userId: session.user.id,
      action: 'SUPPORT_MESSAGE_CREATED',
      resource: 'support_message',
      details: {
        ticketId,
        messageId: message.id,
        attachmentCount: attachments.length
      }
    })

    // Notify support team of new message
    await notifySupportTeam(ticketId, message, ticket)

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        attachments
      }
    })

  } catch (error) {
    console.error('Add message error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to add message',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Get messages for ticket
export async function GET(
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

    // Verify ticket exists and user has access
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

    // Get messages
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({
      success: true,
      messages
    })

  } catch (error) {
    console.error('Get messages error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get messages',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Helper function to notify support team
async function notifySupportTeam(ticketId: string, message: any, ticket: any) {
  try {
    // In a production environment, this would send notifications via email, Slack, etc.
    console.log('New support message:', {
      ticketId,
      messageId: message.id,
      subject: ticket.subject,
      priority: ticket.priority
    })

    // Log notification
    await createAuditLog({
      userId: 'system',
      action: 'SUPPORT_TEAM_NOTIFIED',
      resource: 'support_notification',
      details: {
        ticketId,
        messageId: message.id,
        notificationType: 'NEW_MESSAGE',
        priority: ticket.priority
      }
    })

  } catch (error) {
    console.error('Failed to notify support team:', error)
  }
}