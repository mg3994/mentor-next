import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/auth-utils'
import { AuditService } from '@/lib/audit-service'
import { Role } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const isAdmin = hasRole(session.user.roles, Role.ADMIN)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { userId } = await params
    const body = await request.json()
    const { reason } = body

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent self-suspension
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot suspend yourself' },
        { status: 400 }
      )
    }

    // Update active roles to suspended
    await prisma.userRole.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'SUSPENDED',
      },
    })

    // Cancel all upcoming sessions for this user
    await prisma.session.updateMany({
      where: {
        OR: [
          { mentorId: userId },
          { menteeId: userId },
        ],
        status: 'SCHEDULED',
        startTime: {
          gte: new Date(),
        },
      },
      data: {
        status: 'CANCELLED',
      },
    })

    // Log the action
    await AuditService.logAdminAction({
      adminUserId: session.user.id,
      action: 'ADMIN_USER_MANAGEMENT',
      targetUserId: userId,
      details: {
        suspendedBy: session.user.id,
        suspendedAt: new Date(),
        reason: reason || 'No reason provided',
        roles: user.roles.map(r => r.role),
        action: 'suspended',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User suspended successfully',
    })

  } catch (error) {
    console.error('Suspend user error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to suspend user',
        success: false,
      },
      { status: 500 }
    )
  }
}