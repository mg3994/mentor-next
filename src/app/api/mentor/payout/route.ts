import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processMentorPayout } from '@/lib/payment-utils'
import { earningsService } from '@/lib/earnings-service'
import { hasRole } from '@/lib/auth-utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { TransactionStatus } from '@/types'
import { Role } from '@/types'

const payoutSchema = z.object({
  amount: z.number().min(0.01),
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

    // Check if user has mentor role
    const isMentor = hasRole(session.user.roles, Role.MENTOR)
    if (!isMentor) {
      return NextResponse.json(
        { error: 'Mentor role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = payoutSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid payout data', details: validatedFields.error.errors },
        { status: 400 }
      )
    }

    const { amount } = validatedFields.data

    // Get all completed transactions that haven't been paid out
    const unpaidTransactions = await prisma.transaction.findMany({
      where: {
        session: {
          mentorId: session.user.id,
        },
        status: TransactionStatus.COMPLETED,
        // Check if transaction is not already included in a payout
        NOT: {
          id: {
            in: await prisma.mentorPayout.findMany({
              select: {
                transactionIds: true,
              },
            }).then(payouts => payouts.flatMap(p => p.transactionIds)),
          },
        },
      },
      select: {
        id: true,
        mentorEarnings: true,
      },
    })

    // Calculate total available earnings
    const totalAvailable = unpaidTransactions.reduce((sum, t) => sum + t.mentorEarnings, 0)

    if (totalAvailable < amount) {
      return NextResponse.json(
        { error: 'Insufficient earnings for payout' },
        { status: 400 }
      )
    }

    // Select transactions for payout (up to the requested amount)
    let remainingAmount = amount
    const selectedTransactions = []
    
    for (const transaction of unpaidTransactions) {
      if (remainingAmount <= 0) break
      
      selectedTransactions.push(transaction.id)
      remainingAmount -= transaction.mentorEarnings
      
      if (remainingAmount <= 0) break
    }

    // Process payout
    const result = await processMentorPayout({
      mentorId: session.user.id,
      amount,
      transactionIds: selectedTransactions,
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Payout request error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Payout processing failed',
        success: false,
      },
      { status: 500 }
    )
  }
}