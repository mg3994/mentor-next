import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAvailablePaymentMethods, calculateProcessingFee } from '@/lib/razorpay-config'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters for amount (to calculate processing fees)
    const { searchParams } = new URL(request.url)
    const amount = searchParams.get('amount')

    const paymentMethods = getAvailablePaymentMethods().map(method => ({
      ...method,
      processingFee: amount ? calculateProcessingFee(parseFloat(amount), method.id) : 0,
    }))

    return NextResponse.json({
      success: true,
      paymentMethods,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    })

  } catch (error) {
    console.error('Get payment methods error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}