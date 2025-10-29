// System Health Monitoring Service
// Monitors database, Redis, and other system components

import { prisma } from './db'
import { redis } from './redis'

export interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'error'
  components: {
    database: ComponentHealth
    redis: ComponentHealth
    api: ComponentHealth
    storage: ComponentHealth
  }
  metrics: {
    responseTime: number
    errorRate: number
    uptime: number
    activeConnections: number
    memoryUsage: number
    cpuUsage: number
  }
  lastChecked: Date
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'error'
  responseTime?: number
  errorMessage?: string
  lastChecked: Date
  uptime?: number
}

export class SystemHealthService {
  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const startTime = Date.now()
    
    const [database, redisHealth, api, storage] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkApiHealth(),
      this.checkStorageHealth(),
    ])

    const overallResponseTime = Date.now() - startTime

    // Determine overall health
    const components = { database, redis: redisHealth, api, storage }
    const overall = this.determineOverallHealth(components)

    // Get system metrics
    const metrics = await this.getSystemMetrics()

    return {
      overall,
      components,
      metrics: {
        ...metrics,
        responseTime: overallResponseTime,
      },
      lastChecked: new Date(),
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()
    
    try {
      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`
      
      // Test a simple query
      await prisma.user.count()
      
      const responseTime = Date.now() - startTime
      
      return {
        status: responseTime > 1000 ? 'warning' : 'healthy',
        responseTime,
        lastChecked: new Date(),
        uptime: 99.9, // Would be calculated from monitoring data
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Database connection failed',
        lastChecked: new Date(),
        uptime: 0,
      }
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()
    
    try {
      // Test basic connectivity
      await redis.ping()
      
      // Test set/get operations
      const testKey = 'health_check_' + Date.now()
      await redis.set(testKey, 'test', 'EX', 10)
      const result = await redis.get(testKey)
      await redis.del(testKey)
      
      if (result !== 'test') {
        throw new Error('Redis read/write test failed')
      }
      
      const responseTime = Date.now() - startTime
      
      return {
        status: responseTime > 500 ? 'warning' : 'healthy',
        responseTime,
        lastChecked: new Date(),
        uptime: 99.8, // Would be calculated from monitoring data
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Redis connection failed',
        lastChecked: new Date(),
        uptime: 0,
      }
    }
  }

  /**
   * Check API health
   */
  private async checkApiHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()
    
    try {
      // In a real implementation, this would make HTTP requests to key endpoints
      // For now, we'll simulate API health based on database response time
      const responseTime = Date.now() - startTime + Math.random() * 100
      
      return {
        status: responseTime > 2000 ? 'warning' : 'healthy',
        responseTime,
        lastChecked: new Date(),
        uptime: 99.95,
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'API health check failed',
        lastChecked: new Date(),
        uptime: 0,
      }
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<ComponentHealth> {
    const startTime = Date.now()
    
    try {
      // In a real implementation, this would check file system health
      // For now, we'll simulate storage health
      const responseTime = Date.now() - startTime + Math.random() * 50
      
      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date(),
        uptime: 99.99,
      }
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Storage health check failed',
        lastChecked: new Date(),
        uptime: 0,
      }
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics() {
    // In a real implementation, these would come from system monitoring tools
    // For now, we'll return simulated metrics
    return {
      responseTime: Math.random() * 200 + 50, // 50-250ms
      errorRate: Math.random() * 2, // 0-2%
      uptime: 99.9 + Math.random() * 0.09, // 99.9-99.99%
      activeConnections: Math.floor(Math.random() * 100) + 20, // 20-120
      memoryUsage: Math.random() * 40 + 40, // 40-80%
      cpuUsage: Math.random() * 60 + 20, // 20-80%
    }
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(components: Record<string, ComponentHealth>): 'healthy' | 'warning' | 'error' {
    const statuses = Object.values(components).map(c => c.status)
    
    if (statuses.includes('error')) {
      return 'error'
    }
    
    if (statuses.includes('warning')) {
      return 'warning'
    }
    
    return 'healthy'
  }

  /**
   * Get system alerts based on health status
   */
  async getSystemAlerts(): Promise<Array<{
    level: 'info' | 'warning' | 'error'
    component: string
    message: string
    timestamp: Date
  }>> {
    const health = await this.getSystemHealth()
    const alerts = []

    // Check for component issues
    for (const [component, status] of Object.entries(health.components)) {
      if (status.status === 'error') {
        alerts.push({
          level: 'error' as const,
          component,
          message: status.errorMessage || `${component} is not responding`,
          timestamp: status.lastChecked,
        })
      } else if (status.status === 'warning') {
        alerts.push({
          level: 'warning' as const,
          component,
          message: `${component} response time is elevated (${status.responseTime}ms)`,
          timestamp: status.lastChecked,
        })
      }
    }

    // Check for performance issues
    if (health.metrics.responseTime > 1000) {
      alerts.push({
        level: 'warning' as const,
        component: 'performance',
        message: `High response time detected: ${health.metrics.responseTime}ms`,
        timestamp: health.lastChecked,
      })
    }

    if (health.metrics.errorRate > 5) {
      alerts.push({
        level: 'error' as const,
        component: 'api',
        message: `High error rate detected: ${health.metrics.errorRate.toFixed(2)}%`,
        timestamp: health.lastChecked,
      })
    }

    if (health.metrics.memoryUsage > 90) {
      alerts.push({
        level: 'warning' as const,
        component: 'system',
        message: `High memory usage: ${health.metrics.memoryUsage.toFixed(1)}%`,
        timestamp: health.lastChecked,
      })
    }

    if (health.metrics.cpuUsage > 90) {
      alerts.push({
        level: 'warning' as const,
        component: 'system',
        message: `High CPU usage: ${health.metrics.cpuUsage.toFixed(1)}%`,
        timestamp: health.lastChecked,
      })
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get historical health data (would be stored in database in real implementation)
   */
  async getHealthHistory(hours: number = 24): Promise<Array<{
    timestamp: Date
    overall: 'healthy' | 'warning' | 'error'
    responseTime: number
    errorRate: number
    uptime: number
  }>> {
    // Simulate historical data
    const history = []
    const now = new Date()
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      
      const overallStatus = Math.random() > 0.1 ? 'healthy' : (Math.random() > 0.5 ? 'warning' : 'error')
      
      history.push({
        timestamp,
        overall: overallStatus as 'healthy' | 'warning' | 'error',
        responseTime: Math.random() * 200 + 50,
        errorRate: Math.random() * 3,
        uptime: 99 + Math.random() * 0.99,
      })
    }
    
    return history
  }
}

// Export singleton instance
export const systemHealthService = new SystemHealthService()