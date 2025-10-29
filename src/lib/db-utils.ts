import { prisma } from './db'

// Enum constants (using string literals since Prisma enums aren't exported)
const Role = {
  MENTEE: 'MENTEE',
  MENTOR: 'MENTOR',
  ADMIN: 'ADMIN',
} as const

const RoleStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const

const SessionStatus = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const

const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const

const PricingType = {
  ONE_TIME: 'ONE_TIME',
  HOURLY: 'HOURLY',
  MONTHLY_SUBSCRIPTION: 'MONTHLY_SUBSCRIPTION',
} as const

type Role = typeof Role[keyof typeof Role]
type RoleStatus = typeof RoleStatus[keyof typeof RoleStatus]
type SessionStatus = typeof SessionStatus[keyof typeof SessionStatus]
type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus]
type PricingType = typeof PricingType[keyof typeof PricingType]

// User utilities
export async function createUser(data: {
  email: string
  name: string
  image?: string
}) {
  return await prisma.user.create({
    data,
    include: {
      roles: true,
    },
  })
}

export async function getUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      roles: true,
      menteeProfile: true,
      mentorProfile: true,
    },
  })
}

export async function getUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      roles: true,
      menteeProfile: true,
      mentorProfile: true,
    },
  })
}

// Role management utilities
export async function addUserRole(userId: string, role: Role) {
  return await prisma.userRole.create({
    data: {
      userId,
      role,
      status: RoleStatus.PENDING,
    },
  })
}

export async function activateUserRole(userId: string, role: Role) {
  return await prisma.userRole.update({
    where: {
      userId_role: {
        userId,
        role,
      },
    },
    data: {
      status: RoleStatus.ACTIVE,
    },
  })
}

export async function getUserRoles(userId: string) {
  return await prisma.userRole.findMany({
    where: { userId },
  })
}

// Mentor profile utilities
export async function createMentorProfile(data: {
  userId: string
  bio: string
  expertise: string[]
  experience: string
  education?: string
  certifications: string[]
  timezone: string
}) {
  return await prisma.mentorProfile.create({
    data,
    include: {
      user: true,
      pricingModels: true,
      availability: true,
    },
  })
}

export async function getMentorProfile(userId: string) {
  return await prisma.mentorProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      pricingModels: {
        where: { isActive: true },
      },
      availability: {
        where: { isActive: true },
      },
    },
  })
}

export async function updateMentorRating(mentorId: string) {
  const reviews = await prisma.review.findMany({
    where: {
      revieweeId: mentorId,
    },
  })

  if (reviews.length === 0) return

  const averageRating = reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / reviews.length
  const totalSessions = await prisma.session.count({
    where: {
      mentorId,
      status: SessionStatus.COMPLETED,
    },
  })

  return await prisma.mentorProfile.update({
    where: { userId: mentorId },
    data: {
      averageRating,
      totalSessions,
    },
  })
}

// Session utilities
export async function createSession(data: {
  mentorId: string
  menteeId: string
  startTime: Date
  scheduledEnd: Date
  pricingType: PricingType
  agreedPrice: number
}) {
  return await prisma.session.create({
    data: {
      ...data,
      sessionLink: generateSessionLink(),
    },
    include: {
      mentor: true,
      mentee: true,
    },
  })
}

export async function getUpcomingSessions(userId: string) {
  return await prisma.session.findMany({
    where: {
      OR: [
        { mentorId: userId },
        { menteeId: userId },
      ],
      startTime: {
        gte: new Date(),
      },
      status: SessionStatus.SCHEDULED,
    },
    include: {
      mentor: true,
      mentee: true,
    },
    orderBy: {
      startTime: 'asc',
    },
  })
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus, endTime?: Date) {
  const updateData: any = { status }
  if (endTime) {
    updateData.endTime = endTime
    // Calculate actual duration if session is completed
    if (status === SessionStatus.COMPLETED) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { startTime: true },
      })
      if (session) {
        updateData.actualDuration = Math.round((endTime.getTime() - session.startTime.getTime()) / (1000 * 60))
      }
    }
  }

  return await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
  })
}

