#!/usr/bin/env tsx

// Automated file cleanup cron job
// This script should be run periodically (e.g., daily) to clean up expired files

import { FileCleanupService } from '../src/lib/file-cleanup'
import { createAuditLog } from '../src/lib/db-utils'

async function runCleanup() {
  console.log('Starting automated file cleanup...')
  
  try {
    // Run cleanup with default retention policy
    const result = await FileCleanupService.cleanupExpiredFiles()
    
    console.log('Cleanup completed successfully:')
    console.log(`- Files processed: ${result.filesProcessed}`)
    console.log(`- Files deleted: ${result.filesDeleted}`)
    console.log(`- Bytes freed: ${result.bytesFreed}`)
    
    if (result.errors.length > 0) {
      console.error('Cleanup errors:')
      result.errors.forEach(error => console.error(`  - ${error}`))
    }

    // Log the automated cleanup
    await createAuditLog({
      userId: 'system',
      action: 'AUTOMATED_CLEANUP_COMPLETED',
      resource: 'file_system',
      details: {
        filesProcessed: result.filesProcessed,
        filesDeleted: result.filesDeleted,
        bytesFreed: result.bytesFreed,
        errorCount: result.errors.length,
        scheduledCleanup: true
      }
    })

    process.exit(0)

  } catch (error) {
    console.error('Automated cleanup failed:', error)
    
    // Log the failure
    try {
      await createAuditLog({
        userId: 'system',
        action: 'AUTOMATED_CLEANUP_FAILED',
        resource: 'file_system',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          scheduledCleanup: true
        }
      })
    } catch (logError) {
      console.error('Failed to log cleanup failure:', logError)
    }

    process.exit(1)
  }
}

// Run the cleanup
runCleanup()