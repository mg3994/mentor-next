'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  FileX,
  Users,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  AlertCircle
} from 'lucide-react'

interface SecurityStats {
  totalSessions: number
  securityEvents: number
  suspiciousActivities: number
  filesScanned: number
  threatsBlocked: number
}

interface SecurityEvent {
  id: string
  sessionId: string
  eventType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  timestamp: Date
  userId?: string
}

interface CleanupStats {
  totalFiles: number
  expiredFiles: number
  totalSize: string
  expiredSize: string
  cleanupRecommended: boolean
}

export default function SecurityMonitor() {
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([])
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cleanupInProgress, setCleanupInProgress] = useState(false)

  useEffect(() => {
    loadSecurityData()
    loadCleanupStats()
  }, [])

  const loadSecurityData = async () => {
    try {
      // This would be replaced with actual API calls
      // For demo purposes, using mock data
      setStats({
        totalSessions: 1247,
        securityEvents: 23,
        suspiciousActivities: 5,
        filesScanned: 3421,
        threatsBlocked: 12
      })

      setRecentEvents([
        {
          id: '1',
          sessionId: 'sess_123',
          eventType: 'FILE_SECURITY_SCAN_FAILED',
          severity: 'HIGH',
          description: 'Malicious file detected and blocked',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          userId: 'user_456'
        },
        {
          id: '2',
          sessionId: 'sess_789',
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'MEDIUM',
          description: 'Multiple rapid file uploads detected',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          userId: 'user_789'
        },
        {
          id: '3',
          sessionId: 'sess_456',
          eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          severity: 'HIGH',
          description: 'Attempt to access files from different session',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          userId: 'user_123'
        }
      ])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data')
    }
  }

  const loadCleanupStats = async () => {
    try {
      const response = await fetch('/api/admin/cleanup')
      if (!response.ok) throw new Error('Failed to load cleanup stats')
      
      const data = await response.json()
      setCleanupStats(data.stats)
      
    } catch (err) {
      console.error('Failed to load cleanup stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const runCleanup = async (dryRun: boolean = false) => {
    try {
      setCleanupInProgress(true)
      setError(null)

      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun }),
      })

      if (!response.ok) throw new Error('Cleanup operation failed')

      const result = await response.json()
      
      if (dryRun) {
        alert(`Cleanup Preview:\n${JSON.stringify(result.stats, null, 2)}`)
      } else {
        alert(`Cleanup Completed:\n${JSON.stringify(result.result, null, 2)}`)
        await loadCleanupStats() // Refresh stats
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup operation failed')
    } finally {
      setCleanupInProgress(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-600'
      case 'HIGH': return 'bg-red-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Less than 1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading security data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Monitor</h1>
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Security Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold">{stats.totalSessions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Security Events</p>
                  <p className="text-2xl font-bold">{stats.securityEvents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Suspicious Activities</p>
                  <p className="text-2xl font-bold">{stats.suspiciousActivities}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Files Scanned</p>
                  <p className="text-2xl font-bold">{stats.filesScanned}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileX className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Threats Blocked</p>
                  <p className="text-2xl font-bold">{stats.threatsBlocked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="cleanup">File Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Security Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      <div>
                        <p className="font-medium">{event.description}</p>
                        <p className="text-sm text-gray-600">
                          Session: {event.sessionId} • User: {event.userId || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {formatTimeAgo(event.timestamp)}
                      </p>
                      <p className="text-xs text-gray-500">{event.eventType}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Management Tab */}
        <TabsContent value="cleanup">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cleanup Stats */}
            {cleanupStats && (
              <Card>
                <CardHeader>
                  <CardTitle>File Storage Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Files</p>
                      <p className="text-2xl font-bold">{cleanupStats.totalFiles}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expired Files</p>
                      <p className="text-2xl font-bold text-red-600">{cleanupStats.expiredFiles}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Size</p>
                      <p className="text-lg font-semibold">{cleanupStats.totalSize}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expired Size</p>
                      <p className="text-lg font-semibold text-red-600">{cleanupStats.expiredSize}</p>
                    </div>
                  </div>

                  {cleanupStats.cleanupRecommended && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Cleanup recommended: {cleanupStats.expiredFiles} expired files can be removed
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cleanup Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Cleanup Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button
                    onClick={() => runCleanup(true)}
                    disabled={cleanupInProgress}
                    variant="outline"
                    className="w-full"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Preview Cleanup
                  </Button>
                  
                  <Button
                    onClick={() => runCleanup(false)}
                    disabled={cleanupInProgress}
                    variant="destructive"
                    className="w-full"
                  >
                    {cleanupInProgress ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileX className="h-4 w-4 mr-2" />
                    )}
                    {cleanupInProgress ? 'Cleaning...' : 'Run Cleanup'}
                  </Button>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Preview shows what would be deleted without actually removing files</p>
                  <p>• Cleanup removes expired files permanently</p>
                  <p>• Session files: 30-day retention</p>
                  <p>• Recordings: 365-day retention</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Security Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Security analytics dashboard</p>
                <p className="text-sm">Detailed analytics and trends would be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}