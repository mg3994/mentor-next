import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paymentModelsService } from '@/lib/payment-models-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's subscriptions
    const result = await paymentModelsService.getUserSubscriptions(session.user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      subscriptions: result.subscriptions,
    })

  } catch (error) {
    console.error('Get user subscriptions error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get subscriptions',
        success: false,
      },
      { status: 500 }
    )
  }
}