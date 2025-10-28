import { NextRequest, NextResponse } from 'next/server'
import { earningsService } from '@/lib/earnings-service'
import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

// This endpoint is called automatically when a session is completed
// to trigger immediate payout processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, triggerType = 'session_completed' } = body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Verify session exists and is completed
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        transaction: true,
        mentor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (session.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Session must be completed for payout processing' },
        { status: 400 }
      )
    }

    if (!session.transaction || session.transaction.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Transaction must be completed for payout processing' },
        { status: 400 }
      )
    }

    // Process automatic payout
    const payout = await earningsService.processAutomaticPayout(sessionId)

    // Log the automatic payout trigger
    await createAuditLog({
      action: 'AUTO_PAYOUT_TRIGGERED',
      resource: 'payout',
      details: {
        sessionId,
        payoutId: payout.id,
        mentorId: session.mentorId,
        amount: payout.amount,
        triggerType,
        processedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
        processedAt: payout.processedAt,
      },
      message: 'Automatic payout processed successfully',
    })

  } catch (error) {
    console.error('Auto payout error:', error)
    
    // Log the error
    await createAuditLog({
      action: 'AUTO_PAYOUT_FAILED',
      resource: 'payout',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    })
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Auto payout processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check auto-payout status for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Check if auto-payout has been processed for this session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        transaction: true,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check for existing payout
    const payout = await prisma.mentorPayout.findFirst({
      where: {
        transactionIds: {
          has: session.transaction?.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        completedAt: session.endTime,
      },
      transaction: session.transaction ? {
        id: session.transaction.id,
        status: session.transaction.status,
        mentorEarnings: session.transaction.mentorEarnings,
      } : null,
      payout: payout ? {
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
        processedAt: payout.processedAt,
      } : null,
      autoPayoutProcessed: !!payout,
    })

  } catch (error) {
    console.error('Check auto payout status error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to check auto payout status',
        success: false,
      },
      { status: 500 }
    )
  }
}