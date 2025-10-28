import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { FileSecurityService } from '@/lib/file-security'
import { SessionAuditService, logFileUpload, logSecurityViolation } from '@/lib/session-audit'
import { calculateRetentionDate } from '@/lib/file-cleanup'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string
    const uploadedBy = formData.get('uploadedBy') as string

    if (!file || !sessionId) {
      return NextResponse.json(
        { error: 'File and session ID are required' },
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

    // Validate file using security service
    const validationResult = FileSecurityService.validateFile(file)
    if (!validationResult.isValid) {
      await logSecurityViolation(
        sessionId,
        `File validation failed: ${validationResult.errors.join(', ')}`,
        'MEDIUM',
        session.user.id
      )
      
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validationResult.errors
        },
        { status: 400 }
      )
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      await SessionAuditService.logSessionEvent({
        sessionId,
        userId: session.user.id,
        action: 'FILE_UPLOADED',
        details: {
          fileName: file.name,
          warnings: validationResult.warnings
        }
      })
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), 'uploads', 'sessions', sessionId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate secure filename
    const secureFileName = FileSecurityService.generateSecureFilename(file.name, session.user.id)
    const filePath = join(uploadDir, secureFileName)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Perform security scan on uploaded file
    const scanResult = await FileSecurityService.scanFileContent(filePath)
    if (!scanResult.isSecure) {
      // Delete the file immediately if security scan fails
      try {
        await unlink(filePath)
      } catch (unlinkError) {
        console.error('Failed to delete insecure file:', unlinkError)
      }

      await logSecurityViolation(
        sessionId,
        `File security scan failed: ${scanResult.threats.join(', ')}`,
        'HIGH',
        session.user.id
      )

      return NextResponse.json(
        { 
          error: 'File failed security scan',
          details: scanResult.threats
        },
        { status: 400 }
      )
    }

    // Calculate expiration date (30 days from now)
    const expiresAt = calculateRetentionDate(30)

    // Save file record to database
    const sessionFile = await prisma.sessionFile.create({
      data: {
        sessionId,
        fileName: file.name,
        fileUrl: secureFileName, // Store secure filename
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: session.user.id,
        expiresAt,
      },
    })

    // Log file upload with enhanced audit
    await logFileUpload(sessionId, session.user.id, file.name, file.size)
    
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_FILE_UPLOADED',
      resource: 'session_file',
      details: {
        sessionId,
        fileId: sessionFile.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        securityScanPassed: true,
        fileHash: scanResult.fileHash,
      },
    })

    return NextResponse.json({
      success: true,
      file: {
        id: sessionFile.id,
        sessionId: sessionFile.sessionId,
        fileName: sessionFile.fileName,
        fileSize: sessionFile.fileSize,
        fileType: sessionFile.mimeType,
        uploadedBy: sessionFile.uploadedBy,
        uploadedAt: sessionFile.uploadedAt,
        expiresAt: sessionFile.expiresAt,
        downloadUrl: `/api/sessions/files/${sessionFile.id}/download`,
      },
      message: 'File uploaded successfully',
    })

  } catch (error) {
    console.error('File upload error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'File upload failed',
        success: false,
      },
      { status: 500 }
    )
  }
}