// Search utilities
export async function searchMentors(params: {
  query?: string
  expertise?: string[]
  minPrice?: number
  maxPrice?: number
  page?: number
  limit?: number
}) {
  const { query, expertise, minPrice, maxPrice, page = 1, limit = 10 } = params
  const skip = (page - 1) * limit

  const where: any = {
    isVerified: true,
    user: {
      roles: {
        some: {
          role: Role.MENTOR,
          status: RoleStatus.ACTIVE,
        },
      },
    },
  }

  if (query) {
    where.OR = [
      { bio: { contains: query, mode: 'insensitive' } },
      { expertise: { hasSome: [query] } },
      { user: { name: { contains: query, mode: 'insensitive' } } },
    ]
  }

  if (expertise && expertise.length > 0) {
    where.expertise = { hasSome: expertise }
  }

  if (minPrice || maxPrice) {
    where.pricingModels = {
      some: {
        isActive: true,
        ...(minPrice && { price: { gte: minPrice } }),
        ...(maxPrice && { price: { lte: maxPrice } }),
      },
    }
  }

  const [mentors, total] = await Promise.all([
    prisma.mentorProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        pricingModels: {
          where: { isActive: true },
        },
      },
      skip,
      take: limit,
      orderBy: [
        { averageRating: 'desc' },
        { totalSessions: 'desc' },
      ],
    }),
    prisma.mentorProfile.count({ where }),
  ])

  return {
    mentors,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

// Safety utilities
export async function createReport(data: {
  reporterId: string
  reportedId: string
  reason: string
  description?: string
}) {
  return await prisma.report.create({
    data,
    include: {
      reporter: {
        select: { id: true, name: true, email: true },
      },
      reported: {
        select: { id: true, name: true, email: true },
      },
    },
  })
}

export async function blockUser(blockerId: string, blockedId: string, reason?: string) {
  return await prisma.userBlock.create({
    data: {
      blockerId,
      blockedId,
      reason,
    },
  })
}

export async function isUserBlocked(userId1: string, userId2: string) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  })
  return !!block
}

// Audit logging utility
export async function createAuditLog(data: {
  userId?: string
  action: string
  resource: string
  details?: any
  ipAddress?: string
  userAgent?: string
}) {
  return await prisma.auditLog.create({
    data,
  })
}

// Transaction utilities
export async function createTransaction(data: {
  sessionId: string
  amount: number
  platformFee: number
  mentorEarnings: number
  paymentMethod?: string
}) {
  return await prisma.transaction.create({
    data: {
      ...data,
      status: TransactionStatus.PENDING,
    },
  })
}

export async function completeTransaction(transactionId: string) {
  return await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: TransactionStatus.COMPLETED,
      completedAt: new Date(),
    },
  })
}

// File management utilities
export async function createSessionFile(data: {
  sessionId: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  uploadedBy: string
}) {
  // Set expiration to 30 days from now
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  return await prisma.sessionFile.create({
    data: {
      ...data,
      expiresAt,
    },
  })
}

