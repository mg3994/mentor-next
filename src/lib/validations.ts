import { z } from 'zod'

// User validation schemas
export const userRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
})

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
  isMentor: z.boolean().default(false),
  isMentee: z.boolean().default(true),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const userLoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, 'Password is required'),
})

export const userProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters').optional(),
  image: z.string().url({ message: 'Invalid image URL' }).optional(),
})

// Mentee profile validation
export const menteeProfileSchema = z.object({
  learningGoals: z.string().max(500, 'Learning goals must be less than 500 characters').optional(),
  interests: z.array(z.string().min(1, 'Interest cannot be empty')).max(10, 'Maximum 10 interests allowed'),
  timezone: z.string().min(1, 'Timezone is required'),
})

// Mentor profile validation
export const mentorProfileSchema = z.object({
  bio: z.string().min(50, 'Bio must be at least 50 characters').max(1000, 'Bio must be less than 1000 characters'),
  expertise: z.array(z.string().min(1, 'Expertise cannot be empty')).min(1, 'At least one expertise required').max(10, 'Maximum 10 expertise areas allowed'),
  experience: z.string().min(10, 'Experience description must be at least 10 characters').max(500, 'Experience must be less than 500 characters'),
  education: z.string().max(200, 'Education must be less than 200 characters').optional(),
  certifications: z.array(z.string().min(1, 'Certification cannot be empty')).max(10, 'Maximum 10 certifications allowed'),
  timezone: z.string().min(1, 'Timezone is required'),
})

// Pricing model validation
export const pricingModelSchema = z.object({
  type: z.enum(['ONE_TIME', 'HOURLY', 'MONTHLY_SUBSCRIPTION']),
  price: z.number().min(0.01, 'Price must be greater than 0').max(10000, 'Price too high'),
  duration: z.number().min(15, 'Minimum session duration is 15 minutes').max(480, 'Maximum session duration is 8 hours').optional(),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
})

// Availability validation
export const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0, 'Invalid day').max(6, 'Invalid day'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
})

// Session booking validation
export const sessionBookingSchema = z.object({
  mentorId: z.string().cuid2({ message: 'Invalid mentor ID' }),
  startTime: z.date().min(new Date(), 'Session must be in the future'),
  scheduledEnd: z.date(),
  pricingType: z.enum(['ONE_TIME', 'HOURLY', 'MONTHLY_SUBSCRIPTION']),
  agreedPrice: z.number().min(0.01, 'Price must be greater than 0'),
}).refine((data) => data.scheduledEnd > data.startTime, {
  message: 'End time must be after start time',
  path: ['scheduledEnd'],
})

// Review validation
export const reviewSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().max(500, 'Comment must be less than 500 characters').optional(),
})

// Report validation
export const reportSchema = z.object({
  reportedId: z.string().cuid2({ message: 'Invalid user ID' }),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(100, 'Reason must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

// Support ticket validation
export const supportTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(100, 'Subject must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
})

// Support message validation
export const supportMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(1000, 'Message must be less than 1000 characters'),
})

// Search validation
export const mentorSearchSchema = z.object({
  query: z.string().max(100, 'Search query too long').optional(),
  expertise: z.array(z.string()).optional(),
  minPrice: z.number().min(0, 'Price cannot be negative').optional(),
  maxPrice: z.number().min(0, 'Price cannot be negative').optional(),
  availability: z.string().optional(), // ISO date string
  timezone: z.string().optional(),
  page: z.number().min(1, 'Page must be at least 1').default(1),
  limit: z.number().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(10),
}).refine((data) => {
  if (data.minPrice && data.maxPrice) {
    return data.minPrice <= data.maxPrice
  }
  return true
}, {
  message: 'Minimum price cannot be greater than maximum price',
  path: ['maxPrice'],
})

// File upload validation
export const fileUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileSize: z.number().min(1, 'File cannot be empty').max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
  mimeType: z.string().min(1, 'MIME type is required'),
})

// Session note validation
export const sessionNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty').max(2000, 'Note content must be less than 2000 characters'),
})

