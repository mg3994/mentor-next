// File Security Service
// Handles file scanning, validation, and security checks

import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

export interface SecurityScanResult {
  isSecure: boolean
  threats: string[]
  fileHash: string
  scanTimestamp: Date
}

export interface FileValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class FileSecurityService {
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.app', '.deb', '.pkg', '.dmg', '.run', '.msi', '.ps1', '.sh'
  ]

  private static readonly SUSPICIOUS_PATTERNS = [
    /eval\s*\(/gi,
    /document\.write/gi,
    /innerHTML\s*=/gi,
    /script\s*>/gi,
    /<iframe/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi
  ]

  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv', 'text/markdown',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/ogg'
  ]

  // Validate file before upload
  static validateFile(file: File): FileValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`)
    }

    if (file.size === 0) {
      errors.push('File is empty')
    }

    // Check file type
    if (!this.ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`)
    }

    // Check file extension
    const extension = this.getFileExtension(file.name).toLowerCase()
    if (this.DANGEROUS_EXTENSIONS.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed for security reasons`)
    }

    // Check filename for suspicious patterns
    if (this.hasSuspiciousFilename(file.name)) {
      warnings.push('Filename contains potentially suspicious characters')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Scan file content for security threats
  static async scanFileContent(filePath: string): Promise<SecurityScanResult> {
    const threats: string[] = []
    let fileContent: Buffer

    try {
      fileContent = await readFile(filePath)
    } catch (error) {
      return {
        isSecure: false,
        threats: ['Unable to read file for security scanning'],
        fileHash: '',
        scanTimestamp: new Date()
      }
    }

    // Generate file hash
    const fileHash = createHash('sha256').update(fileContent).digest('hex')

    // Check file size again (in case of tampering)
    if (fileContent.length > this.MAX_FILE_SIZE) {
      threats.push('File size exceeds security limits')
    }

    // Scan for suspicious content patterns
    const contentString = fileContent.toString('utf8', 0, Math.min(fileContent.length, 10000)) // First 10KB
    
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(contentString)) {
        threats.push(`Suspicious content pattern detected: ${pattern.source}`)
      }
    }

    // Check for embedded executables (basic check)
    if (this.containsExecutableSignatures(fileContent)) {
      threats.push('File contains executable signatures')
    }

    // Check for suspicious file headers
    const suspiciousHeaders = this.checkFileHeaders(fileContent)
    if (suspiciousHeaders.length > 0) {
      threats.push(...suspiciousHeaders)
    }

    return {
      isSecure: threats.length === 0,
      threats,
      fileHash,
      scanTimestamp: new Date()
    }
  }

  // Check if file contains executable signatures
  private static containsExecutableSignatures(content: Buffer): boolean {
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // MZ (DOS/Windows executable)
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF (Linux executable)
      Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O (macOS executable)
      Buffer.from([0xCE, 0xFA, 0xED, 0xFE]), // Mach-O (macOS executable, reverse)
    ]

    for (const signature of executableSignatures) {
      if (content.indexOf(signature) !== -1) {
        return true
      }
    }

    return false
  }

  // Check file headers for suspicious content
  private static checkFileHeaders(content: Buffer): string[] {
    const threats: string[] = []
    
    if (content.length < 4) return threats

    const header = content.subarray(0, 4)
    
    // Check for script injections in image files
    if (this.isImageFile(content) && this.containsScriptTags(content)) {
      threats.push('Image file contains embedded script content')
    }

    // Check for polyglot files (files that are valid in multiple formats)
    if (this.isPolyglotFile(content)) {
      threats.push('File appears to be a polyglot (multiple format) file')
    }

    return threats
  }

  // Check if file is an image based on header
  private static isImageFile(content: Buffer): boolean {
    if (content.length < 4) return false

    const header = content.subarray(0, 4)
    
    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8) return true
    
    // PNG
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true
    
    // GIF
    if (content.length >= 6) {
      const gif87a = Buffer.from('GIF87a')
      const gif89a = Buffer.from('GIF89a')
      if (content.subarray(0, 6).equals(gif87a) || content.subarray(0, 6).equals(gif89a)) return true
    }

    return false
  }

  // Check if content contains script tags
  private static containsScriptTags(content: Buffer): boolean {
    const contentString = content.toString('utf8')
    return /<script/i.test(contentString) || /javascript:/i.test(contentString)
  }

  // Check if file is a polyglot
  private static isPolyglotFile(content: Buffer): boolean {
    // Simple check for files that start with multiple format signatures
    const contentString = content.toString('utf8', 0, Math.min(content.length, 1000))
    
    // Count different file format indicators
    let formatCount = 0
    
    if (contentString.includes('<?xml')) formatCount++
    if (contentString.includes('<!DOCTYPE html')) formatCount++
    if (contentString.includes('%PDF')) formatCount++
    if (contentString.includes('PK')) formatCount++ // ZIP-based formats
    
    return formatCount > 1
  }

  // Get file extension from filename
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot === -1 ? '' : filename.substring(lastDot)
  }

  // Check for suspicious filename patterns
  private static hasSuspiciousFilename(filename: string): boolean {
    // Check for double extensions
    const parts = filename.split('.')
    if (parts.length > 3) return true

    // Check for suspicious characters
    const suspiciousChars = /[<>:"|?*\x00-\x1f]/
    if (suspiciousChars.test(filename)) return true

    // Check for very long filenames
    if (filename.length > 255) return true

    // Check for hidden file attempts
    if (filename.startsWith('.') && filename.length > 1) return true

    return false
  }

  // Generate secure filename
  static generateSecureFilename(originalFilename: string, userId: string): string {
    const extension = this.getFileExtension(originalFilename)
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const userHash = createHash('md5').update(userId).digest('hex').substring(0, 8)
    
    return `${timestamp}-${userHash}-${randomSuffix}${extension}`
  }

  // Check if file access is allowed for user
  static async checkFileAccess(
    fileId: string, 
    userId: string, 
    sessionId: string,
    prisma: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get file and session information
      const file = await prisma.sessionFile.findUnique({
        where: { id: fileId },
        include: {
          session: {
            include: {
              mentor: { select: { id: true } },
              mentee: { select: { id: true } }
            }
          }
        }
      })

      if (!file) {
        return { allowed: false, reason: 'File not found' }
      }

      // Check if file has expired
      if (file.expiresAt < new Date()) {
        return { allowed: false, reason: 'File has expired' }
      }

      // Check if user has access to the session
      const hasSessionAccess = 
        file.session.mentor.id === userId || 
        file.session.mentee.id === userId

      if (!hasSessionAccess) {
        return { allowed: false, reason: 'No access to session' }
      }

      // Check if file belongs to the correct session
      if (file.sessionId !== sessionId) {
        return { allowed: false, reason: 'File does not belong to this session' }
      }

      return { allowed: true }

    } catch (error) {
      console.error('File access check error:', error)
      return { allowed: false, reason: 'Access check failed' }
    }
  }
}

// Utility functions for file security

export function sanitizeFilename(filename: string): string {
  // Remove or replace dangerous characters
  return filename
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255) // Limit length
}

export function isFileTypeAllowed(mimeType: string): boolean {
  return FileSecurityService['ALLOWED_MIME_TYPES'].includes(mimeType)
}

export function getFileSizeLimit(): number {
  return FileSecurityService['MAX_FILE_SIZE']
}

export function isDangerousExtension(extension: string): boolean {
  return FileSecurityService['DANGEROUS_EXTENSIONS'].includes(extension.toLowerCase())
}