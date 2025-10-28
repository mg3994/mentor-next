// Session Recording Service
// Handles session recording, file sharing, and media management

export interface RecordingConfig {
  sessionId: string
  userId: string
  quality: 'low' | 'medium' | 'high'
  includeAudio: boolean
  includeVideo: boolean
  includeScreen: boolean
}

export interface RecordingData {
  id: string
  sessionId: string
  fileName: string
  fileSize: number
  duration: number
  format: string
  quality: string
  createdAt: Date
  downloadUrl?: string
  thumbnailUrl?: string
}

export interface FileShareData {
  id: string
  sessionId: string
  fileName: string
  fileSize: number
  fileType: string
  uploadedBy: string
  uploadedAt: Date
  downloadUrl: string
  expiresAt: Date
}

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private isRecording = false
  private recordingStartTime: number = 0
  private config: RecordingConfig
  
  // Event callbacks
  public onRecordingStart?: () => void
  public onRecordingStop?: (recordingData: RecordingData) => void
  public onRecordingError?: (error: string) => void
  public onRecordingProgress?: (duration: number) => void

  constructor(config: RecordingConfig) {
    this.config = config
  }

  // Start recording session
  async startRecording(stream: MediaStream): Promise<void> {
    try {
      if (this.isRecording) {
        throw new Error('Recording is already in progress')
      }

      // Check browser support
      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          throw new Error('Browser does not support video recording')
        }
      }

      // Configure recording options based on quality
      const options = this.getRecordingOptions()
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, options)
      this.recordedChunks = []
      
      // Set up event handlers
      this.setupRecorderHandlers()
      
      // Start recording
      this.mediaRecorder.start(1000) // Collect data every second
      this.isRecording = true
      this.recordingStartTime = Date.now()
      
      this.onRecordingStart?.()
      
      // Update progress every second
      this.startProgressTracking()
      
    } catch (error) {
      console.error('Recording start error:', error)
      this.onRecordingError?.(error instanceof Error ? error.message : 'Failed to start recording')
      throw error
    }
  }

  // Stop recording session
  async stopRecording(): Promise<RecordingData> {
    return new Promise((resolve, reject) => {
      if (!this.isRecording || !this.mediaRecorder) {
        reject(new Error('No recording in progress'))
        return
      }

      // Set up completion handler
      this.mediaRecorder.onstop = async () => {
        try {
          const recordingData = await this.processRecording()
          resolve(recordingData)
        } catch (error) {
          reject(error)
        }
      }

      // Stop recording
      this.mediaRecorder.stop()
      this.isRecording = false
    })
  }

  // Upload file to session
  async uploadFile(file: File): Promise<FileShareData> {
    try {
      // Validate file
      this.validateFile(file)
      
      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sessionId', this.config.sessionId)
      formData.append('uploadedBy', this.config.userId)
      
      // Upload file
      const response = await fetch('/api/sessions/files/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'File upload failed')
      }
      
      const fileData = await response.json()
      return fileData.file
      
    } catch (error) {
      console.error('File upload error:', error)
      throw error
    }
  }

  // Get session files
  async getSessionFiles(): Promise<FileShareData[]> {
    try {
      const response = await fetch(`/api/sessions/files?sessionId=${this.config.sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch session files')
      }
      
      const data = await response.json()
      return data.files
      
    } catch (error) {
      console.error('Get session files error:', error)
      throw error
    }
  }

  // Delete session file
  async deleteFile(fileId: string): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/files/${fileId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'File deletion failed')
      }
      
    } catch (error) {
      console.error('File deletion error:', error)
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
      console.error('File download error:', error)
      throw error
    }
  }

  // Cleanup resources
  cleanup(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
    }
    
    this.mediaRecorder = null
    this.recordedChunks = []
    this.isRecording = false
  }

  // Private methods
  private getRecordingOptions(): MediaRecorderOptions {
    const options: MediaRecorderOptions = {}
    
    // Set codec and bitrate based on quality
    switch (this.config.quality) {
      case 'low':
        options.mimeType = 'video/webm;codecs=vp8'
        options.videoBitsPerSecond = 500000 // 500 kbps
        options.audioBitsPerSecond = 64000  // 64 kbps
        break
      case 'medium':
        options.mimeType = 'video/webm;codecs=vp9'
        options.videoBitsPerSecond = 1500000 // 1.5 Mbps
        options.audioBitsPerSecond = 128000  // 128 kbps
        break
      case 'high':
        options.mimeType = 'video/webm;codecs=vp9'
        options.videoBitsPerSecond = 4000000 // 4 Mbps
        options.audioBitsPerSecond = 192000  // 192 kbps
        break
    }
    
    return options
  }

  private setupRecorderHandlers(): void {
    if (!this.mediaRecorder) return
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }
    
    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event)
      this.onRecordingError?.('Recording error occurred')
    }
  }

  private startProgressTracking(): void {
    const updateProgress = () => {
      if (this.isRecording) {
        const duration = Date.now() - this.recordingStartTime
        this.onRecordingProgress?.(duration)
        setTimeout(updateProgress, 1000)
      }
    }
    
    setTimeout(updateProgress, 1000)
  }

  private async processRecording(): Promise<RecordingData> {
    try {
      // Create blob from recorded chunks
      const mimeType = this.mediaRecorder?.mimeType || 'video/webm'
      const recordingBlob = new Blob(this.recordedChunks, { type: mimeType })
      
      // Calculate duration
      const duration = Date.now() - this.recordingStartTime
      
      // Generate file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `session-recording-${timestamp}.webm`
      
      // Create recording data
      const recordingData: RecordingData = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        sessionId: this.config.sessionId,
        fileName,
        fileSize: recordingBlob.size,
        duration,
        format: 'webm',
        quality: this.config.quality,
        createdAt: new Date(),
      }
      
      this.onRecordingStop?.(recordingData)
      return recordingData
      
    } catch (error) {
      console.error('Recording processing error:', error)
      throw error
    }
  }

  private validateFile(file: File): void {
    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      throw new Error('File size exceeds 100MB limit')
    }
    
    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-zip-compressed',
    ]
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not supported')
    }
  }
}

// Utility functions
export function createRecordingConfig(
  sessionId: string,
  userId: string,
  options: Partial<RecordingConfig> = {}
): RecordingConfig {
  return {
    sessionId,
    userId,
    quality: options.quality || 'medium',
    includeAudio: options.includeAudio !== false,
    includeVideo: options.includeVideo !== false,
    includeScreen: options.includeScreen || false,
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }
}

export function getFileIcon(fileType: string): string {
  if (fileType.startsWith('image/')) return '🖼️'
  if (fileType === 'application/pdf') return '📄'
  if (fileType.includes('word')) return '📝'
  if (fileType.includes('excel') || fileType.includes('sheet')) return '📊'
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️'
  if (fileType.includes('zip')) return '🗜️'
  if (fileType.startsWith('text/')) return '📄'
  return '📎'
}

type RecordingState = 'inactive' | 'recording' | 'paused'