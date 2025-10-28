'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Files, 
  BarChart3, 
  Shield, 
  Clock,
  Users,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Download,
  Upload,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { FileSharingService, type FileShareStats, type SessionFileInfo } from '@/lib/file-sharing-service'

interface FileManagementDashboardProps {
  sessionId: string
  userId: string
  userName: string
  isHost: boolean
}

export default function FileManagementDashboard({ 
  sessionId, 
  userId, 
  userName,
  isHost 
}: FileManagementDashboardProps) {
  const [files, setFiles] = useState<SessionFileInfo[]>([])
  const [stats, setStats] = useState<FileShareStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileSharingService] = useState(() => new FileSharingService(sessionId, userId, isHost))

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [filesData, statsData] = await Promise.all([
        fileSharingService.loadFiles(),
        fileSharingService.getStats()
      ])
      
      setFiles(filesData)
      setStats(statsData)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    return FileSharingService.formatFileSize(bytes)
  }

  const getStorageUsagePercentage = (): number => {
    if (!stats) return 0
    const maxStorage = 1024 * 1024 * 1024 // 1GB limit per session
    return Math.min((stats.totalSize / maxStorage) * 100, 100)
  }

  const getFileTypeDistribution = () => {
    if (!stats) return []
    
    return Object.entries(stats.filesByType).map(([type, count]) => ({
      type,
      count,
      percentage: (count / stats.totalFiles) * 100
    }))
  }

  const getRecentFiles = () => {
    return files
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 5)
  }

  const getExpiringFiles = () => {
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    return files.filter(file => {
      const expiryDate = new Date(file.expiresAt)
      return expiryDate > now && expiryDate <= weekFromNow
    })
  }

  const getSecuritySummary = () => {
    const secureFiles = files.filter(f => f.scanStatus === 'passed').length
    const pendingFiles = files.filter(f => f.scanStatus === 'pending').length
    const threatFiles = files.filter(f => f.scanStatus === 'failed').length
    
    return { secureFiles, pendingFiles, threatFiles }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin mr-2" />
        <span>Loading file management data...</span>
      </div>
    )
  }

  const storagePercentage = getStorageUsagePercentage()
  const fileTypeDistribution = getFileTypeDistribution()
  const recentFiles = getRecentFiles()
  const expiringFiles = getExpiringFiles()
  const securitySummary = getSecuritySummary()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center space-x-2">
          <Files className="h-6 w-6" />
          <span>File Management Dashboard</span>
        </h2>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Files className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Files</p>
                  <p className="text-2xl font-bold">{stats.totalFiles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Storage Used</p>
                  <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${storagePercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Expiring Soon</p>
                  <p className="text-2xl font-bold">{stats.expiringFiles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Security Status</p>
                  <p className="text-2xl font-bold">{securitySummary.secureFiles}</p>
                  <p className="text-xs text-gray-500">
                    {securitySummary.pendingFiles} pending, {securitySummary.threatFiles} threats
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Files */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentFiles.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No files uploaded yet</p>
                  ) : (
                    recentFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {FileSharingService.getFileTypeIcon(file.mimeType)}
                          </span>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[200px]">
                              {file.fileName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.fileSize)} • {FileSharingService.formatTimeAgo(file.uploadedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {file.scanStatus === 'passed' && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          {file.scanStatus === 'failed' && (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* File Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">File Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fileTypeDistribution.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No files to analyze</p>
                  ) : (
                    fileTypeDistribution.map((item) => (
                      <div key={item.type} className="flex items-center justify-between">
                        <span className="text-sm">{item.type}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{item.count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expiring Files Alert */}
          {expiringFiles.length > 0 && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                {expiringFiles.length} file(s) will expire within 7 days. Consider downloading important files.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats && Object.entries(stats.uploadsByUser).map(([user, count]) => (
                    <div key={user} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">{user}</span>
                      </div>
                      <Badge variant="outline">{count} files</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Storage Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Storage Usage</span>
                    <span className="text-sm font-medium">{storagePercentage.toFixed(1)}%</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        storagePercentage > 80 ? 'bg-red-600' : 
                        storagePercentage > 60 ? 'bg-yellow-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${storagePercentage}%` }}
                    />
                  </div>
                  
                  {stats && (
                    <div className="text-xs text-gray-500">
                      {formatFileSize(stats.totalSize)} of 1GB used
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-600">Secure Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p className="text-3xl font-bold">{securitySummary.secureFiles}</p>
                  <p className="text-sm text-gray-600">Files passed security scan</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-yellow-600">Pending Scans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-yellow-600" />
                  <p className="text-3xl font-bold">{securitySummary.pendingFiles}</p>
                  <p className="text-sm text-gray-600">Files being scanned</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-600">Security Threats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-red-600" />
                  <p className="text-3xl font-bold">{securitySummary.threatFiles}</p>
                  <p className="text-sm text-gray-600">Threats detected and blocked</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">File Retention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Expired Files</h4>
                    <p className="text-sm text-gray-600">
                      {stats?.expiredFiles || 0} files have expired and can be cleaned up
                    </p>
                  </div>
                  <Button variant="outline" disabled={!stats?.expiredFiles}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Up
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Expiring Soon</h4>
                    <p className="text-sm text-gray-600">
                      {stats?.expiringFiles || 0} files will expire within 7 days
                    </p>
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Guidelines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Files are automatically deleted after 30 days</p>
                  <p>• Maximum file size: 100MB per file</p>
                  <p>• Maximum storage: 1GB per session</p>
                  <p>• All files are scanned for security threats</p>
                  <p>• Only session participants can access files</p>
                  <p>• File sharing permissions can be managed by the session host</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}