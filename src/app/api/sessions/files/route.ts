import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Get session files
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

    // Get session files (only non-expired ones)
    const files = await prisma.sessionFile.findMany({
      where: {
        sessionId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    })

    const filesWithUrls = files.map(file => ({
      id: file.id,
      sessionId: file.sessionId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.mimeType,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt,
      expiresAt: file.expiresAt,
      downloadUrl: `/api/sessions/files/${file.id}/download`,
    }))

    return NextResponse.json({
      success: true,
      files: filesWithUrls,
      count: filesWithUrls.length,
    })

  } catch (error) {
    console.error('Get session files error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get session files',
        success: false,
      },
      { status: 500 }
    )
  }
}