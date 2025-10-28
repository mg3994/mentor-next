'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  Download, 
  Trash2, 
  File, 
  Image, 
  FileText,
  Archive,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { RecordingService, type FileShareData, formatFileSize } from '@/lib/recording-service'

interface FileSharingProps {
  sessionId: string
  userId: string
  recordingService: RecordingService
}

export default function FileSharing({ sessionId, userId, recordingService }: FileSharingProps) {
  const [files, setFiles] = useState<FileShareData[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const sessionFiles = await recordingService.getSessionFiles()
      setFiles(sessionFiles)
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
    
    const droppedFiles = Array.from(event.dataTransfer.files)
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]
        
        // Update progress
        setUploadProgress(((i + 1) / filesToUpload.length) * 100)
        
        // Upload file
        const uploadedFile = await recordingService.uploadFile(file)
        
        // Add to files list
        setFiles(prev => [uploadedFile, ...prev])
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

  const downloadFile = async (file: FileShareData) => {
    try {
      await recordingService.downloadFile(file.id, file.fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File download failed')
    }
  }

  const deleteFile = async (fileId: string) => {
    try {
      await recordingService.deleteFile(fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File deletion failed')
    }
  }

  const getFileTypeIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />
    } else if (fileType === 'application/pdf' || fileType.startsWith('text/')) {
      return <FileText className="h-4 w-4" />
    } else if (fileType.includes('zip') || fileType.includes('archive')) {
      return <Archive className="h-4 w-4" />
    } else {
      return <File className="h-4 w-4" />
    }
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Session Files</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Upload Area */}
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

        {/* Files List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {files.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No files shared yet</p>
              <p className="text-sm">Upload files to share with your session partner</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0">
                  {getFileTypeIcon(file.fileType)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.fileName}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(file.uploadedAt)}</span>
                    {file.uploadedBy === userId && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600">You</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(file)}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  
                  {file.uploadedBy === userId && (
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
            ))
          )}
        </div>

        {/* File Guidelines */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Maximum file size: 100MB</p>
          <p>• Supported formats: Images, PDF, Office docs, Text, Archives</p>
          <p>• Files expire 30 days after upload</p>
        </div>
      </CardContent>
    </Card>
  )
}