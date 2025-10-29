import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/auth-utils'
import { AuditService } from '@/lib/audit-service'
import { Role } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { mentorId: string } }
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

    const { mentorId } = params

    // Check if mentor profile exists
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { id: mentorId },
      include: {
        user: {
          include: {
            roles: true,
          },
        },
      },
    })

    if (!mentorProfile) {
      return NextResponse.json(
        { error: 'Mentor profile not found' },
        { status: 404 }
      )
    }

    // Update mentor profile to verified
    await prisma.mentorProfile.update({
      where: { id: mentorId },
      data: { isVerified: true },
    })

    // Update mentor role status to active
    await prisma.userRole.updateMany({
      where: {
        userId: mentorProfile.userId,
        role: Role.MENTOR,
        status: 'PENDING',
      },
      data: {
        status: 'ACTIVE',
      },
    })

    // Log the action
    await AuditService.logAdminAction({
      adminUserId: session.user.id,
      action: 'ADMIN_USER_MANAGEMENT',
      targetUserId: mentorProfile.userId,
      details: {
        mentorProfileId: mentorId,
        approvedBy: session.user.id,
        approvedAt: new Date(),
        type: 'mentor_verification',
        action: 'approved',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Mentor approved successfully',
    })

  } catch (error) {
    console.error('Approve mentor error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to approve mentor',
        success: false,
      },
      { status: 500 }
    )
  }
}