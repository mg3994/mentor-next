import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

interface RouteParams {
  params: Promise<{
    fileId: string
  }>
}

// Delete session file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { fileId } = await params

    // Get file record
    const file = await prisma.sessionFile.findUnique({
      where: { id: fileId },
      include: {
        session: true,
      },
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Verify user has access (uploader, mentor, or mentee)
    const hasAccess = 
      file.uploadedBy === session.user.id ||
      file.session.mentorId === session.user.id ||
      file.session.menteeId === session.user.id

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to file' },
        { status: 403 }
      )
    }

    // Delete physical file
    const filePath = join(process.cwd(), 'uploads', 'sessions', file.sessionId, file.fileUrl)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    // Delete database record
    await prisma.sessionFile.delete({
      where: { id: fileId },
    })

    // Log file deletion
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_FILE_DELETED',
      resource: 'session_file',
      details: {
        sessionId: file.sessionId,
        fileId: file.id,
        fileName: file.fileName,
        deletedBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    })

  } catch (error) {
    console.error('File deletion error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'File deletion failed',
        success: false,
      },
      { status: 500 }
    )
  }
}