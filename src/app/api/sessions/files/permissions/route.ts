import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { SessionAuditService } from '@/lib/session-audit'

interface FilePermissionUpdate {
  fileId: string
  permissions: {
    canDownload?: boolean
    canShare?: boolean
    isPublic?: boolean
  }
}

// Get file permissions for session
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
    const fileId = searchParams.get('fileId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Verify session access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: { select: { id: true, name: true } },
        mentee: { select: { id: true, name: true } }
      }
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const hasAccess = 
      sessionData.mentorId === session.user.id || 
      sessionData.menteeId === session.user.id

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    // Get user's role in session
    const isHost = sessionData.mentorId === session.user.id
    const isMentor = sessionData.mentorId === session.user.id
    const isMentee = sessionData.menteeId === session.user.id

    // Define base permissions based on role
    const basePermissions = {
      canUpload: true, // Both can upload
      canDownload: true, // Both can download
      canDelete: isHost, // Only host can delete others' files
      canShare: true, // Both can share
      canManagePermissions: isHost, // Only host can manage permissions
    }

    if (fileId) {
      // Get specific file permissions
      const file = await prisma.sessionFile.findUnique({
        where: { id: fileId }
      })

      if (!file || file.sessionId !== sessionId) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }

      // File-specific permissions
      const filePermissions = {
        ...basePermissions,
        canDelete: basePermissions.canDelete || file.uploadedBy === session.user.id,
        isOwner: file.uploadedBy === session.user.id
      }

      return NextResponse.json({
        success: true,
        permissions: filePermissions,
        file: {
          id: file.id,
          fileName: file.fileName,
          uploadedBy: file.uploadedBy
        }
      })
    }

    // Return session-level permissions
    return NextResponse.json({
      success: true,
      permissions: basePermissions,
      session: {
        id: sessionData.id,
        mentor: sessionData.mentor,
        mentee: sessionData.mentee,
        userRole: isMentor ? 'mentor' : 'mentee',
        isHost
      }
    })

  } catch (error) {
    console.error('Get file permissions error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get file permissions',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Update file permissions (host only)
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
    const { sessionId, updates }: { sessionId: string; updates: FilePermissionUpdate[] } = body

    if (!sessionId || !updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Session ID and updates array are required' },
        { status: 400 }
      )
    }

    // Verify session access and host status
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const isHost = sessionData.mentorId === session.user.id
    const hasAccess = 
      sessionData.mentorId === session.user.id || 
      sessionData.menteeId === session.user.id

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    if (!isHost) {
      return NextResponse.json(
        { error: 'Only session host can manage file permissions' },
        { status: 403 }
      )
    }

    // Process permission updates
    const results = []
    
    for (const update of updates) {
      try {
        // Verify file belongs to session
        const file = await prisma.sessionFile.findUnique({
          where: { id: update.fileId }
        })

        if (!file || file.sessionId !== sessionId) {
          results.push({
            fileId: update.fileId,
            success: false,
            error: 'File not found or does not belong to session'
          })
          continue
        }

        // For now, we'll store permissions in the audit log
        // In a production system, you might want a separate permissions table
        await SessionAuditService.logSessionEvent({
          sessionId,
          userId: session.user.id,
          action: 'FILE_PERMISSIONS_UPDATED',
          details: {
            fileId: update.fileId,
            fileName: file.fileName,
            permissions: update.permissions,
            updatedBy: session.user.id
          }
        })

        results.push({
          fileId: update.fileId,
          success: true,
          permissions: update.permissions
        })

      } catch (error) {
        results.push({
          fileId: update.fileId,
          success: false,
          error: error instanceof Error ? error.message : 'Update failed'
        })
      }
    }

    // Log the bulk permission update
    await createAuditLog({
      userId: session.user.id,
      action: 'BULK_FILE_PERMISSIONS_UPDATE',
      resource: 'session_files',
      details: {
        sessionId,
        updatesCount: updates.length,
        successCount: results.filter(r => r.success).length,
        results
      }
    })

    return NextResponse.json({
      success: true,
      results,
      message: 'File permissions updated successfully'
    })

  } catch (error) {
    console.error('Update file permissions error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update file permissions',
        success: false,
      },
      { status: 500 }
    )
  }
}