// Admin validation schemas
export const adminUserManagementSchema = z.object({
  userId: z.string().cuid2({ message: 'Invalid user ID' }),
  action: z.enum(['SUSPEND', 'REACTIVATE', 'DELETE']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(200, 'Reason must be less than 200 characters').optional(),
})

export const adminReportActionSchema = z.object({
  reportId: z.string().cuid2({ message: 'Invalid report ID' }),
  action: z.enum(['RESOLVE', 'DISMISS', 'ESCALATE']),
  resolution: z.string().min(10, 'Resolution must be at least 10 characters').max(500, 'Resolution must be less than 500 characters').optional(),
})

// Payout validation
export const mentorPayoutSchema = z.object({
  amount: z.number().min(1, 'Minimum payout amount is $1').max(10000, 'Maximum payout amount is $10,000'),
  payoutMethod: z.string().min(1, 'Payout method is required').optional(),
})

// Audit log validation
export const auditLogSchema = z.object({
  action: z.string().min(1, 'Action is required').max(100, 'Action must be less than 100 characters'),
  resource: z.string().min(1, 'Resource is required').max(50, 'Resource must be less than 50 characters'),
  details: z.record(z.string(), z.any()).optional(),
})

// Bulk operations validation
export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string().cuid2({ message: 'Invalid user ID' })).min(1, 'At least one user ID required').max(100, 'Maximum 100 users per batch'),
  action: z.enum(['SUSPEND', 'REACTIVATE', 'DELETE']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(200, 'Reason must be less than 200 characters').optional(),
})

// Session management validation
export const sessionUpdateSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  recordingConsent: z.boolean().optional(),
  actualDuration: z.number().min(1, 'Duration must be at least 1 minute').max(600, 'Duration cannot exceed 10 hours').optional(),
})

// Analytics validation
export const analyticsQuerySchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  metrics: z.array(z.enum(['users', 'sessions', 'revenue', 'completion_rate'])).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate
  }
  return true
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate'],
})

// Enhanced search validation with more filters
export const advancedMentorSearchSchema = z.object({
  query: z.string().max(100, 'Search query too long').optional(),
  expertise: z.array(z.string()).optional(),
  minPrice: z.number().min(0, 'Price cannot be negative').optional(),
  maxPrice: z.number().min(0, 'Price cannot be negative').optional(),
  availability: z.string().optional(), // ISO date string
  timezone: z.string().optional(),
  page: z.number().min(1, 'Page must be at least 1').default(1),
  limit: z.number().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(10),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5').optional(),
  experience: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']).optional(),
  verified: z.boolean().optional(),
  languages: z.array(z.string()).optional(),
  sortBy: z.enum(['rating', 'price', 'experience', 'sessions']).default('rating'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).refine((data) => {
  if (data.minPrice && data.maxPrice) {
    return data.minPrice <= data.maxPrice
  }
  return true
}, {
  message: 'Minimum price cannot be greater than maximum price',
  path: ['maxPrice'],
})

// User blocking validation
export const userBlockSchema = z.object({
  blockedUserId: z.string().cuid2({ message: 'Invalid user ID' }),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(200, 'Reason must be less than 200 characters').optional(),
})

// Type exports for use in components
export type UserRegistration = z.infer<typeof userRegistrationSchema>
export type UserLogin = z.infer<typeof userLoginSchema>
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>
export type MenteeProfile = z.infer<typeof menteeProfileSchema>
export type MentorProfile = z.infer<typeof mentorProfileSchema>
export type PricingModel = z.infer<typeof pricingModelSchema>
export type Availability = z.infer<typeof availabilitySchema>
export type SessionBooking = z.infer<typeof sessionBookingSchema>
export type Review = z.infer<typeof reviewSchema>
export type Report = z.infer<typeof reportSchema>
export type SupportTicket = z.infer<typeof supportTicketSchema>
export type SupportMessage = z.infer<typeof supportMessageSchema>
export type MentorSearch = z.infer<typeof mentorSearchSchema>
export type FileUpload = z.infer<typeof fileUploadSchema>
export type SessionNote = z.infer<typeof sessionNoteSchema>
export type AdminUserManagement = z.infer<typeof adminUserManagementSchema>
export type AdminReportAction = z.infer<typeof adminReportActionSchema>
export type MentorPayout = z.infer<typeof mentorPayoutSchema>
export type AuditLog = z.infer<typeof auditLogSchema>
export type BulkUserAction = z.infer<typeof bulkUserActionSchema>
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
export type AdvancedMentorSearch = z.infer<typeof advancedMentorSearchSchema>
export type UserBlock = z.infer<typeof userBlockSchema>

// Enhanced validation schemas for audit logging and database operations

// Audit log validation
export const auditLogCreateSchema = z.object({
  userId: z.string().cuid2({ message: 'Invalid user ID' }).optional(),
  action: z.string().min(1, 'Action is required').max(100, 'Action must be less than 100 characters'),
  resource: z.string().min(1, 'Resource is required').max(50, 'Resource must be less than 50 characters'),
  resourceId: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address').optional(),
  userAgent: z.string().max(500, 'User agent too long').optional(),
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }).optional(),
})

