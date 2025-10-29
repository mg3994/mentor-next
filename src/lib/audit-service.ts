import { prisma } from './db'
import { headers } from 'next/headers'

// Audit action types for safety tracking
export const AUDIT_ACTIONS = {
  // User actions
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  
  // Safety actions
  USER_BLOCKED: 'USER_BLOCKED',
  USER_UNBLOCKED: 'USER_UNBLOCKED',
  USER_REPORTED: 'USER_REPORTED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  REPORT_DISMISSED: 'REPORT_DISMISSED',
  
  // Session actions
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_COMPLETED: 'SESSION_COMPLETED',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  SESSION_FILE_UPLOADED: 'SESSION_FILE_UPLOADED',
  SESSION_FILE_DOWNLOADED: 'SESSION_FILE_DOWNLOADED',
  SESSION_FILE_DELETED: 'SESSION_FILE_DELETED',
  
  // Payment actions
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_ORDER_CREATED: 'PAYMENT_ORDER_CREATED',
  PAYMENT_AUTHORIZED: 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED: 'PAYMENT_CAPTURED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  ORDER_PAID: 'ORDER_PAID',
  PAYOUT_PROCESSED: 'PAYOUT_PROCESSED',
  PAYOUT_FAILED: 'PAYOUT_FAILED',
  
  // Review actions
  REVIEW_CREATED: 'REVIEW_CREATED',
  REVIEW_UPDATED: 'REVIEW_UPDATED',
  REVIEW_DELETED: 'REVIEW_DELETED',
  REVIEW_MODERATED: 'REVIEW_MODERATED',
  
  // Admin actions
  ADMIN_USER_MANAGEMENT: 'ADMIN_USER_MANAGEMENT',
  ADMIN_REPORT_ACTION: 'ADMIN_REPORT_ACTION',
  ADMIN_SYSTEM_CONFIG: 'ADMIN_SYSTEM_CONFIG',
  
  // System actions
  SYSTEM_CLEANUP: 'SYSTEM_CLEANUP',
  SYSTEM_BACKUP: 'SYSTEM_BACKUP',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

// Resource types for audit logging
export const AUDIT_RESOURCES = {
  USER: 'user',
  SESSION: 'session',
  PAYMENT: 'payment',
  REVIEW: 'review',
  REPORT: 'report',
  SUPPORT_TICKET: 'support_ticket',
  SYSTEM: 'system',
  SAFETY: 'safety',
} as const

export type AuditResource = typeof AUDIT_RESOURCES[keyof typeof AUDIT_RESOURCES]

// Interface for audit log data
export interface AuditLogData {
  userId?: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

// Enhanced audit logging service
export class AuditService {
  /**
   * Create a comprehensive audit log entry
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      // Get request headers for IP and User Agent if not provided
      let ipAddress = data.ipAddress
      let userAgent = data.userAgent

      if (!ipAddress || !userAgent) {
        try {
          const headersList = await headers()
          ipAddress = ipAddress || headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
          userAgent = userAgent || headersList.get('user-agent') || 'unknown'
        } catch (error) {
          // Headers might not be available in some contexts
          ipAddress = ipAddress || 'unknown'
          userAgent = userAgent || 'unknown'
        }
      }

      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          details: {
            resourceId: data.resourceId,
            sessionId: data.sessionId,
            timestamp: new Date().toISOString(),
            ...data.details,
          },
          ipAddress,
          userAgent,
        },
      })
    } catch (error) {
      // Log audit failures to console but don't throw to avoid breaking main functionality
      console.error('Failed to create audit log:', error)
    }
  }

  /**
   * Log user-related actions
   */
  static async logUserAction(data: {
    userId: string
    action: AuditAction
    targetUserId?: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: AUDIT_RESOURCES.USER,
      resourceId: data.targetUserId || data.userId,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
  }

  /**
   * Log safety-related actions with high priority
   */
  static async logSafetyAction(data: {
    userId?: string
    action: AuditAction
    targetUserId?: string
    reportId?: string
    reason?: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: AUDIT_RESOURCES.SAFETY,
      resourceId: data.targetUserId || data.reportId,
      details: {
        targetUserId: data.targetUserId,
        reportId: data.reportId,
        reason: data.reason,
        priority: 'HIGH',
        ...data.details,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
  }

  /**
   * Log session-related actions
   */
  static async logSessionAction(data: {
    userId?: string
    action: AuditAction
    sessionId: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: AUDIT_RESOURCES.SESSION,
      resourceId: data.sessionId,
      sessionId: data.sessionId,
      details: data.details,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
  }

  /**
   * Log payment-related actions
   */
  static async logPaymentAction(data: {
    userId?: string
    action: AuditAction
    transactionId?: string
    amount?: number
    paymentMethod?: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: AUDIT_RESOURCES.PAYMENT,
      resourceId: data.transactionId,
      details: {
        transactionId: data.transactionId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        ...data.details,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
  }

  /**
   * Log review-related actions
   */
  static async logReviewAction(data: {
    userId: string
    action: AuditAction
    reviewId?: string
    sessionId?: string
    rating?: number
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: AUDIT_RESOURCES.REVIEW,
      resourceId: data.reviewId,
      sessionId: data.sessionId,
      details: {
        reviewId: data.reviewId,
        sessionId: data.sessionId,
        rating: data.rating,
        ...data.details,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
  }

  /**
   * Log administrative actions
   */
  static async logAdminAction(data: {
    adminUserId: string
    action: AuditAction
    targetUserId?: string
    resourceId?: string
    details?: Record<string, any>
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      userId: data.adminUserId,
      action: data.action,
      resource: AUDIT_RESOURCES.USER,
      resourceId: data.targetUserId || data.resourceId,
      details: {
        adminAction: true,
        targetUserId: data.targetUserId,
        ...data.details,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    })
  }

  /**
   * Log system actions (cleanup, maintenance, etc.)
   */
  static async logSystemAction(data: {
    action: AuditAction
    details?: Record<string, any>
    userId?: string
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: data.action,
      resource: AUDIT_RESOURCES.SYSTEM,
      details: {
        automated: !data.userId,
        ...data.details,
      },
    })
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(params: {
    userId?: string
    action?: AuditAction
    resource?: AuditResource
    startDate?: Date
    endDate?: Date
    page?: number
    limit?: number
  }) {
    const { userId, action, resource, startDate, endDate, page = 1, limit = 50 } = params
    const skip = (page - 1) * limit

    const where: any = {}

    if (userId) where.userId = userId
    if (action) where.action = action
    if (resource) where.resource = resource
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get safety-related audit logs for monitoring
   */
  static async getSafetyAuditLogs(params: {
    startDate?: Date
    endDate?: Date
    limit?: number
  }) {
    const { startDate, endDate, limit = 100 } = params

    const where: any = {
      resource: AUDIT_RESOURCES.SAFETY,
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    return await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  /**
   * Get user activity summary
   */
  static async getUserActivitySummary(userId: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const logs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Group by action type
    const actionCounts = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Group by resource type
    const resourceCounts = logs.reduce((acc, log) => {
      acc[log.resource] = (acc[log.resource] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalActions: logs.length,
      actionCounts,
      resourceCounts,
      recentLogs: logs.slice(0, 10),
      period: `${days} days`,
    }
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  static async cleanupOldLogs(retentionDays: number = 365) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const deletedCount = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        // Keep safety-related logs longer
        NOT: {
          resource: AUDIT_RESOURCES.SAFETY,
        },
      },
    })

    // Log the cleanup action
    await this.logSystemAction({
      action: AUDIT_ACTIONS.SYSTEM_CLEANUP,
      details: {
        type: 'audit_logs',
        deletedCount: deletedCount.count,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      },
    })

    return deletedCount.count
  }

  /**
   * Get audit statistics for admin dashboard
   */
  static async getAuditStatistics(days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [
      totalLogs,
      safetyLogs,
      userActions,
      sessionActions,
      paymentActions,
      uniqueUsers,
    ] = await Promise.all([
      prisma.auditLog.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.auditLog.count({
        where: {
          resource: AUDIT_RESOURCES.SAFETY,
          createdAt: { gte: startDate },
        },
      }),
      prisma.auditLog.count({
        where: {
          resource: AUDIT_RESOURCES.USER,
          createdAt: { gte: startDate },
        },
      }),
      prisma.auditLog.count({
        where: {
          resource: AUDIT_RESOURCES.SESSION,
          createdAt: { gte: startDate },
        },
      }),
      prisma.auditLog.count({
        where: {
          resource: AUDIT_RESOURCES.PAYMENT,
          createdAt: { gte: startDate },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          createdAt: { gte: startDate },
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ])

    return {
      totalLogs,
      safetyLogs,
      userActions,
      sessionActions,
      paymentActions,
      uniqueUsers: uniqueUsers.length,
      period: `${days} days`,
    }
  }
}

// Convenience functions for common audit operations
export const auditLog = AuditService.log
export const logUserAction = AuditService.logUserAction
export const logSafetyAction = AuditService.logSafetyAction
export const logSessionAction = AuditService.logSessionAction
export const logPaymentAction = AuditService.logPaymentAction
export const logReviewAction = AuditService.logReviewAction
export const logAdminAction = AuditService.logAdminAction
export const logSystemAction = AuditService.logSystemAction