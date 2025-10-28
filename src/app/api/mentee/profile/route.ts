import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { menteeProfileSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/db-utils'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has mentee role
    const isMentee = hasRole(session.user.roles, Role.MENTEE)
    if (!isMentee) {
      return NextResponse.json(
        { error: 'Mentee role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = menteeProfileSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validatedFields.error.errors },
        { status: 400 }
      )
    }

    const data = validatedFields.data

    // Check if mentee profile already exists
    const existingProfile = await prisma.menteeProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Mentee profile already exists. Use PUT to update.' },
        { status: 409 }
      )
    }

    // Create new profile
    const menteeProfile = await prisma.menteeProfile.create({
      data: {
        userId: session.user.id,
        learningGoals: data.learningGoals,
        interests: data.interests,
        timezone: data.timezone,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'MENTEE_PROFILE_CREATED',
      resource: 'MENTEE_PROFILE',
      details: {
        profileId: menteeProfile.id,
        interests: data.interests,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Mentee profile created successfully',
      profile: menteeProfile,
    })

  } catch (error) {
    console.error('Mentee profile creation error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has mentee role
    const isMentee = hasRole(session.user.roles, Role.MENTEE)
    if (!isMentee) {
      return NextResponse.json(
        { error: 'Mentee role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validatedFields = menteeProfileSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validatedFields.error.errors },
        { status: 400 }
      )
    }

    const data = validatedFields.data

    // Update existing profile
    const menteeProfile = await prisma.menteeProfile.update({
      where: { userId: session.user.id },
      data: {
        learningGoals: data.learningGoals,
        interests: data.interests,
        timezone: data.timezone,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      action: 'MENTEE_PROFILE_UPDATED',
      resource: 'MENTEE_PROFILE',
      details: {
        profileId: menteeProfile.id,
        interests: data.interests,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Mentee profile updated successfully',
      profile: menteeProfile,
    })

  } catch (error) {
    console.error('Mentee profile update error:', error)
    
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

    const menteeProfile = await prisma.menteeProfile.findUnique({
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
      },
    })

    if (!menteeProfile) {
      return NextResponse.json(
        { error: 'Mentee profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: menteeProfile,
    })

  } catch (error) {
    console.error('Get mentee profile error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}