import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { mentorSearchSchema } from '@/lib/validations'
import { Role, RoleStatus } from '@prisma/client'
import { CACHE_KEYS, CACHE_TTL } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate search parameters
    const searchData = {
      query: searchParams.get('q') || undefined,
      expertise: searchParams.get('expertise')?.split(',').filter(Boolean) || undefined,
      minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined,
      timezone: searchParams.get('timezone') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '10'), 50), // Max 50 results per page
    }

    const validatedFields = mentorSearchSchema.safeParse(searchData)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: validatedFields.error.issues },
        { status: 400 }
      )
    }

    const { query, expertise, minPrice, maxPrice, timezone, page, limit } = validatedFields.data

    // Create cache key
    const cacheKey = CACHE_KEYS.SEARCH_RESULTS(
      JSON.stringify({ query, expertise, minPrice, maxPrice, timezone, page, limit })
    )

    // Try to get cached results
    try {
      const cachedResults = await redis.get(cacheKey)
      if (cachedResults) {
        return NextResponse.json(JSON.parse(cachedResults))
      }
    } catch (cacheError) {
      console.warn('Cache read error:', cacheError)
    }

    const skip = (page - 1) * limit

    // Build where clause for search
    const where: any = {
      isVerified: true,
      user: {
        roles: {
          some: {
            role: Role.MENTOR,
            status: RoleStatus.ACTIVE,
          },
        },
      },
    }

    // Text search across multiple fields
    if (query) {
      where.OR = [
        { bio: { contains: query, mode: 'insensitive' } },
        { expertise: { hasSome: [query] } },
        { experience: { contains: query, mode: 'insensitive' } },
        { user: { name: { contains: query, mode: 'insensitive' } } },
      ]
    }

    // Expertise filter
    if (expertise && expertise.length > 0) {
      where.expertise = { hasSome: expertise }
    }

    // Timezone filter
    if (timezone) {
      where.timezone = timezone
    }

    // Price filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.pricingModels = {
        some: {
          isActive: true,
          ...(minPrice !== undefined && { price: { gte: minPrice } }),
          ...(maxPrice !== undefined && { price: { lte: maxPrice } }),
        },
      }
    }

    // Execute search query
    const [mentors, total] = await Promise.all([
      prisma.mentorProfile.findMany({
        where,
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
        },
        skip,
        take: limit,
        orderBy: [
          { averageRating: 'desc' },
          { totalSessions: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.mentorProfile.count({ where }),
    ])

    const results = {
      success: true,
      mentors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    // Cache the results
    try {
      await redis.setex(cacheKey, CACHE_TTL.SEARCH_RESULTS, JSON.stringify(results))
    } catch (cacheError) {
      console.warn('Cache write error:', cacheError)
    }

    return NextResponse.json(results)

  } catch (error) {
    console.error('Search mentors error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to get mentor recommendations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, limit = 5 } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required for recommendations' },
        { status: 400 }
      )
    }

    // Get user's interests from mentee profile
    const menteeProfile = await prisma.menteeProfile.findUnique({
      where: { userId },
      select: { interests: true },
    })

    if (!menteeProfile) {
      return NextResponse.json(
        { error: 'Mentee profile not found' },
        { status: 404 }
      )
    }

    // Find mentors with matching expertise
    const recommendedMentors = await prisma.mentorProfile.findMany({
      where: {
        isVerified: true,
        expertise: {
          hasSome: menteeProfile.interests,
        },
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
          },
        },
      },
      orderBy: [
        { averageRating: 'desc' },
        { totalSessions: 'desc' },
      ],
      take: limit,
    })

    return NextResponse.json({
      success: true,
      recommendations: recommendedMentors,
      basedOn: menteeProfile.interests,
    })

  } catch (error) {
    console.error('Get recommendations error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
