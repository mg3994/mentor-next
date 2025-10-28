import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMentorEarnings } from '@/lib/payment-utils'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function GET(request: NextRequest) {
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

    const earnings = await getMentorEarnings(session.user.id)

    return NextResponse.json({
      success: true,
      earnings,
    })

  } catch (error) {
    console.error('Get mentor earnings error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}