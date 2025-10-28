'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Upload, 
  Download, 
  Trash2, 
  File, 
  Image, 
  FileText,
  Archive,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  Users,
  Eye,
  EyeOff,
  Share2,
  Lock,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface SessionFile {
  id: string
  sessionId: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedBy: string
  uploadedAt: Date
  expiresAt: Date
  downloadUrl: string
  isSecure?: boolean
  scanStatus?: 'pending' | 'passed' | 'failed'
  uploader?: {
    id: string
    name: string
  }
}

interface FilePermissions {
  canUpload: boolean
  canDownload: boolean
  canDelete: boolean
  canShare: boolean
}

interface SessionFileManagerProps {
  sessionId: string
  userId: string
  userName: string
  isHost: boolean
  permissions?: FilePermissions
}

export default function SessionFileManager({ 
  sessionId, 
  userId, 
  userName,
  isHost,
  permissions = {
    canUpload: true,
    canDownload: true,
    canDelete: true,
    canShare: true
  }
}: SessionFileManagerProps) {
  const [files, setFiles] = useState<SessionFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showExpired, setShowExpired] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'images' | 'documents' | 'archives'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFiles()
    // Set up periodic refresh to check for new files
    const interval = setInterval(loadFiles, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadFiles = async () => {
    try {
      const response = await fetch(`/api/sessions/files?sessionId=${sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load files')
      }
      
      const data = await response.json()
      setFiles(data.files || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      uploadFiles(Array.from(selectedFiles))
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    
    if (!permissions.canUpload) {
      setError('You do not have permission to upload files')
      return
    }
    
    const droppedFiles = Array.from(event.dataTransfer.files)
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    if (permissions.canUpload) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const uploadFiles = async (filesToUpload: File[]) => {
    if (!permissions.canUpload) {
      setError('You do not have permission to upload files')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]
        
        // Update progress
        setUploadProgress(((i + 1) / filesToUpload.length) * 100)
        
        // Create form data
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sessionId', sessionId)
        formData.append('uploadedBy', userId)
        
        // Upload file
        const response = await fetch('/api/sessions/files/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'File upload failed')
        }
        
        const result = await response.json()
        
        // Add to files list
        setFiles(prev => [result.file, ...prev])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const downloadFile = async (file: SessionFile) => {
    if (!permissions.canDownload) {
      setError('You do not have permission to download files')
      return
    }

    try {
      const response = await fetch(`/api/sessions/files/${file.id}/download`)
      
      if (!response.ok) {
        throw new Error('File download failed')
      }
      
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File download failed')
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!permissions.canDelete) {
      setError('You do not have permission to delete files')
      return
    }

    try {
      const response = await fetch(`/api/sessions/files/${fileId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'File deletion failed')
      }
      
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File deletion failed')
    }
  }

  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return

    try {
      const deletePromises = Array.from(selectedFiles).map(fileId => 
        fetch(`/api/sessions/files/${fileId}`, { method: 'DELETE' })
      )
      
      await Promise.all(deletePromises)
      
      setFiles(prev => prev.filter(f => !selectedFiles.has(f.id)))
      setSelectedFiles(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk deletion failed')
    }
  }

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    setSelectedFiles(newSelection)
  }

  const selectAllFiles = () => {
    const visibleFiles = getFilteredAndSortedFiles()
    setSelectedFiles(new Set(visibleFiles.map(f => f.id)))
  }

  const clearSelection = () => {
    setSelectedFiles(new Set())
  }

  const getFileTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    } else if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
      return <FileText className="h-4 w-4" />
    } else if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return <Archive className="h-4 w-4" />
    } else {
      return <File className="h-4 w-4" />
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const isFileExpired = (expiresAt: Date) => {
    return new Date(expiresAt) < new Date()
  }

  const getDaysUntilExpiry = (expiresAt: Date) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffMs = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getFilteredAndSortedFiles = () => {
    let filtered = files.filter(file => {
      // Filter by expiry status
      if (!showExpired && isFileExpired(file.expiresAt)) {
        return false
      }

      // Filter by type
      if (filterType !== 'all') {
        switch (filterType) {
          case 'images':
            return file.mimeType.startsWith('image/')
          case 'documents':
            return file.mimeType.includes('pdf') || file.mimeType.includes('document') || file.mimeType.startsWith('text/')
          case 'archives':
            return file.mimeType.includes('zip') || file.mimeType.includes('archive')
          default:
            return true
        }
      }

      return true
    })

    // Sort files
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.fileName.localeCompare(b.fileName)
        case 'size':
          return b.fileSize - a.fileSize
        case 'date':
        default:
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      }
    })

    return filtered
  }

  const getScanStatusIcon = (scanStatus?: string) => {
    switch (scanStatus) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
      default:
        return <Shield className="h-4 w-4 text-gray-400" />
    }
  }

  const filteredFiles = getFilteredAndSortedFiles()
  const expiredFilesCount = files.filter(f => isFileExpired(f.expiresAt)).length

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <File className="h-5 w-5" />
            <span>Session Files</span>
            <Badge variant="outline">{filteredFiles.length}</Badge>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {selectedFiles.size > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Clear ({selectedFiles.size})
                </Button>
                {permissions.canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelectedFiles}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Upload Area */}
        {permissions.canUpload && (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or click to select
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                'Select Files'
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            />
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading files...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* File Management Controls */}
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Files</option>
              <option value="images">Images</option>
              <option value="documents">Documents</option>
              <option value="archives">Archives</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            {expiredFilesCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExpired(!showExpired)}
                className="text-xs"
              >
                {showExpired ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {showExpired ? 'Hide' : 'Show'} Expired ({expiredFilesCount})
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAllFiles}
              className="text-xs"
            >
              Select All
            </Button>
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No files {filterType !== 'all' ? `(${filterType})` : ''} found</p>
              <p className="text-sm">
                {permissions.canUpload 
                  ? 'Upload files to share with your session partner'
                  : 'Files will appear here when shared'
                }
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const expired = isFileExpired(file.expiresAt)
              const daysUntilExpiry = getDaysUntilExpiry(file.expiresAt)
              const isSelected = selectedFiles.has(file.id)
              
              return (
                <div
                  key={file.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-200' 
                      : expired 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFileSelection(file.id)}
                    className="rounded"
                  />
                  
                  <div className="flex-shrink-0 flex items-center space-x-2">
                    {getFileTypeIcon(file.mimeType)}
                    {getScanStatusIcon(file.scanStatus)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.fileName}
                      </p>
                      {expired && (
                        <Badge variant="destructive" className="text-xs">
                          Expired
                        </Badge>
                      )}
                      {!expired && daysUntilExpiry <= 7 && (
                        <Badge variant="outline" className="text-xs">
                          {daysUntilExpiry}d left
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(file.uploadedAt)}</span>
                      {file.uploadedBy === userId ? (
                        <>
                          <span>•</span>
                          <span className="text-blue-600">You</span>
                        </>
                      ) : file.uploader ? (
                        <>
                          <span>•</span>
                          <span>{file.uploader.name}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {permissions.canDownload && !expired && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadFile(file)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {permissions.canShare && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Share file"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {permissions.canDelete && (file.uploadedBy === userId || isHost) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFile(file.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* File Guidelines */}
        <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Shield className="h-3 w-3" />
              <span>Files are automatically scanned for security</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>30-day retention period</span>
            </div>
            <div className="flex items-center space-x-1">
              <Lock className="h-3 w-3" />
              <span>Session participants only</span>
            </div>
          </div>
          <p>• Maximum file size: 100MB • Supported: Images, PDF, Office docs, Text, Archives</p>
        </div>
      </CardContent>
    </Card>
  )
}