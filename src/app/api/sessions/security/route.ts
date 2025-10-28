import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionAuditService } from '@/lib/session-audit'

// Get session security information
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

    // Get session audit trail
    const auditTrail = await SessionAuditService.getSessionAuditTrail(sessionId, {
      limit: 100
    })

    // Get security events
    const securityEvents = await SessionAuditService.getSessionSecurityEvents(sessionId)

    // Detect suspicious activity
    const suspiciousActivity = await SessionAuditService.detectSuspiciousActivity(sessionId)

    // Generate session summary
    const sessionSummary = await SessionAuditService.generateSessionSummary(sessionId)

    return NextResponse.json({
      success: true,
      sessionId,
      security: {
        auditTrail: {
          events: auditTrail.events,
          total: auditTrail.total
        },
        securityEvents: securityEvents.length,
        suspiciousActivity,
        summary: sessionSummary
      }
    })

  } catch (error) {
    console.error('Get session security error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get session security info',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Report security incident
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
    const { sessionId, eventType, severity, description, details } = body

    if (!sessionId || !eventType || !description) {
      return NextResponse.json(
        { error: 'Session ID, event type, and description are required' },
        { status: 400 }
      )
    }

    // Log security event
    await SessionAuditService.logSecurityEvent({
      sessionId,
      userId: session.user.id,
      eventType,
      severity: severity || 'MEDIUM',
      description,
      details
    })

    return NextResponse.json({
      success: true,
      message: 'Security incident reported successfully'
    })

  } catch (error) {
    console.error('Report security incident error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to report security incident',
        success: false,
      },
      { status: 500 }
    )
  }
}