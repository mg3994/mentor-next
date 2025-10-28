import { z } from 'zod'

// User validation schemas
export const userRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
})

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const userProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters').optional(),
  image: z.string().url('Invalid image URL').optional(),
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
  mentorId: z.string().cuid('Invalid mentor ID'),
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
  reportedId: z.string().cuid('Invalid user ID'),
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
  userId: z.string().cuid('Invalid user ID'),
  action: z.enum(['SUSPEND', 'REACTIVATE', 'DELETE']),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(200, 'Reason must be less than 200 characters').optional(),
})

export const adminReportActionSchema = z.object({
  reportId: z.string().cuid('Invalid report ID'),
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
  userIds: z.array(z.string().cuid('Invalid user ID')).min(1, 'At least one user ID required').max(100, 'Maximum 100 users per batch'),
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
export const advancedMentorSearchSchema = mentorSearchSchema.extend({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5').optional(),
  experience: z.enum(['BEGINNER', 'INTERMEDIATE', 'EXPERT']).optional(),
  verified: z.boolean().optional(),
  languages: z.array(z.string()).optional(),
  sortBy: z.enum(['rating', 'price', 'experience', 'sessions']).default('rating'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// User blocking validation
export const userBlockSchema = z.object({
  blockedUserId: z.string().cuid('Invalid user ID'),
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