// Database operation validation
export const databaseOperationSchema = z.object({
  operation: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE']),
  table: z.string().min(1, 'Table name is required'),
  recordId: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
  auditData: z.object({
    ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address').optional(),
    userAgent: z.string().max(500, 'User agent too long').optional(),
  }).optional(),
})

// Enhanced user management validation
export const userManagementSchema = z.object({
  userId: z.string().cuid2({ message: 'Invalid user ID' }),
  action: z.enum(['CREATE', 'UPDATE', 'SUSPEND', 'REACTIVATE', 'DELETE']),
  data: z.record(z.string(), z.any()).optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500, 'Reason must be less than 500 characters').optional(),
  adminUserId: z.string().cuid2({ message: 'Invalid admin user ID' }).optional(),
})

// Safety action validation
export const safetyActionSchema = z.object({
  action: z.enum(['BLOCK', 'UNBLOCK', 'REPORT', 'RESOLVE_REPORT', 'DISMISS_REPORT']),
  userId: z.string().cuid2({ message: 'Invalid user ID' }),
  targetUserId: z.string().cuid2({ message: 'Invalid target user ID' }).optional(),
  reportId: z.string().cuid2({ message: 'Invalid report ID' }).optional(),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500, 'Reason must be less than 500 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  resolution: z.string().max(1000, 'Resolution must be less than 1000 characters').optional(),
})

// Session management validation
export const sessionManagementSchema = z.object({
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }),
  action: z.enum(['CREATE', 'START', 'COMPLETE', 'CANCEL', 'UPDATE']),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  data: z.record(z.string(), z.any()).optional(),
  userId: z.string().cuid2({ message: 'Invalid user ID' }).optional(),
})

// File operation validation
export const fileOperationSchema = z.object({
  action: z.enum(['UPLOAD', 'DOWNLOAD', 'DELETE', 'SCAN']),
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }),
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileSize: z.number().min(1, 'File cannot be empty').max(50 * 1024 * 1024, 'File size cannot exceed 50MB'),
  mimeType: z.string().min(1, 'MIME type is required'),
  userId: z.string().cuid2({ message: 'Invalid user ID' }),
})

// Payment operation validation
export const paymentOperationSchema = z.object({
  action: z.enum(['CREATE', 'PROCESS', 'COMPLETE', 'FAIL', 'REFUND', 'PAYOUT']),
  transactionId: z.string().cuid2({ message: 'Invalid transaction ID' }).optional(),
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }).optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0').max(100000, 'Amount too large'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  paymentMethod: z.string().min(1, 'Payment method is required').optional(),
  userId: z.string().cuid2({ message: 'Invalid user ID' }).optional(),
})

// Review operation validation
export const reviewOperationSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'MODERATE']),
  reviewId: z.string().cuid2({ message: 'Invalid review ID' }).optional(),
  sessionId: z.string().cuid2({ message: 'Invalid session ID' }),
  reviewerId: z.string().cuid2({ message: 'Invalid reviewer ID' }),
  revieweeId: z.string().cuid2({ message: 'Invalid reviewee ID' }),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().max(1000, 'Comment must be less than 1000 characters').optional(),
  moderationReason: z.string().max(500, 'Moderation reason must be less than 500 characters').optional(),
})

// Database health check validation
export const healthCheckSchema = z.object({
  checkType: z.enum(['CONNECTION', 'PERFORMANCE', 'INTEGRITY', 'STATS']),
  includeStats: z.boolean().default(false),
  includeTables: z.array(z.string()).optional(),
})

// Batch operation validation
export const batchOperationSchema = z.object({
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  table: z.string().min(1, 'Table name is required'),
  records: z.array(z.record(z.string(), z.any())).min(1, 'At least one record required').max(1000, 'Maximum 1000 records per batch'),
  validateEach: z.boolean().default(true),
})

// Data export validation
export const dataExportSchema = z.object({
  tables: z.array(z.string()).min(1, 'At least one table required'),
  format: z.enum(['JSON', 'CSV', 'XML']).default('JSON'),
  includeRelations: z.boolean().default(false),
  dateRange: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }).optional(),
  filters: z.record(z.string(), z.any()).optional(),
})

// Data import validation
export const dataImportSchema = z.object({
  table: z.string().min(1, 'Table name is required'),
  data: z.array(z.record(z.string(), z.any())).min(1, 'At least one record required'),
  format: z.enum(['JSON', 'CSV']),
  validateData: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
})

