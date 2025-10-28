// File Sharing Service
// Handles file sharing logic, permissions, and access control

export interface FileSharePermissions {
  canUpload: boolean
  canDownload: boolean
  canDelete: boolean
  canShare: boolean
  canManagePermissions: boolean
}

export interface SessionFileInfo {
  id: string
  sessionId: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedBy: string
  uploadedAt: Date
  expiresAt: Date
  downloadUrl: string
  scanStatus?: 'pending' | 'passed' | 'failed'
  uploader?: {
    id: string
    name: string
  }
}

export interface FileShareStats {
  totalFiles: number
  totalSize: number
  filesByType: Record<string, number>
  uploadsByUser: Record<string, number>
  expiringFiles: number
  expiredFiles: number
}

export class FileSharingService {
  private sessionId: string
  private userId: string
  private isHost: boolean

  constructor(sessionId: string, userId: string, isHost: boolean = false) {
    this.sessionId = sessionId
    this.userId = userId
    this.isHost = isHost
  }

  // Get user permissions for file operations
  getPermissions(): FileSharePermissions {
    return {
      canUpload: true, // All participants can upload
      canDownload: true, // All participants can download
      canDelete: this.isHost, // Only host can delete others' files
      canShare: true, // All participants can share
      canManagePermissions: this.isHost, // Only host can manage permissions
    }
  }

  // Get file-specific permissions
  getFilePermissions(file: SessionFileInfo): FileSharePermissions & { isOwner: boolean } {
    const basePermissions = this.getPermissions()
    const isOwner = file.uploadedBy === this.userId

    return {
      ...basePermissions,
      canDelete: basePermissions.canDelete || isOwner,
      isOwner,
    }
  }

  // Load session files
  async loadFiles(): Promise<SessionFileInfo[]> {
    try {
      const response = await fetch(`/api/sessions/files?sessionId=${this.sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load files')
      }
      
      const data = await response.json()
      return data.files || []
      
    } catch (error) {
      console.error('Load files error:', error)
      throw error
    }
  }

  // Upload file
  async uploadFile(file: File): Promise<SessionFileInfo> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sessionId', this.sessionId)
      formData.append('uploadedBy', this.userId)
      
      const response = await fetch('/api/sessions/files/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'File upload failed')
      }
      
      const result = await response.json()
      return result.file
      
    } catch (error) {
      console.error('Upload file error:', error)
      throw error
    }
  }

  // Download file
  async downloadFile(fileId: string, fileName: string): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/files/${fileId}/download`)
      
      if (!response.ok) {
        throw new Error('File download failed')
      }
      
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Download file error:', error)
      throw error
    }
  }

  // Delete file
  async deleteFile(fileId: string): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/files/${fileId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'File deletion failed')
      }
      
    } catch (error) {
      console.error('Delete file error:', error)
      throw error
    }
  }

  // Delete multiple files
  async deleteFiles(fileIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results: { success: string[]; failed: string[] } = { success: [], failed: [] }
    
    for (const fileId of fileIds) {
      try {
        await this.deleteFile(fileId)
        results.success.push(fileId)
      } catch (error) {
        results.failed.push(fileId)
      }
    }
    
    return results
  }

  // Get file sharing statistics
  async getStats(): Promise<FileShareStats> {
    try {
      const files = await this.loadFiles()
      
      const stats: FileShareStats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.fileSize, 0),
        filesByType: {},
        uploadsByUser: {},
        expiringFiles: 0,
        expiredFiles: 0,
      }

      const now = new Date()
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      files.forEach(file => {
        // Count by type
        const type = this.getFileCategory(file.mimeType)
        stats.filesByType[type] = (stats.filesByType[type] || 0) + 1

        // Count by uploader
        const uploaderName = file.uploader?.name || `User ${file.uploadedBy}`
        stats.uploadsByUser[uploaderName] = (stats.uploadsByUser[uploaderName] || 0) + 1

        // Count expiring/expired files
        const expiryDate = new Date(file.expiresAt)
        if (expiryDate < now) {
          stats.expiredFiles++
        } else if (expiryDate < weekFromNow) {
          stats.expiringFiles++
        }
      })

      return stats
      
    } catch (error) {
      console.error('Get stats error:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        filesByType: {},
        uploadsByUser: {},
        expiringFiles: 0,
        expiredFiles: 0,
      }
    }
  }

  // Validate file before upload
  validateFile(file: File): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      errors.push('File size exceeds 100MB limit')
    }

    if (file.size === 0) {
      errors.push('File is empty')
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'text/plain', 'text/csv', 'text/markdown',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
    ]

    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`)
    }

    // Check filename
    if (file.name.length > 255) {
      warnings.push('Filename is very long')
    }

    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js']
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (dangerousExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed for security reasons`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Get file category for statistics
  private getFileCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'Images'
    if (mimeType.includes('pdf')) return 'PDFs'
    if (mimeType.includes('document') || mimeType.includes('word')) return 'Documents'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Spreadsheets'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentations'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archives'
    if (mimeType.startsWith('text/')) return 'Text Files'
    return 'Other'
  }

  // Format file size for display
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format time ago for display
  static formatTimeAgo(date: Date): string {
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

  // Check if file is expired
  static isFileExpired(expiresAt: Date): boolean {
    return new Date(expiresAt) < new Date()
  }

  // Get days until expiry
  static getDaysUntilExpiry(expiresAt: Date): number {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffMs = expiry.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }

  // Get file type icon
  static getFileTypeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📽️'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️'
    if (mimeType.startsWith('text/')) return '📄'
    return '📎'
  }
}

// Utility functions

export function createFileSharingService(
  sessionId: string, 
  userId: string, 
  isHost: boolean = false
): FileSharingService {
  return new FileSharingService(sessionId, userId, isHost)
}

export function validateFileUpload(file: File): { isValid: boolean; message?: string } {
  const maxSize = 100 * 1024 * 1024 // 100MB
  
  if (file.size > maxSize) {
    return { isValid: false, message: 'File size exceeds 100MB limit' }
  }
  
  if (file.size === 0) {
    return { isValid: false, message: 'File is empty' }
  }
  
  const allowedTypes = [
    'image/', 'application/pdf', 'text/', 'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.ms-', 'application/zip'
  ]
  
  const isAllowed = allowedTypes.some(type => file.type.startsWith(type))
  if (!isAllowed) {
    return { isValid: false, message: 'File type not supported' }
  }
  
  return { isValid: true }
}

export function getFileSecurityStatus(scanStatus?: string): {
  status: 'secure' | 'scanning' | 'threat' | 'unknown'
  message: string
  color: string
} {
  switch (scanStatus) {
    case 'passed':
      return { status: 'secure', message: 'File is secure', color: 'green' }
    case 'failed':
      return { status: 'threat', message: 'Security threat detected', color: 'red' }
    case 'pending':
      return { status: 'scanning', message: 'Security scan in progress', color: 'yellow' }
    default:
      return { status: 'unknown', message: 'Security status unknown', color: 'gray' }
  }
}