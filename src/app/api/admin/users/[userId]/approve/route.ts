import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/auth-utils'
import { AuditService } from '@/lib/audit-service'
import { Role } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
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

    const { userId } = params

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

    // Update pending roles to active
    await prisma.userRole.updateMany({
      where: {
        userId,
        status: 'PENDING',
      },
      data: {
        status: 'ACTIVE',
      },
    })

    // If user has mentor role, update mentor profile verification
    const mentorRole = user.roles.find(role => role.role === Role.MENTOR)
    if (mentorRole) {
      await prisma.mentorProfile.updateMany({
        where: { userId },
        data: { isVerified: true },
      })
    }

    // Log the action
    await AuditService.logAdminAction({
      adminUserId: session.user.id,
      action: 'ADMIN_USER_MANAGEMENT',
      targetUserId: userId,
      details: {
        approvedBy: session.user.id,
        approvedAt: new Date(),
        roles: user.roles.map(r => r.role),
        action: 'approved',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User approved successfully',
    })

  } catch (error) {
    console.error('Approve user error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to approve user',
        success: false,
      },
      { status: 500 }
    )
  }
}