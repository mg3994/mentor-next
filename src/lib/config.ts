// Production configuration and environment management

export const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  
  // Server
  PORT: parseInt(process.env.PORT || '3000'),
  HOST: process.env.HOST || 'localhost',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,
  DATABASE_POOL_SIZE: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
  
  // Redis
  REDIS_URL: process.env.REDIS_URL!,
  REDIS_TTL: parseInt(process.env.REDIS_TTL || '3600'),
  
  // Authentication
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  JWT_SECRET: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!,
  
  // Payment Gateway
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID!,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET!,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET!,
  
  // File Storage
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'), // 10MB
  ALLOWED_FILE_TYPES: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,jpg,jpeg,png').split(','),
  
  // Email (if implemented)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  
  // External Services
  DAILY_API_KEY: process.env.DAILY_API_KEY,
  DAILY_DOMAIN: process.env.DAILY_DOMAIN,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  
  // Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
  
  // Monitoring
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  
  // Feature Flags
  FEATURES: {
    ENABLE_REGISTRATION: process.env.ENABLE_REGISTRATION !== 'false',
    ENABLE_PAYMENTS: process.env.ENABLE_PAYMENTS !== 'false',
    ENABLE_FILE_SHARING: process.env.ENABLE_FILE_SHARING !== 'false',
    ENABLE_VIDEO_CALLS: process.env.ENABLE_VIDEO_CALLS !== 'false',
    ENABLE_REVIEWS: process.env.ENABLE_REVIEWS !== 'false',
  },
  
  // Business Logic
  PLATFORM_FEE_PERCENTAGE: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10'),
  MIN_SESSION_DURATION: parseInt(process.env.MIN_SESSION_DURATION || '30'), // minutes
  MAX_SESSION_DURATION: parseInt(process.env.MAX_SESSION_DURATION || '180'), // minutes
  FILE_RETENTION_DAYS: parseInt(process.env.FILE_RETENTION_DAYS || '30'),
  PAYOUT_DELAY_HOURS: parseInt(process.env.PAYOUT_DELAY_HOURS || '24'),
  
  // UI Configuration
  ITEMS_PER_PAGE: parseInt(process.env.ITEMS_PER_PAGE || '20'),
  MAX_SEARCH_RESULTS: parseInt(process.env.MAX_SEARCH_RESULTS || '100'),
  
  // Cache Configuration
  CACHE_TTL: {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
  },
}

// Validation function to ensure required environment variables are set
export function validateConfig() {
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'ENCRYPTION_KEY',
  ]

  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

// Initialize configuration validation
if (config.IS_PRODUCTION) {
  validateConfig()
}

export default config