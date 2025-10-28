import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAvailablePaymentMethods } from '@/lib/payment-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const paymentMethods = getAvailablePaymentMethods()

    return NextResponse.json({
      success: true,
      paymentMethods,
    })

  } catch (error) {
    console.error('Get payment methods error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}