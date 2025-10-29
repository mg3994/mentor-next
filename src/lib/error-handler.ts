import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

// Error types
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429)
  }
}

// Error handler for API routes
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)

  // Handle known application errors
  if (error instanceof AppError) {
    return NextResponse.json(
      { 
        error: error.message,
        code: error.constructor.name 
      },
      { status: error.statusCode }
    )
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }))

    return NextResponse.json(
      { 
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      },
      { status: 400 }
    )
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return NextResponse.json(
          { 
            error: 'A record with this information already exists',
            code: 'DUPLICATE_RECORD'
          },
          { status: 409 }
        )
      case 'P2025':
        return NextResponse.json(
          { 
            error: 'Record not found',
            code: 'RECORD_NOT_FOUND'
          },
          { status: 404 }
        )
      case 'P2003':
        return NextResponse.json(
          { 
            error: 'Foreign key constraint failed',
            code: 'FOREIGN_KEY_ERROR'
          },
          { status: 400 }
        )
      default:
        return NextResponse.json(
          { 
            error: 'Database operation failed',
            code: 'DATABASE_ERROR'
          },
          { status: 500 }
        )
    }
  }

  // Handle network/fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return NextResponse.json(
      { 
        error: 'External service unavailable',
        code: 'SERVICE_UNAVAILABLE'
      },
      { status: 503 }
    )
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message

    return NextResponse.json(
      { 
        error: message,
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }

  // Fallback for unknown errors
  return NextResponse.json(
    { 
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    },
    { status: 500 }
  )
}

// Async error wrapper for API routes
export function asyncHandler(
  handler: (req: Request, context?: any) => Promise<NextResponse>
) {
  return async (req: Request, context?: any): Promise<NextResponse> => {
    try {
      return await handler(req, context)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

// Error logging utility
export function logError(error: unknown, context?: Record<string, any>) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    context,
    environment: process.env.NODE_ENV,
  }

  console.error('Application Error:', JSON.stringify(errorInfo, null, 2))

  // In production, you might want to send this to an external logging service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to logging service
    // await sendToLoggingService(errorInfo)
  }
}

// Client-side error boundary
export class ErrorBoundary {
  static handleError(error: Error, errorInfo?: any) {
    console.error('React Error Boundary:', error, errorInfo)
    
    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      // sendToErrorTracking(error, errorInfo)
    }
  }
}

// Retry utility for failed operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  throw lastError!
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
    }
  }
}

// Health check utilities
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/db')
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    logError(error, { service: 'database' })
    return false
  }
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const { redis } = await import('@/lib/redis')
    await redis.ping()
    return true
  } catch (error) {
    logError(error, { service: 'redis' })
    return false
  }
}

export async function checkExternalServiceHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch (error) {
    logError(error, { service: 'external', url })
    return false
  }
}