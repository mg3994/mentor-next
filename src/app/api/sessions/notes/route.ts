import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// Get session notes
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
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Verify session exists and user has access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user is either mentor or mentee
    if (sessionData.mentorId !== session.user.id && sessionData.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    // Get session notes
    const notes = await prisma.sessionNote.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      notes,
      count: notes.length,
    })

  } catch (error) {
    console.error('Get session notes error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get session notes',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Create or update session note
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sessionId, content } = body

    if (!sessionId || !content?.trim()) {
      return NextResponse.json(
        { error: 'Session ID and content are required' },
        { status: 400 }
      )
    }

    // Verify session exists and user has access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user is either mentor or mentee
    if (sessionData.mentorId !== session.user.id && sessionData.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    // Check if user already has a note for this session (for updates)
    const existingNote = await prisma.sessionNote.findFirst({
      where: {
        sessionId,
        createdBy: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let note

    if (existingNote) {
      // Update existing note
      note = await prisma.sessionNote.update({
        where: { id: existingNote.id },
        data: {
          content: content.trim(),
        },
      })
    } else {
      // Create new note
      note = await prisma.sessionNote.create({
        data: {
          sessionId,
          content: content.trim(),
          createdBy: session.user.id,
        },
      })
    }

    // Log note creation/update
    await createAuditLog({
      userId: session.user.id,
      action: existingNote ? 'SESSION_NOTE_UPDATED' : 'SESSION_NOTE_CREATED',
      resource: 'session_note',
      details: {
        sessionId,
        noteId: note.id,
        contentLength: content.trim().length,
      },
    })

    return NextResponse.json({
      success: true,
      note,
      message: existingNote ? 'Note updated successfully' : 'Note created successfully',
    })

  } catch (error) {
    console.error('Create/update session note error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to save note',
        success: false,
      },
      { status: 500 }
    )
  }
}