export async function getExpiredFiles() {
  return await prisma.sessionFile.findMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

export async function deleteExpiredFiles() {
  return await prisma.sessionFile.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

// Helper functions
function generateSessionLink(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// Support ticket utilities
export async function createSupportTicket(data: {
  userId: string
  subject: string
  description: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}) {
  return await prisma.supportTicket.create({
    data,
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  })
}

export async function addSupportMessage(data: {
  ticketId: string
  senderId: string
  message: string
  isStaff?: boolean
}) {
  return await prisma.supportMessage.create({
    data,
  })
}

// Additional utility functions for comprehensive database operations

// Mentee profile utilities
export async function createMenteeProfile(data: {
  userId: string
  learningGoals?: string
  interests: string[]
  timezone: string
}) {
  return await prisma.menteeProfile.create({
    data,
    include: {
      user: true,
    },
  })
}

export async function getMenteeProfile(userId: string) {
  return await prisma.menteeProfile.findUnique({
    where: { userId },
    include: {
      user: true,
    },
  })
}

export async function updateMenteeProfile(userId: string, data: {
  learningGoals?: string
  interests?: string[]
  timezone?: string
}) {
  return await prisma.menteeProfile.update({
    where: { userId },
    data,
  })
}

// Pricing model utilities
export async function createPricingModel(data: {
  mentorId: string
  type: PricingType
  price: number
  duration?: number
  description?: string
}) {
  return await prisma.pricingModel.create({
    data,
  })
}

export async function updatePricingModel(id: string, data: {
  price?: number
  duration?: number
  description?: string
  isActive?: boolean
}) {
  return await prisma.pricingModel.update({
    where: { id },
    data,
  })
}

export async function getMentorPricingModels(mentorId: string) {
  return await prisma.pricingModel.findMany({
    where: { 
      mentorId,
      isActive: true,
    },
  })
}

// Availability utilities
export async function createAvailability(data: {
  mentorId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}) {
  return await prisma.availability.create({
    data,
  })
}

export async function updateAvailability(id: string, data: {
  startTime?: string
  endTime?: string
  isActive?: boolean
}) {
  return await prisma.availability.update({
    where: { id },
    data,
  })
}

export async function getMentorAvailability(mentorId: string) {
  return await prisma.availability.findMany({
    where: { 
      mentorId,
      isActive: true,
    },
    orderBy: [
      { dayOfWeek: 'asc' },
      { startTime: 'asc' },
    ],
  })
}

// Session file utilities
export async function getSessionFiles(sessionId: string) {
  return await prisma.sessionFile.findMany({
    where: { sessionId },
    orderBy: { uploadedAt: 'desc' },
  })
}

export async function deleteSessionFile(id: string) {
  return await prisma.sessionFile.delete({
    where: { id },
  })
}

// Session note utilities
export async function createSessionNote(data: {
  sessionId: string
  content: string
  createdBy: string
}) {
  return await prisma.sessionNote.create({
    data,
  })
}

export async function getSessionNotes(sessionId: string) {
  return await prisma.sessionNote.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function updateSessionNote(id: string, content: string) {
  return await prisma.sessionNote.update({
    where: { id },
    data: { content },
  })
}

// Review utilities
export async function createReview(data: {
  sessionId: string
  reviewerId: string
  revieweeId: string
  rating: number
  comment?: string
}) {
  const review = await prisma.review.create({
    data,
  })

  // Update mentor's average rating
  await updateMentorRating(data.revieweeId)

  return review
}

export async function updateReview(id: string, data: {
  rating?: number
  comment?: string
}) {
  return await prisma.review.update({
    where: { id },
    data,
  })
}

export async function getMentorReviews(mentorId: string, limit = 10) {
  return await prisma.review.findMany({
    where: { revieweeId: mentorId },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// Payout utilities
export async function createMentorPayout(data: {
  mentorId: string
  amount: number
  transactionIds: string[]
  payoutMethod?: string
}) {
  return await prisma.mentorPayout.create({
    data: {
      ...data,
      status: 'PENDING',
    },
  })
}

export async function processPayout(payoutId: string) {
  return await prisma.mentorPayout.update({
    where: { id: payoutId },
    data: {
      status: 'COMPLETED',
      processedAt: new Date(),
    },
  })
}

export async function getMentorEarnings(mentorId: string, startDate?: Date, endDate?: Date) {
  const where: any = {
    session: {
      mentorId,
      status: SessionStatus.COMPLETED,
    },
    status: TransactionStatus.COMPLETED,
  }

  if (startDate || endDate) {
    where.completedAt = {}
    if (startDate) where.completedAt.gte = startDate
    if (endDate) where.completedAt.lte = endDate
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      session: true,
    },
  })

  const totalEarnings = transactions.reduce((sum: number, transaction: any) => sum + transaction.mentorEarnings, 0)
  const totalSessions = transactions.length

  return {
    totalEarnings,
    totalSessions,
    transactions,
  }
}

// Admin utilities
export async function getAllUsers(params: {
  page?: number
  limit?: number
  search?: string
  role?: Role
}) {
  const { page = 1, limit = 20, search, role } = params
  const skip = (page - 1) * limit

  const where: any = {}

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (role) {
    where.roles = {
      some: { role },
    }
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        roles: true,
        menteeProfile: true,
        mentorProfile: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

export async function suspendUser(userId: string, reason?: string) {
  // Update all user roles to suspended
  await prisma.userRole.updateMany({
    where: { userId },
    data: { status: RoleStatus.SUSPENDED },
  })

  // Create audit log
  await createAuditLog({
    userId,
    action: 'USER_SUSPENDED',
    resource: 'user',
    details: { reason },
  })

  return true
}

export async function reactivateUser(userId: string) {
  // Update all user roles to active
  await prisma.userRole.updateMany({
    where: { userId },
    data: { status: RoleStatus.ACTIVE },
  })

  // Create audit log
  await createAuditLog({
    userId,
    action: 'USER_REACTIVATED',
    resource: 'user',
  })

  return true
}

// Analytics utilities
export async function getPlatformAnalytics() {
  const [
    totalUsers,
    totalMentors,
    totalMentees,
    totalSessions,
    completedSessions,
    totalRevenue,
    activeUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        roles: {
          some: {
            role: Role.MENTOR,
            status: RoleStatus.ACTIVE,
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        roles: {
          some: {
            role: Role.MENTEE,
            status: RoleStatus.ACTIVE,
          },
        },
      },
    }),
    prisma.session.count(),
    prisma.session.count({
      where: { status: SessionStatus.COMPLETED },
    }),
    prisma.transaction.aggregate({
      where: { status: TransactionStatus.COMPLETED },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    }),
  ])

  return {
    totalUsers,
    totalMentors,
    totalMentees,
    totalSessions,
    completedSessions,
    completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
    totalRevenue: totalRevenue._sum.amount || 0,
    activeUsers,
  }
}

// Cleanup utilities
export async function cleanupExpiredData() {
  // Delete expired session files
  const expiredFiles = await getExpiredFiles()
  
  if (expiredFiles.length > 0) {
    await deleteExpiredFiles()
    
    // Log cleanup action
    await createAuditLog({
      action: 'CLEANUP_EXPIRED_FILES',
      resource: 'session_files',
      details: { deletedCount: expiredFiles.length },
    })
  }

  return { deletedFiles: expiredFiles.length }
}

// Enhanced audit logging utilities for safety tracking
export async function logUserAction(data: {
  userId: string
  action: string
  resource: string
  resourceId?: string
  details?: any
  ipAddress?: string
  userAgent?: string
}) {
  return await createAuditLog({
    userId: data.userId,
    action: data.action,
    resource: data.resource,
    details: {
      resourceId: data.resourceId,
      ...data.details,
    },
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  })
}

export async function logSafetyAction(data: {
  userId?: string
  action: 'USER_BLOCKED' | 'USER_REPORTED' | 'REPORT_RESOLVED' | 'ACCOUNT_SUSPENDED' | 'ACCOUNT_REACTIVATED'
  targetUserId?: string
  reason?: string
  details?: any
  ipAddress?: string
  userAgent?: string
}) {
  return await createAuditLog({
    userId: data.userId,
    action: data.action,
    resource: 'safety',
    details: {
      targetUserId: data.targetUserId,
      reason: data.reason,
      ...data.details,
    },
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  })
}

export async function logPaymentAction(data: {
  userId?: string
  action: 'PAYMENT_CREATED' | 'PAYMENT_COMPLETED' | 'PAYMENT_FAILED' | 'PAYOUT_PROCESSED'
  transactionId?: string
  amount?: number
  details?: any
}) {
  return await createAuditLog({
    userId: data.userId,
    action: data.action,
    resource: 'payment',
    details: {
      transactionId: data.transactionId,
      amount: data.amount,
      ...data.details,
    },
  })
}

export async function logSessionAction(data: {
  userId?: string
  action: 'SESSION_CREATED' | 'SESSION_STARTED' | 'SESSION_COMPLETED' | 'SESSION_CANCELLED'
  sessionId: string
  details?: any
}) {
  return await createAuditLog({
    userId: data.userId,
    action: data.action,
    resource: 'session',
    details: {
      sessionId: data.sessionId,
      ...data.details,
    },
  })
}

// Database health check utilities
export async function checkDatabaseHealth() {
  try {
    // Test basic database connectivity
    await prisma.$queryRaw`SELECT 1`
    
    // Get basic stats
    const [userCount, sessionCount, transactionCount] = await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.transaction.count(),
    ])

    return {
      status: 'healthy',
      connectivity: true,
      stats: {
        users: userCount,
        sessions: sessionCount,
        transactions: transactionCount,
      },
      timestamp: new Date(),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      connectivity: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    }
  }
}

// Batch operations for performance
export async function batchCreateUsers(users: Array<{
  email: string
  name: string
  image?: string
}>) {
  return await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  })
}

export async function batchUpdateMentorRatings(mentorIds: string[]) {
  const results = []
  
  for (const mentorId of mentorIds) {
    try {
      const result = await updateMentorRating(mentorId)
      results.push({ mentorId, success: true, result })
    } catch (error) {
      results.push({ 
        mentorId, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    }
  }
  
  return results
}

// Enhanced database utilities with audit logging integration
import { AuditService, AUDIT_ACTIONS } from './audit-service'

// Enhanced user utilities with audit logging
export async function createUserWithAudit(data: {
  email: string
  name: string
  image?: string
}, auditData?: { ipAddress?: string; userAgent?: string }) {
  const user = await createUser(data)
  
  await AuditService.logUserAction({
    userId: user.id,
    action: AUDIT_ACTIONS.USER_CREATED,
    details: { email: data.email, name: data.name },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return user
}

export async function updateUserWithAudit(
  userId: string, 
  data: { name?: string; image?: string },
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: {
      roles: true,
      menteeProfile: true,
      mentorProfile: true,
    },
  })
  
  await AuditService.logUserAction({
    userId,
    action: AUDIT_ACTIONS.USER_UPDATED,
    details: data,
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return user
}

// Enhanced safety utilities with audit logging
export async function createReportWithAudit(
  data: {
    reporterId: string
    reportedId: string
    reason: string
    description?: string
  },
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const report = await createReport(data)
  
  await AuditService.logSafetyAction({
    userId: data.reporterId,
    action: AUDIT_ACTIONS.USER_REPORTED,
    targetUserId: data.reportedId,
    reportId: report.id,
    reason: data.reason,
    details: { description: data.description },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return report
}

export async function blockUserWithAudit(
  blockerId: string, 
  blockedId: string, 
  reason?: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const block = await blockUser(blockerId, blockedId, reason)
  
  await AuditService.logSafetyAction({
    userId: blockerId,
    action: AUDIT_ACTIONS.USER_BLOCKED,
    targetUserId: blockedId,
    reason,
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return block
}

export async function resolveReport(
  reportId: string, 
  resolvedBy: string, 
  resolution: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy,
    },
    include: {
      reporter: true,
      reported: true,
    },
  })
  
  await AuditService.logSafetyAction({
    userId: resolvedBy,
    action: AUDIT_ACTIONS.REPORT_RESOLVED,
    reportId,
    details: { resolution, reportedUserId: report.reportedId },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return report
}

// Enhanced session utilities with audit logging
export async function createSessionWithAudit(
  data: {
    mentorId: string
    menteeId: string
    startTime: Date
    scheduledEnd: Date
    pricingType: PricingType
    agreedPrice: number
  },
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const session = await createSession(data)
  
  await AuditService.logSessionAction({
    userId: data.menteeId,
    action: AUDIT_ACTIONS.SESSION_CREATED,
    sessionId: session.id,
    details: {
      mentorId: data.mentorId,
      pricingType: data.pricingType,
      agreedPrice: data.agreedPrice,
    },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return session
}

export async function updateSessionStatusWithAudit(
  sessionId: string, 
  status: SessionStatus, 
  userId?: string,
  endTime?: Date,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const session = await updateSessionStatus(sessionId, status, endTime)
  
  let action: typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]
  switch (status) {
    case SessionStatus.IN_PROGRESS:
      action = AUDIT_ACTIONS.SESSION_STARTED
      break
    case SessionStatus.COMPLETED:
      action = AUDIT_ACTIONS.SESSION_COMPLETED
      break
    case SessionStatus.CANCELLED:
      action = AUDIT_ACTIONS.SESSION_CANCELLED
      break
    default:
      action = AUDIT_ACTIONS.SESSION_CREATED
  }
  
  await AuditService.logSessionAction({
    userId,
    action,
    sessionId,
    details: { status, endTime },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return session
}

// Enhanced file management with audit logging
export async function createSessionFileWithAudit(
  data: {
    sessionId: string
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
    uploadedBy: string
  },
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const file = await createSessionFile(data)
  
  await AuditService.logSessionAction({
    userId: data.uploadedBy,
    action: AUDIT_ACTIONS.SESSION_FILE_UPLOADED,
    sessionId: data.sessionId,
    details: {
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
    },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return file
}

export async function deleteSessionFileWithAudit(
  fileId: string, 
  userId: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const file = await prisma.sessionFile.findUnique({
    where: { id: fileId },
  })
  
  if (!file) {
    throw new Error('File not found')
  }
  
  await deleteSessionFile(fileId)
  
  await AuditService.logSessionAction({
    userId,
    action: AUDIT_ACTIONS.SESSION_FILE_DELETED,
    sessionId: file.sessionId,
    details: {
      fileName: file.fileName,
      fileSize: file.fileSize,
    },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
}

// Enhanced transaction utilities with audit logging
export async function createTransactionWithAudit(
  data: {
    sessionId: string
    amount: number
    platformFee: number
    mentorEarnings: number
    paymentMethod?: string
  },
  userId?: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const transaction = await createTransaction(data)
  
  await AuditService.logPaymentAction({
    userId,
    action: AUDIT_ACTIONS.PAYMENT_CREATED,
    transactionId: transaction.id,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    details: {
      sessionId: data.sessionId,
      platformFee: data.platformFee,
      mentorEarnings: data.mentorEarnings,
    },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return transaction
}

export async function completeTransactionWithAudit(
  transactionId: string,
  userId?: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const transaction = await completeTransaction(transactionId)
  
  await AuditService.logPaymentAction({
    userId,
    action: AUDIT_ACTIONS.PAYMENT_COMPLETED,
    transactionId,
    amount: transaction.amount,
    details: {
      sessionId: transaction.sessionId,
      completedAt: transaction.completedAt,
    },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return transaction
}

// Enhanced review utilities with audit logging
export async function createReviewWithAudit(
  data: {
    sessionId: string
    reviewerId: string
    revieweeId: string
    rating: number
    comment?: string
  },
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const review = await createReview(data)
  
  await AuditService.logReviewAction({
    userId: data.reviewerId,
    action: AUDIT_ACTIONS.REVIEW_CREATED,
    reviewId: review.id,
    sessionId: data.sessionId,
    rating: data.rating,
    details: {
      revieweeId: data.revieweeId,
      hasComment: !!data.comment,
    },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return review
}

export async function updateReviewWithAudit(
  reviewId: string,
  data: { rating?: number; comment?: string },
  userId: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const review = await updateReview(reviewId, data)
  
  await AuditService.logReviewAction({
    userId,
    action: AUDIT_ACTIONS.REVIEW_UPDATED,
    reviewId,
    rating: data.rating,
    details: data,
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return review
}

// Enhanced admin utilities with audit logging
export async function suspendUserWithAudit(
  userId: string, 
  adminUserId: string, 
  reason?: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const result = await suspendUser(userId, reason)
  
  await AuditService.logAdminAction({
    adminUserId,
    action: AUDIT_ACTIONS.USER_SUSPENDED,
    targetUserId: userId,
    details: { reason },
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return result
}

export async function reactivateUserWithAudit(
  userId: string, 
  adminUserId: string,
  auditData?: { ipAddress?: string; userAgent?: string }
) {
  const result = await reactivateUser(userId)
  
  await AuditService.logAdminAction({
    adminUserId,
    action: AUDIT_ACTIONS.USER_REACTIVATED,
    targetUserId: userId,
    ipAddress: auditData?.ipAddress,
    userAgent: auditData?.userAgent,
  })
  
  return result
}

// Database connection and health utilities
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

export async function getDatabaseStats() {
  try {
    const [
      userCount,
      mentorCount,
      menteeCount,
      sessionCount,
      transactionCount,
      reviewCount,
      reportCount,
      auditLogCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.mentorProfile.count(),
      prisma.menteeProfile.count(),
      prisma.session.count(),
      prisma.transaction.count(),
      prisma.review.count(),
      prisma.report.count(),
      prisma.auditLog.count(),
    ])

    return {
      users: userCount,
      mentors: mentorCount,
      mentees: menteeCount,
      sessions: sessionCount,
      transactions: transactionCount,
      reviews: reviewCount,
      reports: reportCount,
      auditLogs: auditLogCount,
      timestamp: new Date(),
    }
  } catch (error) {
    console.error('Failed to get database stats:', error)
    throw error
  }
}

// Batch operations with transaction support
export async function batchOperationWithTransaction<T>(
  operations: (() => Promise<T>)[]
): Promise<T[]> {
  return await prisma.$transaction(async (tx) => {
    const results: T[] = []
    for (const operation of operations) {
      const result = await operation()
      results.push(result)
    }
    return results
  })
}

// Data validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/
  return phoneRegex.test(phone)
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

export function validateCUID(id: string): boolean {
  const cuidRegex = /^c[a-z0-9]{24}$/
  return cuidRegex.test(id)
}

// Performance monitoring utilities
export async function measureQueryPerformance<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now()
  const result = await queryFn()
  const duration = Date.now() - startTime
  
  console.log(`Query ${queryName} took ${duration}ms`)
  
  return { result, duration }
}

// Cache utilities for frequently accessed data
export async function getCachedMentorProfile(mentorId: string) {
  // This would integrate with Redis caching in a real implementation
  return await getMentorProfile(mentorId)
}

export async function invalidateMentorProfileCache(mentorId: string) {
  // This would clear Redis cache in a real implementation
  console.log(`Cache invalidated for mentor ${mentorId}`)
}

// Error handling utilities
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export function handlePrismaError(error: any): DatabaseError {
  if (error.code === 'P2002') {
    return new DatabaseError('Unique constraint violation', 'DUPLICATE_ENTRY', error.meta)
  }
  if (error.code === 'P2025') {
    return new DatabaseError('Record not found', 'NOT_FOUND', error.meta)
  }
  if (error.code === 'P2003') {
    return new DatabaseError('Foreign key constraint violation', 'FOREIGN_KEY_ERROR', error.meta)
  }
  
  return new DatabaseError('Database operation failed', 'UNKNOWN_ERROR', error)
}

// Cleanup utilities with enhanced logging
export async function cleanupExpiredDataWithAudit() {
  const result = await cleanupExpiredData()
  
  await AuditService.logSystemAction({
    action: AUDIT_ACTIONS.SYSTEM_CLEANUP,
    details: {
      type: 'expired_files',
      deletedFiles: result.deletedFiles,
      timestamp: new Date().toISOString(),
    },
  })
  
  return result
}

// Export enhanced utilities
export {
  AuditService,
  AUDIT_ACTIONS,
} from './audit-service'