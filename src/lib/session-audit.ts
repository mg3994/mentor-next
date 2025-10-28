// Session Audit Service
// Enhanced audit logging for session activities and security events

import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'

export interface SessionAuditEvent {
  sessionId: string
  userId: string
  action: SessionAuditAction
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp?: Date
}

export type SessionAuditAction = 
  | 'SESSION_STARTED'
  | 'SESSION_JOINED'
  | 'SESSION_LEFT'
  | 'SESSION_ENDED'
  | 'VIDEO_ENABLED'
  | 'VIDEO_DISABLED'
  | 'AUDIO_ENABLED'
  | 'AUDIO_DISABLED'
  | 'SCREEN_SHARE_STARTED'
  | 'SCREEN_SHARE_STOPPED'
  | 'RECORDING_STARTED'
  | 'RECORDING_STOPPED'
  | 'RECORDING_PAUSED'
  | 'RECORDING_RESUMED'
  | 'FILE_UPLOADED'
  | 'FILE_DOWNLOADED'
  | 'FILE_DELETED'
  | 'FILE_ACCESS_DENIED'
  | 'FILE_SECURITY_SCAN_FAILED'
  | 'NOTE_CREATED'
  | 'NOTE_UPDATED'
  | 'NOTE_DELETED'
  | 'CHAT_MESSAGE_SENT'
  | 'PARTICIPANT_BLOCKED'
  | 'INAPPROPRIATE_CONTENT_REPORTED'
  | 'SESSION_SECURITY_VIOLATION'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'FILE_PERMISSIONS_UPDATED'

