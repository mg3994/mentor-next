import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { writeFile, mkdir } from 'fs/promises'
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
    const recording = formData.get('recording') as File
    const sessionId = formData.get('sessionId') as string
    const recordingDataStr = formData.get('recordingData') as string

    if (!recording || !sessionId || !recordingDataStr) {
      return NextResponse.json(
        { error: 'Recording file, session ID, and recording data are required' },
        { status: 400 }
      )
    }

    const recordingData = JSON.parse(recordingDataStr)

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

    // Create recordings directory
    const recordingsDir = join(process.cwd(), 'uploads', 'recordings', sessionId)
    if (!existsSync(recordingsDir)) {
      await mkdir(recordingsDir, { recursive: true })
    }

    // Save recording file
    const filePath = join(recordingsDir, recordingData.fileName)
    const bytes = await recording.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Save recording record to database (using SessionFile model for now)
    const recordingFile = await prisma.sessionFile.create({
      data: {
        sessionId,
        fileName: recordingData.fileName,
        fileUrl: recordingData.fileName,
        fileSize: recording.size,
        mimeType: 'video/webm',
        uploadedBy: session.user.id,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    })

    // Log recording upload
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_RECORDING_UPLOADED',
      resource: 'session_recording',
      details: {
        sessionId,
        recordingId: recordingFile.id,
        fileName: recordingData.fileName,
        fileSize: recording.size,
        duration: recordingData.duration,
        quality: recordingData.quality,
      },
    })

    return NextResponse.json({
      success: true,
      recording: {
        id: recordingFile.id,
        sessionId: recordingFile.sessionId,
        fileName: recordingFile.fileName,
        fileSize: recordingFile.fileSize,
        duration: recordingData.duration,
        quality: recordingData.quality,
        uploadedAt: recordingFile.uploadedAt,
        downloadUrl: `/api/sessions/files/${recordingFile.id}/download`,
      },
      downloadUrl: `/api/sessions/files/${recordingFile.id}/download`,
      message: 'Recording uploaded successfully',
    })

  } catch (error) {
    console.error('Recording upload error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Recording upload failed',
        success: false,
      },
      { status: 500 }
    )
  }
}