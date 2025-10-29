import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paymentModelsService } from '@/lib/payment-models-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get session usage tracking
    const result = await paymentModelsService.getSessionUsageTracking(sessionId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      usageTracking: result.usageTracking,
    })

  } catch (error) {
    console.error('Get session usage tracking error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get usage tracking',
        success: false,
      },
      { status: 500 }
    )
  }
}