export interface SessionSecurityEvent {
  sessionId: string
  userId?: string
  eventType: 'SECURITY_VIOLATION' | 'SUSPICIOUS_ACTIVITY' | 'ACCESS_DENIED'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export class SessionAuditService {
  // Log session audit event
  static async logSessionEvent(event: SessionAuditEvent): Promise<void> {
    try {
      await createAuditLog({
        userId: event.userId,
        action: event.action,
        resource: 'session',
        details: {
          sessionId: event.sessionId,
          timestamp: event.timestamp || new Date(),
          ...event.details
        },
        ipAddress: event.ipAddress,
        userAgent: event.userAgent
      })

      // Also log to session-specific audit trail
      await this.createSessionAuditRecord(event)

    } catch (error) {
      console.error('Failed to log session audit event:', error)
    }
  }

  // Log security event
  static async logSecurityEvent(event: SessionSecurityEvent): Promise<void> {
    try {
      await createAuditLog({
        userId: event.userId || 'anonymous',
        action: 'SESSION_SECURITY_EVENT',
        resource: 'session_security',
        details: {
          sessionId: event.sessionId,
          eventType: event.eventType,
          severity: event.severity,
          description: event.description,
          timestamp: new Date(),
          ...event.details
        },
        ipAddress: event.ipAddress,
        userAgent: event.userAgent
      })

      // Send alerts for high severity events
      if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
        await this.sendSecurityAlert(event)
      }

    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  // Create session-specific audit record
  private static async createSessionAuditRecord(event: SessionAuditEvent): Promise<void> {
    try {
      // This could be stored in a separate session audit table for faster queries
      // For now, we'll use the general audit log with session-specific indexing
      
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: `SESSION_${event.action}`,
          resource: 'session_activity',
          details: {
            sessionId: event.sessionId,
            action: event.action,
            timestamp: event.timestamp || new Date(),
            ...event.details
          },
          ipAddress: event.ipAddress,
          userAgent: event.userAgent
        }
      })

    } catch (error) {
      console.error('Failed to create session audit record:', error)
    }
  }

  // Send security alert for high severity events
  private static async sendSecurityAlert(event: SessionSecurityEvent): Promise<void> {
    try {
      // In a production environment, this would send alerts via email, Slack, etc.
      console.warn('SECURITY ALERT:', {
        sessionId: event.sessionId,
        severity: event.severity,
        description: event.description,
        timestamp: new Date()
      })

      // Log the alert
      await createAuditLog({
        userId: 'system',
        action: 'SECURITY_ALERT_SENT',
        resource: 'security_monitoring',
        details: {
          originalEvent: event,
          alertSentAt: new Date()
        }
      })

    } catch (error) {
      console.error('Failed to send security alert:', error)
    }
  }

  // Get session audit trail
  static async getSessionAuditTrail(
    sessionId: string, 
    options: {
      limit?: number
      offset?: number
      actions?: SessionAuditAction[]
      startDate?: Date
      endDate?: Date
    } = {}
  ): Promise<{
    events: any[]
    total: number
  }> {
    try {
      const where: any = {
        details: {
          path: ['sessionId'],
          equals: sessionId
        }
      }

      if (options.actions && options.actions.length > 0) {
        where.action = {
          in: options.actions.map(action => `SESSION_${action}`)
        }
      }

      if (options.startDate || options.endDate) {
        where.createdAt = {}
        if (options.startDate) where.createdAt.gte = options.startDate
        if (options.endDate) where.createdAt.lte = options.endDate
      }

      const [events, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options.limit || 100,
          skip: options.offset || 0
        }),
        prisma.auditLog.count({ where })
      ])

      return { events, total }

    } catch (error) {
      console.error('Failed to get session audit trail:', error)
      return { events: [], total: 0 }
    }
  }

  // Get security events for session
  static async getSessionSecurityEvents(
    sessionId: string,
    severity?: SessionSecurityEvent['severity']
  ): Promise<any[]> {
    try {
      const where: any = {
        resource: 'session_security',
        details: {
          path: ['sessionId'],
          equals: sessionId
        }
      }

      if (severity) {
        where.details = {
          ...where.details,
          path: ['severity'],
          equals: severity
        }
      }

      return await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      })

    } catch (error) {
      console.error('Failed to get session security events:', error)
      return []
    }
  }

  // Generate session activity summary
  static async generateSessionSummary(sessionId: string): Promise<{
    duration: number
    participants: string[]
    activities: Record<string, number>
    filesShared: number
    notesCreated: number
    securityEvents: number
  }> {
    try {
      const events = await this.getSessionAuditTrail(sessionId, { limit: 1000 })
      
      const participants = new Set<string>()
      const activities: Record<string, number> = {}
      let filesShared = 0
      let notesCreated = 0
      let securityEvents = 0
      let sessionStart: Date | null = null
      let sessionEnd: Date | null = null

      for (const event of events.events) {
        participants.add(event.userId)
        
        const action = event.action.replace('SESSION_', '')
        activities[action] = (activities[action] || 0) + 1

        if (action === 'SESSION_STARTED' && !sessionStart) {
          sessionStart = new Date(event.createdAt)
        }
        
        if (action === 'SESSION_ENDED') {
          sessionEnd = new Date(event.createdAt)
        }

        if (action === 'FILE_UPLOADED') {
          filesShared++
        }

        if (action === 'NOTE_CREATED') {
          notesCreated++
        }

        if (event.resource === 'session_security') {
          securityEvents++
        }
      }

      const duration = sessionStart && sessionEnd 
        ? sessionEnd.getTime() - sessionStart.getTime()
        : 0

      return {
        duration,
        participants: Array.from(participants),
        activities,
        filesShared,
        notesCreated,
        securityEvents
      }

    } catch (error) {
      console.error('Failed to generate session summary:', error)
      return {
        duration: 0,
        participants: [],
        activities: {},
        filesShared: 0,
        notesCreated: 0,
        securityEvents: 0
      }
    }
  }

  // Check for suspicious session activity
  static async detectSuspiciousActivity(sessionId: string): Promise<{
    isSuspicious: boolean
    reasons: string[]
    riskScore: number
  }> {
    try {
      const events = await this.getSessionAuditTrail(sessionId, { limit: 1000 })
      const reasons: string[] = []
      let riskScore = 0

      // Analyze patterns
      const actionCounts: Record<string, number> = {}
      const ipAddresses = new Set<string>()
      const userAgents = new Set<string>()

      for (const event of events.events) {
        const action = event.action.replace('SESSION_', '')
        actionCounts[action] = (actionCounts[action] || 0) + 1

        if (event.ipAddress) ipAddresses.add(event.ipAddress)
        if (event.userAgent) userAgents.add(event.userAgent)
      }

      // Check for excessive file uploads
      if (actionCounts['FILE_UPLOADED'] > 50) {
        reasons.push('Excessive file uploads detected')
        riskScore += 30
      }

      // Check for multiple IP addresses
      if (ipAddresses.size > 3) {
        reasons.push('Multiple IP addresses used in session')
        riskScore += 20
      }

      // Check for rapid actions
      const recentEvents = events.events.slice(0, 10)
      const timeSpan = recentEvents.length > 1 
        ? new Date(recentEvents[0].createdAt).getTime() - new Date(recentEvents[recentEvents.length - 1].createdAt).getTime()
        : 0

      if (timeSpan < 60000 && recentEvents.length >= 10) { // 10 actions in less than 1 minute
        reasons.push('Rapid successive actions detected')
        riskScore += 25
      }

      // Check for security events
      const securityEvents = await this.getSessionSecurityEvents(sessionId)
      if (securityEvents.length > 0) {
        reasons.push(`${securityEvents.length} security events detected`)
        riskScore += securityEvents.length * 15
      }

      return {
        isSuspicious: riskScore > 50,
        reasons,
        riskScore: Math.min(riskScore, 100)
      }

    } catch (error) {
      console.error('Failed to detect suspicious activity:', error)
      return {
        isSuspicious: false,
        reasons: ['Analysis failed'],
        riskScore: 0
      }
    }
  }
}

// Convenience functions for common audit events

export async function logSessionStart(sessionId: string, userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await SessionAuditService.logSessionEvent({
    sessionId,
    userId,
    action: 'SESSION_STARTED',
    ipAddress,
    userAgent
  })
}

export async function logFileUpload(sessionId: string, userId: string, fileName: string, fileSize: number): Promise<void> {
  await SessionAuditService.logSessionEvent({
    sessionId,
    userId,
    action: 'FILE_UPLOADED',
    details: { fileName, fileSize }
  })
}

export async function logSecurityViolation(
  sessionId: string, 
  description: string, 
  severity: SessionSecurityEvent['severity'] = 'MEDIUM',
  userId?: string
): Promise<void> {
  await SessionAuditService.logSecurityEvent({
    sessionId,
    userId,
    eventType: 'SECURITY_VIOLATION',
    severity,
    description
  })
}