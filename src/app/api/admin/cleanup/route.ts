import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileCleanupService, formatBytes } from '@/lib/file-cleanup'
import { createAuditLog } from '@/lib/db-utils'

// Manual cleanup endpoint (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin (you'll need to implement admin role checking)
    // For now, we'll allow any authenticated user for demo purposes
    // In production, add proper admin role verification

    const body = await request.json()
    const { 
      sessionFiles = 30, 
      recordings = 365, 
      tempFiles = 1,
      dryRun = false 
    } = body

    if (dryRun) {
      // Get cleanup statistics without actually deleting files
      const stats = await FileCleanupService.getCleanupStats()
      
      return NextResponse.json({
        success: true,
        dryRun: true,
        stats: {
          totalFiles: stats.totalFiles,
          expiredFiles: stats.expiredFiles,
          totalSize: formatBytes(stats.totalSize),
          expiredSize: formatBytes(stats.expiredSize),
          potentialSavings: formatBytes(stats.expiredSize)
        }
      })
    }

    // Perform actual cleanup
    const result = await FileCleanupService.cleanupExpiredFiles({
      sessionFiles,
      recordings,
      tempFiles
    })

    // Log cleanup operation
    await createAuditLog({
      userId: session.user.id,
      action: 'MANUAL_CLEANUP_EXECUTED',
      resource: 'file_system',
      details: {
        filesProcessed: result.filesProcessed,
        filesDeleted: result.filesDeleted,
        bytesFreed: result.bytesFreed,
        errorCount: result.errors.length,
        retentionPolicy: { sessionFiles, recordings, tempFiles }
      }
    })

    return NextResponse.json({
      success: true,
      result: {
        filesProcessed: result.filesProcessed,
        filesDeleted: result.filesDeleted,
        bytesFreed: formatBytes(result.bytesFreed),
        errors: result.errors
      }
    })

  } catch (error) {
    console.error('Cleanup operation error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Cleanup operation failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Get cleanup statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const stats = await FileCleanupService.getCleanupStats()

    return NextResponse.json({
      success: true,
      stats: {
        totalFiles: stats.totalFiles,
        expiredFiles: stats.expiredFiles,
        totalSize: formatBytes(stats.totalSize),
        expiredSize: formatBytes(stats.expiredSize),
        cleanupRecommended: stats.expiredFiles > 0
      }
    })

  } catch (error) {
    console.error('Get cleanup stats error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get cleanup stats',
        success: false,
      },
      { status: 500 }
    )
  }
}