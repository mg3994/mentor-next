import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { FileSecurityService } from '@/lib/file-security'
import { SessionAuditService, logSecurityViolation } from '@/lib/session-audit'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

interface RouteParams {
  params: {
    fileId: string
  }
}

// Download session file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { fileId } = params

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

    // Check if file has expired
    if (file.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'File has expired' },
        { status: 410 }
      )
    }

    // Enhanced access control using security service
    const accessCheck = await FileSecurityService.checkFileAccess(
      fileId,
      session.user.id,
      file.sessionId,
      prisma
    )

    if (!accessCheck.allowed) {
      await logSecurityViolation(
        file.sessionId,
        `Unauthorized file access attempt: ${accessCheck.reason}`,
        'MEDIUM',
        session.user.id
      )

      await SessionAuditService.logSessionEvent({
        sessionId: file.sessionId,
        userId: session.user.id,
        action: 'FILE_ACCESS_DENIED',
        details: {
          fileId,
          fileName: file.fileName,
          reason: accessCheck.reason
        }
      })

      return NextResponse.json(
        { error: 'Unauthorized access to file' },
        { status: 403 }
      )
    }

    // Get file path
    const filePath = join(process.cwd(), 'uploads', 'sessions', file.sessionId, file.fileUrl)
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found on server' },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = await readFile(filePath)

    // Enhanced audit logging for file download
    await SessionAuditService.logSessionEvent({
      sessionId: file.sessionId,
      userId: session.user.id,
      action: 'FILE_DOWNLOADED',
      details: {
        fileId: file.id,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType
      }
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_FILE_DOWNLOADED',
      resource: 'session_file',
      details: {
        sessionId: file.sessionId,
        fileId: file.id,
        fileName: file.fileName,
        downloadedBy: session.user.id,
      },
    })

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'Content-Length': file.fileSize.toString(),
      },
    })

  } catch (error) {
    console.error('File download error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'File download failed',
        success: false,
      },
      { status: 500 }
    )
  }
}