// System maintenance validation
export const maintenanceOperationSchema = z.object({
  operation: z.enum(['CLEANUP', 'BACKUP', 'OPTIMIZE', 'REINDEX', 'VACUUM']),
  tables: z.array(z.string()).optional(),
  retentionDays: z.number().min(1, 'Retention days must be at least 1').max(3650, 'Maximum retention is 10 years').optional(),
  dryRun: z.boolean().default(false),
})

// Performance monitoring validation
export const performanceMonitoringSchema = z.object({
  queryName: z.string().min(1, 'Query name is required'),
  duration: z.number().min(0, 'Duration cannot be negative'),
  recordCount: z.number().min(0, 'Record count cannot be negative').optional(),
  memoryUsage: z.number().min(0, 'Memory usage cannot be negative').optional(),
  cpuUsage: z.number().min(0, 'CPU usage cannot be negative').max(100, 'CPU usage cannot exceed 100%').optional(),
})

// Cache operation validation
export const cacheOperationSchema = z.object({
  operation: z.enum(['GET', 'SET', 'DELETE', 'CLEAR', 'INVALIDATE']),
  key: z.string().min(1, 'Cache key is required'),
  value: z.any().optional(),
  ttl: z.number().min(1, 'TTL must be at least 1 second').max(86400, 'Maximum TTL is 24 hours').optional(),
  tags: z.array(z.string()).optional(),
})

// Enhanced search validation with more options
export const enhancedSearchSchema = z.object({
  query: z.string().max(200, 'Search query too long').optional(),
  filters: z.record(z.string(), z.any()).optional(),
  sort: z.object({
    field: z.string().min(1, 'Sort field is required'),
    direction: z.enum(['asc', 'desc']).default('asc'),
  }).optional(),
  pagination: z.object({
    page: z.number().min(1, 'Page must be at least 1').default(1),
    limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
  }).optional(),
  includeCount: z.boolean().default(false),
  includeRelations: z.array(z.string()).optional(),
})

// Notification validation
export const notificationSchema = z.object({
  type: z.enum(['EMAIL', 'SMS', 'PUSH', 'IN_APP']),
  recipient: z.string().min(1, 'Recipient is required'),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  scheduledFor: z.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

// Type exports for enhanced validation schemas
export type AuditLogCreate = z.infer<typeof auditLogCreateSchema>
export type DatabaseOperation = z.infer<typeof databaseOperationSchema>
export type UserManagement = z.infer<typeof userManagementSchema>
export type SafetyAction = z.infer<typeof safetyActionSchema>
export type SessionManagement = z.infer<typeof sessionManagementSchema>
export type FileOperation = z.infer<typeof fileOperationSchema>
export type PaymentOperation = z.infer<typeof paymentOperationSchema>
export type ReviewOperation = z.infer<typeof reviewOperationSchema>
export type HealthCheck = z.infer<typeof healthCheckSchema>
export type BatchOperation = z.infer<typeof batchOperationSchema>
export type DataExport = z.infer<typeof dataExportSchema>
export type DataImport = z.infer<typeof dataImportSchema>
export type MaintenanceOperation = z.infer<typeof maintenanceOperationSchema>
export type PerformanceMonitoring = z.infer<typeof performanceMonitoringSchema>
export type CacheOperation = z.infer<typeof cacheOperationSchema>
export type EnhancedSearch = z.infer<typeof enhancedSearchSchema>
export type Notification = z.infer<typeof notificationSchema>

// Validation helper functions
export function validateAndSanitizeInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ')
      throw new Error(`Validation failed: ${errorMessages}`)
    }
    throw error
  }
}

export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (input: unknown): T => {
    return validateAndSanitizeInput(schema, input)
  }
}

// Common validation patterns
export const commonPatterns = {
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]{10,}$/, 'Invalid phone number'),
  url: z.string().url({ message: 'Invalid URL' }),
  cuid: z.string().cuid2({ message: 'Invalid ID format' }),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  timezone: z.string().min(1, 'Timezone is required'),
  currency: z.string().length(3, 'Currency must be 3 characters'),
  language: z.string().length(2, 'Language must be 2 characters'),
  country: z.string().length(2, 'Country must be 2 characters'),
}

// Validation error handling
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function handleValidationError(error: z.ZodError): ValidationError[] {
  return error.issues.map((err: any) => new ValidationError(
    err.message,
    err.path.join('.'),
    err.code
  ))
}