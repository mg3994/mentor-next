import { createLogger, format, transports } from 'winston'

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

// Log context interface
interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  action?: string
  resource?: string
  metadata?: Record<string, any>
}

// Create Winston logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: {
    service: 'mentor-platform',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console transport for development
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    
    // File transports for production
    ...(process.env.NODE_ENV === 'production' ? [
      new transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    ] : [])
  ],
})

// Application logger class
export class AppLogger {
  private static instance: AppLogger
  private logger = logger

  private constructor() {}

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger()
    }
    return AppLogger.instance
  }

  private formatMessage(message: string, context?: LogContext) {
    return {
      message,
      ...context,
      timestamp: new Date().toISOString(),
    }
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.logger.error(this.formatMessage(message, {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    }))
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(this.formatMessage(message, context))
  }

  info(message: string, context?: LogContext) {
    this.logger.info(this.formatMessage(message, context))
  }

  http(message: string, context?: LogContext) {
    this.logger.http(this.formatMessage(message, context))
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(this.formatMessage(message, context))
  }

  // Specific logging methods for common scenarios
  userAction(action: string, userId: string, metadata?: Record<string, any>) {
    this.info(`User action: ${action}`, {
      userId,
      action,
      metadata,
    })
  }

  apiRequest(method: string, path: string, userId?: string, duration?: number) {
    this.http(`${method} ${path}`, {
      userId,
      action: 'api_request',
      metadata: {
        method,
        path,
        duration,
      },
    })
  }

  paymentEvent(event: string, transactionId: string, userId: string, amount?: number) {
    this.info(`Payment event: ${event}`, {
      userId,
      action: 'payment',
      resource: transactionId,
      metadata: {
        event,
        amount,
      },
    })
  }

  sessionEvent(event: string, sessionId: string, userId: string, metadata?: Record<string, any>) {
    this.info(`Session event: ${event}`, {
      userId,
      sessionId,
      action: 'session',
      metadata: {
        event,
        ...metadata,
      },
    })
  }

  securityEvent(event: string, userId?: string, metadata?: Record<string, any>) {
    this.warn(`Security event: ${event}`, {
      userId,
      action: 'security',
      metadata: {
        event,
        ...metadata,
      },
    })
  }

  performanceMetric(metric: string, value: number, context?: LogContext) {
    this.info(`Performance metric: ${metric}`, {
      ...context,
      action: 'performance',
      metadata: {
        metric,
        value,
      },
    })
  }
}

// Singleton instance
export const appLogger = AppLogger.getInstance()

// Request logging middleware
export function createRequestLogger() {
  return (req: Request, res: Response, next: Function) => {
    const start = Date.now()
    const requestId = crypto.randomUUID()
    
    // Add request ID to headers
    res.setHeader('X-Request-ID', requestId)
    
    // Log request
    appLogger.http('Incoming request', {
      requestId,
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    // Log response (this would need to be adapted for Next.js API routes)
    const originalSend = res.send
    res.send = function(body) {
      const duration = Date.now() - start
      
      appLogger.http('Request completed', {
        requestId,
        metadata: {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          responseSize: body ? body.length : 0,
        },
      })
      
      return originalSend.call(this, body)
    }

    next()
  }
}

// Database query logging
export function logDatabaseQuery(query: string, duration: number, context?: LogContext) {
  appLogger.debug('Database query executed', {
    ...context,
    action: 'database_query',
    metadata: {
      query: query.substring(0, 200), // Truncate long queries
      duration,
    },
  })
}

// Cache operation logging
export function logCacheOperation(operation: string, key: string, hit: boolean, context?: LogContext) {
  appLogger.debug(`Cache ${operation}`, {
    ...context,
    action: 'cache_operation',
    metadata: {
      operation,
      key,
      hit,
    },
  })
}

// External service call logging
export function logExternalServiceCall(
  service: string, 
  endpoint: string, 
  duration: number, 
  success: boolean,
  context?: LogContext
) {
  const level = success ? 'info' : 'warn'
  appLogger[level](`External service call: ${service}`, {
    ...context,
    action: 'external_service',
    metadata: {
      service,
      endpoint,
      duration,
      success,
    },
  })
}

// Business logic logging
export function logBusinessEvent(event: string, context?: LogContext) {
  appLogger.info(`Business event: ${event}`, {
    ...context,
    action: 'business_event',
    metadata: {
      event,
    },
  })
}

// Error tracking integration (placeholder)
export function trackError(error: Error, context?: LogContext) {
  appLogger.error('Application error', error, context)
  
  // In production, integrate with error tracking services like Sentry
  if (process.env.NODE_ENV === 'production') {
    // Example: Sentry.captureException(error, { contexts: context })
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static timers = new Map<string, number>()

  static start(operation: string): void {
    this.timers.set(operation, Date.now())
  }

  static end(operation: string, context?: LogContext): number {
    const startTime = this.timers.get(operation)
    if (!startTime) {
      appLogger.warn(`Performance timer not found: ${operation}`)
      return 0
    }

    const duration = Date.now() - startTime
    this.timers.delete(operation)

    appLogger.performanceMetric(operation, duration, context)
    return duration
  }

  static async measure<T>(
    operation: string, 
    fn: () => Promise<T>, 
    context?: LogContext
  ): Promise<T> {
    this.start(operation)
    try {
      const result = await fn()
      this.end(operation, context)
      return result
    } catch (error) {
      this.end(operation, context)
      throw error
    }
  }
}

// Structured logging for specific domains
export const authLogger = {
  login: (userId: string, success: boolean, metadata?: Record<string, any>) => {
    appLogger.info(`User ${success ? 'logged in' : 'login failed'}`, {
      userId,
      action: 'auth_login',
      metadata: { success, ...metadata },
    })
  },
  
  logout: (userId: string) => {
    appLogger.info('User logged out', {
      userId,
      action: 'auth_logout',
    })
  },
  
  register: (userId: string, role: string) => {
    appLogger.info('User registered', {
      userId,
      action: 'auth_register',
      metadata: { role },
    })
  },
}

export const bookingLogger = {
  created: (sessionId: string, mentorId: string, menteeId: string, amount: number) => {
    appLogger.info('Booking created', {
      userId: menteeId,
      sessionId,
      action: 'booking_created',
      metadata: { mentorId, amount },
    })
  },
  
  cancelled: (sessionId: string, userId: string, reason?: string) => {
    appLogger.info('Booking cancelled', {
      userId,
      sessionId,
      action: 'booking_cancelled',
      metadata: { reason },
    })
  },
  
  completed: (sessionId: string, userId: string, duration: number) => {
    appLogger.info('Booking completed', {
      userId,
      sessionId,
      action: 'booking_completed',
      metadata: { duration },
    })
  },
}