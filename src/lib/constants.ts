// Application constants

// File upload limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

// Session constants
export const MIN_SESSION_DURATION = 15 // minutes
export const MAX_SESSION_DURATION = 480 // 8 hours in minutes
export const SESSION_BUFFER_TIME = 5 // minutes before/after session

// File retention
export const FILE_RETENTION_DAYS = 30

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const MAX_PAGE_SIZE = 50

// Search limits
export const MAX_SEARCH_RESULTS = 100
export const SEARCH_DEBOUNCE_MS = 300

// Rating system
export const MIN_RATING = 1
export const MAX_RATING = 5

// Review edit window
export const REVIEW_EDIT_WINDOW_DAYS = 7

// Support ticket priorities
export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

// Report categories
export const REPORT_REASONS = [
  'Inappropriate behavior',
  'Harassment',
  'Spam',
  'Fake profile',
  'No-show',
  'Payment issues',
  'Technical issues',
  'Other',
] as const

// Timezone list (common timezones)
export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

// Expertise categories
export const EXPERTISE_CATEGORIES = [
  'Programming',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'DevOps',
  'Cloud Computing',
  'Cybersecurity',
  'UI/UX Design',
  'Product Management',
  'Digital Marketing',
  'Business Strategy',
  'Finance',
  'Career Coaching',
  'Language Learning',
  'Academic Tutoring',
  'Music',
  'Art & Design',
  'Writing',
  'Photography',
  'Fitness & Health',
  'Cooking',
  'Other',
] as const

// Platform fee percentage
export const PLATFORM_FEE_PERCENTAGE = 0.15 // 15%

// Notification settings
export const NOTIFICATION_TYPES = {
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  SESSION_STARTING: 'session_starting',
  SESSION_COMPLETED: 'session_completed',
  REVIEW_RECEIVED: 'review_received',
  PAYMENT_RECEIVED: 'payment_received',
  REPORT_SUBMITTED: 'report_submitted',
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_UPDATED: 'support_ticket_updated',
} as const

// Cache keys
export const CACHE_KEYS = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  MENTOR_PROFILE: (userId: string) => `mentor:profile:${userId}`,
  MENTOR_AVAILABILITY: (mentorId: string, date: string) => `mentor:availability:${mentorId}:${date}`,
  SEARCH_RESULTS: (query: string) => `search:mentors:${query}`,
  SESSION_DATA: (sessionId: string) => `session:${sessionId}`,
  USER_SESSIONS: (userId: string) => `user:sessions:${userId}`,
} as const

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  USER_PROFILE: 300, // 5 minutes
  MENTOR_PROFILE: 600, // 10 minutes
  SEARCH_RESULTS: 180, // 3 minutes
  AVAILABILITY: 120, // 2 minutes
  SESSION_DATA: 60, // 1 minute
} as const

// API rate limits
export const RATE_LIMITS = {
  SEARCH: { requests: 100, window: 60 }, // 100 requests per minute
  BOOKING: { requests: 10, window: 60 }, // 10 bookings per minute
  UPLOAD: { requests: 20, window: 60 }, // 20 uploads per minute
  REPORT: { requests: 5, window: 300 }, // 5 reports per 5 minutes
  SUPPORT: { requests: 10, window: 300 }, // 10 support requests per 5 minutes
} as const

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Invalid input data',
  INTERNAL_ERROR: 'An internal error occurred',
  RATE_LIMITED: 'Too many requests, please try again later',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit',
  INVALID_FILE_TYPE: 'File type not supported',
  SESSION_EXPIRED: 'Your session has expired',
  USER_BLOCKED: 'This user has been blocked',
  BOOKING_CONFLICT: 'Time slot is no longer available',
  PAYMENT_FAILED: 'Payment processing failed',
} as const

// Success messages
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'Account created successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  BOOKING_CREATED: 'Session booked successfully',
  BOOKING_CANCELLED: 'Session cancelled successfully',
  REVIEW_SUBMITTED: 'Review submitted successfully',
  REPORT_SUBMITTED: 'Report submitted successfully',
  SUPPORT_TICKET_CREATED: 'Support ticket created successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  PASSWORD_UPDATED: 'Password updated successfully',
} as const