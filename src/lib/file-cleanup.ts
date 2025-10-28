// File Cleanup Service
// Handles automatic file cleanup and retention management

import { prisma } from '@/lib/db'
import { createAuditLog } from '@/lib/db-utils'
import { unlink, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export interface CleanupResult {
  filesProcessed: number
  filesDeleted: number
  errors: string[]
  bytesFreed: number
}

export interface RetentionPolicy {
  sessionFiles: number // days
  recordings: number // days
  tempFiles: number // days
}

export class FileCleanupService {
  private static readonly DEFAULT_RETENTION: RetentionPolicy = {
    sessionFiles: 30,
    recordings: 365, // Keep recordings longer
    tempFiles: 1
  }

  // Run cleanup for expired files
  static async cleanupExpiredFiles(retentionPolicy: RetentionPolicy = this.DEFAULT_RETENTION): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesProcessed: 0,
      filesDeleted: 0,
      errors: [],
      bytesFreed: 0
    }

    try {
      // Cleanup session files
      const sessionFilesResult = await this.cleanupExpiredSessionFiles(retentionPolicy.sessionFiles)
      result.filesProcessed += sessionFilesResult.filesProcessed
      result.filesDeleted += sessionFilesResult.filesDeleted
      result.errors.push(...sessionFilesResult.errors)
      result.bytesFreed += sessionFilesResult.bytesFreed

      // Cleanup recordings (if they have different retention)
      if (retentionPolicy.recordings !== retentionPolicy.sessionFiles) {
        const recordingsResult = await this.cleanupRecordings(retentionPolicy.recordings)
        result.filesProcessed += recordingsResult.filesProcessed
        result.filesDeleted += recordingsResult.filesDeleted
        result.errors.push(...recordingsResult.errors)
        result.bytesFreed += recordingsResult.bytesFreed
      }

      // Cleanup orphaned files (files in filesystem but not in database)
      const orphanedResult = await this.cleanupOrphanedFiles()
      result.filesProcessed += orphanedResult.filesProcessed
      result.filesDeleted += orphanedResult.filesDeleted
      result.errors.push(...orphanedResult.errors)
      result.bytesFreed += orphanedResult.bytesFreed

      // Log cleanup summary
      await createAuditLog({
        userId: 'system',
        action: 'FILE_CLEANUP_COMPLETED',
        resource: 'file_system',
        details: {
          filesProcessed: result.filesProcessed,
          filesDeleted: result.filesDeleted,
          bytesFreed: result.bytesFreed,
          errorCount: result.errors.length
        }
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown cleanup error'
      result.errors.push(errorMessage)
      console.error('File cleanup error:', error)
    }

    return result
  }

  // Cleanup expired session files
  private static async cleanupExpiredSessionFiles(retentionDays: number): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesProcessed: 0,
      filesDeleted: 0,
      errors: [],
      bytesFreed: 0
    }

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      // Find expired files
      const expiredFiles = await prisma.sessionFile.findMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { uploadedAt: { lt: cutoffDate } }
          ]
        },
        include: {
          session: {
            select: { id: true }
          }
        }
      })

      result.filesProcessed = expiredFiles.length

      for (const file of expiredFiles) {
        try {
          // Delete physical file
          const filePath = join(process.cwd(), 'uploads', 'sessions', file.sessionId, file.fileName)
          
          if (existsSync(filePath)) {
            const stats = await stat(filePath)
            await unlink(filePath)
            result.bytesFreed += stats.size
          }

          // Delete database record
          await prisma.sessionFile.delete({
            where: { id: file.id }
          })

          result.filesDeleted++

          // Log individual file deletion
          await createAuditLog({
            userId: 'system',
            action: 'SESSION_FILE_EXPIRED_DELETED',
            resource: 'session_file',
            details: {
              fileId: file.id,
              fileName: file.fileName,
              sessionId: file.sessionId,
              fileSize: file.fileSize,
              expiresAt: file.expiresAt
            }
          })

        } catch (error) {
          const errorMessage = `Failed to delete file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMessage)
          console.error('File deletion error:', error)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session files cleanup failed'
      result.errors.push(errorMessage)
      console.error('Session files cleanup error:', error)
    }

    return result
  }

  // Cleanup expired recordings
  private static async cleanupRecordings(retentionDays: number): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesProcessed: 0,
      filesDeleted: 0,
      errors: [],
      bytesFreed: 0
    }

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      // Find expired recordings (assuming they're stored as session files with specific type)
      const expiredRecordings = await prisma.sessionFile.findMany({
        where: {
          AND: [
            { uploadedAt: { lt: cutoffDate } },
            { mimeType: { startsWith: 'video/' } } // Recordings are video files
          ]
        },
        include: {
          session: {
            select: { id: true }
          }
        }
      })

      result.filesProcessed = expiredRecordings.length

      for (const recording of expiredRecordings) {
        try {
          // Delete physical file
          const filePath = join(process.cwd(), 'uploads', 'recordings', recording.sessionId, recording.fileName)
          
          if (existsSync(filePath)) {
            const stats = await stat(filePath)
            await unlink(filePath)
            result.bytesFreed += stats.size
          }

          // Delete database record
          await prisma.sessionFile.delete({
            where: { id: recording.id }
          })

          result.filesDeleted++

          // Log recording deletion
          await createAuditLog({
            userId: 'system',
            action: 'SESSION_RECORDING_EXPIRED_DELETED',
            resource: 'session_recording',
            details: {
              recordingId: recording.id,
              fileName: recording.fileName,
              sessionId: recording.sessionId,
              fileSize: recording.fileSize
            }
          })

        } catch (error) {
          const errorMessage = `Failed to delete recording ${recording.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMessage)
          console.error('Recording deletion error:', error)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recordings cleanup failed'
      result.errors.push(errorMessage)
      console.error('Recordings cleanup error:', error)
    }

    return result
  }

  // Cleanup orphaned files (files in filesystem but not in database)
  private static async cleanupOrphanedFiles(): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesProcessed: 0,
      filesDeleted: 0,
      errors: [],
      bytesFreed: 0
    }

    // This is a simplified implementation
    // In a production environment, you'd want to scan the filesystem
    // and compare with database records
    
    return result
  }

  // Force cleanup of specific session files
  static async cleanupSessionFiles(sessionId: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesProcessed: 0,
      filesDeleted: 0,
      errors: [],
      bytesFreed: 0
    }

    try {
      // Find all files for the session
      const sessionFiles = await prisma.sessionFile.findMany({
        where: { sessionId }
      })

      result.filesProcessed = sessionFiles.length

      for (const file of sessionFiles) {
        try {
          // Delete physical file
          const filePath = join(process.cwd(), 'uploads', 'sessions', sessionId, file.fileName)
          
          if (existsSync(filePath)) {
            const stats = await stat(filePath)
            await unlink(filePath)
            result.bytesFreed += stats.size
          }

          // Delete database record
          await prisma.sessionFile.delete({
            where: { id: file.id }
          })

          result.filesDeleted++

        } catch (error) {
          const errorMessage = `Failed to delete file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMessage)
        }
      }

      // Log session cleanup
      await createAuditLog({
        userId: 'system',
        action: 'SESSION_FILES_CLEANUP',
        resource: 'session',
        details: {
          sessionId,
          filesDeleted: result.filesDeleted,
          bytesFreed: result.bytesFreed
        }
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session cleanup failed'
      result.errors.push(errorMessage)
      console.error('Session cleanup error:', error)
    }

    return result
  }

  // Get cleanup statistics
  static async getCleanupStats(): Promise<{
    totalFiles: number
    expiredFiles: number
    totalSize: number
    expiredSize: number
  }> {
    try {
      const now = new Date()
      
      // Count total files
      const totalFiles = await prisma.sessionFile.count()
      
      // Count expired files
      const expiredFiles = await prisma.sessionFile.count({
        where: {
          expiresAt: { lt: now }
        }
      })

      // Calculate total size
      const totalSizeResult = await prisma.sessionFile.aggregate({
        _sum: { fileSize: true }
      })

      // Calculate expired size
      const expiredSizeResult = await prisma.sessionFile.aggregate({
        where: {
          expiresAt: { lt: now }
        },
        _sum: { fileSize: true }
      })

      return {
        totalFiles,
        expiredFiles,
        totalSize: totalSizeResult._sum.fileSize || 0,
        expiredSize: expiredSizeResult._sum.fileSize || 0
      }

    } catch (error) {
      console.error('Error getting cleanup stats:', error)
      return {
        totalFiles: 0,
        expiredFiles: 0,
        totalSize: 0,
        expiredSize: 0
      }
    }
  }

  // Schedule automatic cleanup (to be called by cron job)
  static async scheduleCleanup(): Promise<void> {
    try {
      console.log('Starting scheduled file cleanup...')
      const result = await this.cleanupExpiredFiles()
      
      console.log(`Cleanup completed: ${result.filesDeleted}/${result.filesProcessed} files deleted, ${result.bytesFreed} bytes freed`)
      
      if (result.errors.length > 0) {
        console.error('Cleanup errors:', result.errors)
      }

    } catch (error) {
      console.error('Scheduled cleanup failed:', error)
    }
  }
}

// Utility functions

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function calculateRetentionDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export function isFileExpired(expiresAt: Date): boolean {
  return expiresAt < new Date()
}