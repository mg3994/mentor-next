import { prisma } from './db'
import { redis } from './redis'
import { Role, RoleStatus } from '@prisma/client'
import { CACHE_KEYS, CACHE_TTL } from './constants'

export interface SearchFilters {
  query?: string
  expertise?: string[]
  minPrice?: number
  maxPrice?: number
  timezone?: string
  availability?: string // ISO date string
  minRating?: number
  isVerified?: boolean
}

export interface SearchOptions {
  page?: number
  limit?: number
  sortBy?: 'rating' | 'sessions' | 'price' | 'recent'
  sortOrder?: 'asc' | 'desc'
}

export async function searchMentors(filters: SearchFilters, options: SearchOptions = {}) {
  const {
    query,
    expertise,
    minPrice,
    maxPrice,
    timezone,
    availability,
    minRating,
    isVerified = true,
  } = filters

  const {
    page = 1,
    limit = 10,
    sortBy = 'rating',
    sortOrder = 'desc',
  } = options

  const skip = (page - 1) * limit

  // Build where clause
  const where: any = {
    isVerified,
    user: {
      roles: {
        some: {
          role: Role.MENTOR,
          status: RoleStatus.ACTIVE,
        },
      },
    },
  }

  // Text search
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

  // Rating filter
  if (minRating) {
    where.averageRating = { gte: minRating }
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

  // Availability filter (check if mentor has availability on specific date)
  if (availability) {
    const date = new Date(availability)
    const dayOfWeek = date.getDay()
    
    where.availability = {
      some: {
        dayOfWeek,
        isActive: true,
      },
    }
  }

  // Build order by clause
  const orderBy: any[] = []
  
  switch (sortBy) {
    case 'rating':
      orderBy.push({ averageRating: sortOrder })
      break
    case 'sessions':
      orderBy.push({ totalSessions: sortOrder })
      break
    case 'recent':
      orderBy.push({ createdAt: sortOrder })
      break
    case 'price':
      // This is more complex as we need to sort by minimum price
      // For now, we'll use a secondary sort
      orderBy.push({ averageRating: 'desc' })
      break
    default:
      orderBy.push({ averageRating: 'desc' })
  }

  // Add secondary sorts for consistency
  orderBy.push({ totalSessions: 'desc' })
  orderBy.push({ createdAt: 'desc' })

  // Execute search
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
        availability: {
          where: { isActive: true },
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy,
    }),
    prisma.mentorProfile.count({ where }),
  ])

  return {
    mentors,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

export async function getMentorRecommendations(userId: string, limit = 5) {
  const cacheKey = `recommendations:${userId}`
  
  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.warn('Cache read error for recommendations:', error)
  }

  // Get user's interests and previous sessions
  const [menteeProfile, previousSessions] = await Promise.all([
    prisma.menteeProfile.findUnique({
      where: { userId },
      select: { interests: true },
    }),
    prisma.session.findMany({
      where: { menteeId: userId },
      select: { mentorId: true },
      distinct: ['mentorId'],
    }),
  ])

  if (!menteeProfile) {
    return { recommendations: [], basedOn: [] }
  }

  const excludeMentorIds = previousSessions.map(s => s.mentorId)

  // Find mentors with matching expertise, excluding previously booked mentors
  const recommendations = await prisma.mentorProfile.findMany({
    where: {
      isVerified: true,
      userId: {
        notIn: [userId, ...excludeMentorIds], // Exclude self and previous mentors
      },
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

  const result = {
    recommendations,
    basedOn: menteeProfile.interests,
  }

  // Cache for 1 hour
  try {
    await redis.setex(cacheKey, 3600, JSON.stringify(result))
  } catch (error) {
    console.warn('Cache write error for recommendations:', error)
  }

  return result
}

export async function getPopularMentors(limit = 10) {
  const cacheKey = 'popular_mentors'
  
  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.warn('Cache read error for popular mentors:', error)
  }

  const popularMentors = await prisma.mentorProfile.findMany({
    where: {
      isVerified: true,
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
      { totalSessions: 'desc' },
      { averageRating: 'desc' },
    ],
    take: limit,
  })

  // Cache for 30 minutes
  try {
    await redis.setex(cacheKey, 1800, JSON.stringify(popularMentors))
  } catch (error) {
    console.warn('Cache write error for popular mentors:', error)
  }

  return popularMentors
}

export async function getTrendingExpertise(limit = 10) {
  const cacheKey = 'trending_expertise'
  
  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.warn('Cache read error for trending expertise:', error)
  }

  // Get all mentor expertise areas and count them
  const mentors = await prisma.mentorProfile.findMany({
    where: {
      isVerified: true,
      user: {
        roles: {
          some: {
            role: Role.MENTOR,
            status: RoleStatus.ACTIVE,
          },
        },
      },
    },
    select: {
      expertise: true,
    },
  })

  // Count expertise occurrences
  const expertiseCount: Record<string, number> = {}
  mentors.forEach(mentor => {
    mentor.expertise.forEach(skill => {
      expertiseCount[skill] = (expertiseCount[skill] || 0) + 1
    })
  })

  // Sort by count and take top results
  const trending = Object.entries(expertiseCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([skill, count]) => ({ skill, mentorCount: count }))

  // Cache for 1 hour
  try {
    await redis.setex(cacheKey, 3600, JSON.stringify(trending))
  } catch (error) {
    console.warn('Cache write error for trending expertise:', error)
  }

  return trending
}

export async function invalidateSearchCache(pattern?: string) {
  try {
    const keys = await redis.keys(pattern || 'search:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    console.warn('Cache invalidation error:', error)
  }
}