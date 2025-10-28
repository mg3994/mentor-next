import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { earningsService } from '@/lib/earnings-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const payoutRequestSchema = z.object({
  amount: z.number().min(10, 'Minimum payout amount is $10').max(10000, 'Maximum payout amount is $10,000'),
  payoutMethod: z.enum(['bank_transfer', 'paypal', 'stripe', 'manual']),
  bankDetails: z.object({
    accountNumber: z.string().min(1, 'Account number is required'),
    routingNumber: z.string().min(1, 'Routing number is required'),
    accountHolderName: z.string().min(1, 'Account holder name is required'),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is a mentor
    const userRoles = await prisma.userRole.findMany({
      where: { 
        userId: session.user.id,
        role: 'MENTOR',
        status: 'ACTIVE',
      },
    })

    if (userRoles.length === 0) {
      return NextResponse.json(
        { error: 'Mentor access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = payoutRequestSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid payout request', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { amount, payoutMethod, bankDetails } = validatedFields.data

    // Process withdrawal request
    const result = await earningsService.processWithdrawalRequest({
      mentorId: session.user.id,
      amount,
      payoutMethod,
      bankDetails,
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Payout request error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Payout request failed',
        success: false,
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve payout history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is a mentor
    const userRoles = await prisma.userRole.findMany({
      where: { 
        userId: session.user.id,
        role: 'MENTOR',
        status: 'ACTIVE',
      },
    })

    if (userRoles.length === 0) {
      return NextResponse.json(
        { error: 'Mentor access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') // 'PENDING', 'COMPLETED', 'FAILED'

    const skip = (page - 1) * limit

    const where: any = {
      mentorId: session.user.id,
    }

    if (status) {
      where.status = status
    }

    const [payouts, total] = await Promise.all([
      prisma.mentorPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mentorPayout.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      payouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    console.error('Get payout history error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get payout history',
        success: false,
      },
      { status: 500 }
    )
  }
}