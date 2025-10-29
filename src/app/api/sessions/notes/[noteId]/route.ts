import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

interface RouteParams {
  params: Promise<{
    noteId: string
  }>
}

// Update specific session note
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { noteId } = await params
    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Get note and verify ownership
    const note = await prisma.sessionNote.findUnique({
      where: { id: noteId },
      include: {
        session: true,
      },
    })

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    // Verify user is the note creator or has session access
    const hasAccess = 
      note.createdBy === session.user.id ||
      note.session.mentorId === session.user.id ||
      note.session.menteeId === session.user.id

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to note' },
        { status: 403 }
      )
    }

    // Update note
    const updatedNote = await prisma.sessionNote.update({
      where: { id: noteId },
      data: {
        content: content.trim(),
      },
    })

    // Log note update
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_NOTE_UPDATED',
      resource: 'session_note',
      details: {
        sessionId: note.sessionId,
        noteId: note.id,
        contentLength: content.trim().length,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      note: updatedNote,
      message: 'Note updated successfully',
    })

  } catch (error) {
    console.error('Update session note error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update note',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Delete specific session note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { noteId } = await params

    // Get note and verify ownership
    const note = await prisma.sessionNote.findUnique({
      where: { id: noteId },
      include: {
        session: true,
      },
    })

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    // Verify user is the note creator
    if (note.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the note creator can delete notes' },
        { status: 403 }
      )
    }

    // Delete note
    await prisma.sessionNote.delete({
      where: { id: noteId },
    })

    // Log note deletion
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_NOTE_DELETED',
      resource: 'session_note',
      details: {
        sessionId: note.sessionId,
        noteId: note.id,
        deletedBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully',
    })

  } catch (error) {
    console.error('Delete session note error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to delete note',
        success: false,
      },
      { status: 500 }
    )
  }
}