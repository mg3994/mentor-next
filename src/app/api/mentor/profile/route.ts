import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { mentorProfileSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/db-utils'
import { hasRole } from '@/lib/auth-utils'
import { Role, RoleStatus } from '@prisma/client'

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
    const validatedFields = mentorProfileSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const data = validatedFields.data

    // Check if mentor profile already exists
    const existingProfile = await prisma.mentorProfile.findUnique({
      where: { userId: session.user.id },
    })

    let mentorProfile

    if (existingProfile) {
      // Update existing profile
      mentorProfile = await prisma.mentorProfile.update({
        where: { userId: session.user.id },
        data: {
          bio: data.bio,
          expertise: data.expertise,
          experience: data.experience,
          education: data.education,
          certifications: data.certifications,
          timezone: data.timezone,
          isVerified: false, // Reset verification status on update
        },
      })
    } else {
      // Create new profile
      mentorProfile = await prisma.mentorProfile.create({
        data: {
          userId: session.user.id,
          bio: data.bio,
          expertise: data.expertise,
          experience: data.experience,
          education: data.education,
          certifications: data.certifications,
          timezone: data.timezone,
          isVerified: false,
        },
      })
    }

    // Update mentor role status to pending verification
    await prisma.userRole.updateMany({
      where: {
        userId: session.user.id,
        role: Role.MENTOR,
      },
      data: {
        status: RoleStatus.PENDING,
      },
    })

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: existingProfile ? 'MENTOR_PROFILE_UPDATED' : 'MENTOR_PROFILE_CREATED',
      resource: 'MENTOR_PROFILE',
      details: {
        profileId: mentorProfile.id,
        expertise: data.expertise,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Mentor profile created successfully',
      profile: {
        id: mentorProfile.id,
        bio: mentorProfile.bio,
        expertise: mentorProfile.expertise,
        isVerified: mentorProfile.isVerified,
      },
    })

  } catch (error) {
    console.error('Mentor profile creation error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        pricingModels: {
          where: { isActive: true },
        },
        availability: {
          where: { isActive: true },
        },
      },
    })

    if (!mentorProfile) {
      return NextResponse.json(
        { error: 'Mentor profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: mentorProfile,
    })

  } catch (error) {
    console.error('Get mentor profile error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
