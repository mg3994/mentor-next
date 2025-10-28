import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { RoleStatus, Role } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Find mentor profile by user ID
    const mentorProfile = await prisma.mentorProfile.findFirst({
      where: {
        userId: id,
        isVerified: true, // Only show verified mentors publicly
        user: {
          roles: {
            some: {
              role: Role.MENTOR,
              status: RoleStatus.ACTIVE,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        pricingModels: {
          where: { isActive: true },
          select: {
            id: true,
            type: true,
            price: true,
            duration: true,
            description: true,
          },
        },
        availability: {
          where: { isActive: true },
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    })

    if (!mentorProfile) {
      return NextResponse.json(
        { error: 'Mentor profile not found or not verified' },
        { status: 404 }
      )
    }

    // Get recent reviews for this mentor
    const reviews = await prisma.review.findMany({
      where: {
        revieweeId: id,
      },
      include: {
        reviewer: {
          select: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5, // Get latest 5 reviews
    })

    return NextResponse.json({
      success: true,
      profile: {
        ...mentorProfile,
        reviews,
      },
    })

  } catch (error) {
    console.error('Get public mentor profile error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}