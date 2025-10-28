import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { z } from 'zod'

const createRoomSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
})

const joinRoomSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  roomId: z.string().min(1, 'Room ID is required'),
})

// Create a new session room
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
    
    // Validate input
    const validatedFields = createRoomSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid room creation data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId } = validatedFields.data

    // Verify session exists and user has access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
          },
        },
        mentee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    // Check if session is scheduled or in progress
    if (!['SCHEDULED', 'IN_PROGRESS'].includes(sessionData.status)) {
      return NextResponse.json(
        { error: 'Session is not available for video call' },
        { status: 400 }
      )
    }

    // Generate room ID and session link
    const roomId = `room_${sessionId}_${Date.now()}`
    const sessionLink = `/session/${sessionId}/room/${roomId}`

    // Update session with room information
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        sessionLink: roomId,
        status: 'IN_PROGRESS',
      },
    })

    // Log room creation
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_ROOM_CREATED',
      resource: 'session_room',
      details: {
        sessionId,
        roomId,
        createdBy: session.user.id,
        participants: [sessionData.mentorId, sessionData.menteeId],
      },
    })

    return NextResponse.json({
      success: true,
      room: {
        id: roomId,
        sessionId,
        sessionLink,
        participants: [
          {
            id: sessionData.mentorId,
            name: sessionData.mentor.name,
            role: 'mentor',
            isHost: sessionData.mentorId === session.user.id,
          },
          {
            id: sessionData.menteeId,
            name: sessionData.mentee.name,
            role: 'mentee',
            isHost: sessionData.menteeId === session.user.id,
          },
        ],
        createdAt: new Date(),
      },
      message: 'Session room created successfully',
    })

  } catch (error) {
    console.error('Create session room error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create session room',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Join an existing session room
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = joinRoomSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid join room data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, roomId } = validatedFields.data

    // Verify session exists and user has access
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
          },
        },
        mentee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

    // Verify room ID matches session
    if (sessionData.sessionLink !== roomId) {
      return NextResponse.json(
        { error: 'Invalid room ID for this session' },
        { status: 400 }
      )
    }

    // Log room join
    await createAuditLog({
      userId: session.user.id,
      action: 'SESSION_ROOM_JOINED',
      resource: 'session_room',
      details: {
        sessionId,
        roomId,
        joinedBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      room: {
        id: roomId,
        sessionId,
        participants: [
          {
            id: sessionData.mentorId,
            name: sessionData.mentor.name,
            role: 'mentor',
            isHost: sessionData.mentorId === session.user.id,
          },
          {
            id: sessionData.menteeId,
            name: sessionData.mentee.name,
            role: 'mentee',
            isHost: sessionData.menteeId === session.user.id,
          },
        ],
        currentUser: {
          id: session.user.id,
          role: sessionData.mentorId === session.user.id ? 'mentor' : 'mentee',
          isHost: sessionData.mentorId === session.user.id,
        },
      },
      message: 'Joined session room successfully',
    })

  } catch (error) {
    console.error('Join session room error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to join session room',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Get session room information
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
    const roomId = searchParams.get('roomId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get session details
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        mentee: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user has access
    if (sessionData.mentorId !== session.user.id && sessionData.menteeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to session' },
        { status: 403 }
      )
    }

    // Check if room ID is provided and matches
    if (roomId && sessionData.sessionLink !== roomId) {
      return NextResponse.json(
        { error: 'Invalid room ID for this session' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      session: {
        id: sessionData.id,
        status: sessionData.status,
        startTime: sessionData.startTime,
        scheduledEnd: sessionData.scheduledEnd,
        roomId: sessionData.sessionLink,
        participants: [
          {
            id: sessionData.mentorId,
            name: sessionData.mentor.name,
            image: sessionData.mentor.image,
            role: 'mentor',
            isHost: true,
          },
          {
            id: sessionData.menteeId,
            name: sessionData.mentee.name,
            image: sessionData.mentee.image,
            role: 'mentee',
            isHost: false,
          },
        ],
        currentUser: {
          id: session.user.id,
          role: sessionData.mentorId === session.user.id ? 'mentor' : 'mentee',
          isHost: sessionData.mentorId === session.user.id,
        },
      },
    })

  } catch (error) {
    console.error('Get session room error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get session room information',
        success: false,
      },
      { status: 500 }
    )
  }
}