import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPricingModelHandler } from '@/lib/pricing-models'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const completeSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  actualDuration: z.number().min(1, 'Actual duration must be at least 1 minute'),
  sessionNotes: z.string().optional(),
})

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
    const validatedFields = completeSessionSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid session completion data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, actualDuration, sessionNotes } = validatedFields.data

    // Get session details
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        mentor: {
          include: {
            mentorProfile: {
              include: {
                pricingModels: true,
              },
            },
          },
        },
        mentee: true,
        transaction: true,
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

    // Check if session is already completed
    if (sessionData.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Session is already completed' },
        { status: 400 }
      )
    }

    // Update session status and duration
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        actualDuration,
      },
    })

    // Add session notes if provided
    if (sessionNotes) {
      await prisma.sessionNote.create({
        data: {
          sessionId,
          content: sessionNotes,
          createdBy: session.user.id,
        },
      })
    }

    // Handle usage tracking for hourly sessions
    if (sessionData.pricingType === 'HOURLY') {
      const hourlyHandler = getPricingModelHandler('HOURLY')
      
      if (hourlyHandler.handleUsageTracking) {
        await hourlyHandler.handleUsageTracking({
          sessionId,
          actualDuration,
          userId: sessionData.menteeId,
        })
      }
    }

    // Trigger automatic payout processing
    try {
      const autoPayoutResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/earnings/auto-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          triggerType: 'session_completed',
        }),
      })

      if (!autoPayoutResponse.ok) {
        console.warn('Auto payout trigger failed:', await autoPayoutResponse.text())
      }
    } catch (error) {
      console.warn('Auto payout trigger error:', error)
      // Don't fail the session completion if auto payout fails
    }

    // Calculate final earnings for mentor
    let finalEarnings = sessionData.transaction?.mentorEarnings || 0
    
    if (sessionData.pricingType === 'HOURLY' && sessionData.transaction) {
      // Recalculate earnings based on actual duration
      const pricingModel = sessionData.mentor.mentorProfile?.pricingModels.find(
        (pm: any) => pm.type === 'HOURLY' && pm.isActive
      )
      
      if (pricingModel) {
        const hours = Math.ceil(actualDuration / 60)
        const actualAmount = pricingModel.price * hours
        const platformFee = actualAmount * 0.15
        finalEarnings = actualAmount - platformFee
      }
    }

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        actualDuration: updatedSession.actualDuration,
        endTime: updatedSession.endTime,
      },
      finalEarnings,
      message: 'Session completed successfully',
    })

  } catch (error) {
    console.error('Session completion error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Session completion failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve session completion details
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
        transaction: true,
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        files: {
          where: {
            expiresAt: { gt: new Date() },
          },
          orderBy: { uploadedAt: 'desc' },
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

    return NextResponse.json({
      success: true,
      session: sessionData,
    })

  } catch (error) {
    console.error('Get session completion details error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get session details',
        success: false,
      },
      { status: 500 }
    )
  }
}