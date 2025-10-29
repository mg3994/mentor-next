import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Get support tickets
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
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      userId: session.user.id
    }

    if (status) where.status = status
    if (category) where.category = category

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
          }
        },
        orderBy: { createdAt: 'desc' },
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
    console.error('Get support tickets error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get support tickets',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Create support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const subject = formData.get('subject') as string
    const description = formData.get('description') as string
    const category = formData.get('category') as string
    const priority = (formData.get('priority') as string || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

    // Validate required fields
    if (!subject || !description || !category) {
      return NextResponse.json(
        { error: 'Subject, description, and category are required' },
        { status: 400 }
      )
    }

    // Validate field lengths
    if (subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject must be 200 characters or less' },
        { status: 400 }
      )
    }

    if (description.length > 5000) {
      return NextResponse.json(
        { error: 'Description must be 5000 characters or less' },
        { status: 400 }
      )
    }

    // Create ticket
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.user.id,
        subject: subject.trim(),
        description: description.trim(),
        category: category as 'TECHNICAL' | 'BILLING' | 'ACCOUNT' | 'SESSION' | 'SAFETY' | 'FEATURE_REQUEST' | 'BUG_REPORT' | 'OTHER',
        priority,
        status: 'OPEN',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Handle file attachments
    const attachments: string[] = []
    const attachmentKeys = Array.from(formData.keys()).filter(key => key.startsWith('attachment_'))
    
    if (attachmentKeys.length > 0) {
      const uploadDir = join(process.cwd(), 'uploads', 'support', ticket.id)
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

      // Update ticket with attachments
      if (attachments.length > 0) {
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { attachments: JSON.stringify(attachments) }
        })
      }
    }

    // Log ticket creation
    await createAuditLog({
      userId: session.user.id,
      action: 'SUPPORT_TICKET_CREATED',
      resource: 'support_ticket',
      details: {
        ticketId: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        attachmentCount: attachments.length
      }
    })

    // Send notification to support team
    await notifySupportTeam(ticket)

    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        attachments
      },
      message: 'Support ticket created successfully'
    })

  } catch (error) {
    console.error('Create support ticket error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create support ticket',
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
    console.log('New support ticket created:', {
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
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
        notificationType: 'NEW_TICKET',
        priority: ticket.priority
      }
    })

  } catch (error) {
    console.error('Failed to notify support team:', error)
  }
}