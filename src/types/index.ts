// Re-export Prisma types for convenience
export type {
  User,
  UserRole,
  MenteeProfile,
  MentorProfile,
  PricingModel,
  Availability,
  Session,
  Transaction,
  Review,
  SessionFile,
  SessionNote,
  Report,
  UserBlock,
  SupportTicket,
  SupportMessage,
  AuditLog,
  Role,
  RoleStatus,
  PricingType,
  SessionStatus,
  TransactionStatus,
  ReportStatus,
  TicketStatus,
  TicketPriority,
} from '@prisma/client'

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  code: string
  message: string
  details?: any
  timestamp: string
}