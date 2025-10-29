import { describe, it, expect, beforeEach } from '@jest/globals'
import { 
  buildSearchQuery, 
  parseSearchFilters, 
  calculateRelevanceScore,
  formatSearchResults 
} from '@/lib/search-utils'

describe('Search Utils', () => {
  describe('buildSearchQuery', () => {
    it('should build basic search query', () => {
      const filters = {
        query: 'javascript',
        field: 'programming',
        minPrice: 1000,
        maxPrice: 5000,
      }

      const query = buildSearchQuery(filters)

      expect(query.where).toEqual({
        AND: [
          {
            OR: [
              { user: { name: { contains: 'javascript', mode: 'insensitive' } } },
              { bio: { contains: 'javascript', mode: 'insensitive' } },
              { expertise: { hasSome: ['javascript'] } },
            ],
          },
          { expertise: { hasSome: ['programming'] } },
          {
            pricingModels: {
              some: {
                price: { gte: 1000, lte: 5000 },
              },
            },
          },
        ],
      })
    })

    it('should handle empty filters', () => {
      const filters = {}
      const query = buildSearchQuery(filters)

      expect(query.where).toEqual({ AND: [] })
    })

    it('should include availability filter', () => {
      const filters = {
        availability: true,
      }

      const query = buildSearchQuery(filters)

      expect(query.where.AND).toContainEqual({
        availability: {
          some: {
            dayOfWeek: { gte: 0, lte: 6 },
          },
        },
      })
    })
  })

  describe('parseSearchFilters', () => {
    it('should parse URL search params', () => {
      const searchParams = new URLSearchParams({
        q: 'react developer',
        field: 'web-development',
        minPrice: '2000',
        maxPrice: '8000',
        rating: '4',
        availability: 'true',
      })

      const filters = parseSearchFilters(searchParams)

      expect(filters).toEqual({
        query: 'react developer',
        field: 'web-development',
        minPrice: 2000,
        maxPrice: 8000,
        minRating: 4,
        availability: true,
      })
    })

    it('should handle invalid numeric values', () => {
      const searchParams = new URLSearchParams({
        minPrice: 'invalid',
        maxPrice: 'also-invalid',
        rating: 'not-a-number',
      })

      const filters = parseSearchFilters(searchParams)

      expect(filters.minPrice).toBeUndefined()
      expect(filters.maxPrice).toBeUndefined()
      expect(filters.minRating).toBeUndefined()
    })
  })

  describe('calculateRelevanceScore', () => {
    const mockMentor = {
      user: { name: 'John Doe' },
      bio: 'Experienced React developer with 5 years of experience',
      expertise: ['react', 'javascript', 'typescript'],
      averageRating: 4.8,
      totalSessions: 150,
      pricingModels: [{ price: 3000 }],
    }

    it('should calculate relevance score for exact match', () => {
      const score = calculateRelevanceScore(mockMentor, 'react')

      expect(score).toBeGreaterThan(0)
      expect(score).toBeGreaterThan(calculateRelevanceScore(mockMentor, 'python'))
    })

    it('should boost score for highly rated mentors', () => {
      const highRatedMentor = { ...mockMentor, averageRating: 5.0 }
      const lowRatedMentor = { ...mockMentor, averageRating: 3.0 }

      const highScore = calculateRelevanceScore(highRatedMentor, 'react')
      const lowScore = calculateRelevanceScore(lowRatedMentor, 'react')

      expect(highScore).toBeGreaterThan(lowScore)
    })

    it('should boost score for experienced mentors', () => {
      const experiencedMentor = { ...mockMentor, totalSessions: 500 }
      const newMentor = { ...mockMentor, totalSessions: 10 }

      const experiencedScore = calculateRelevanceScore(experiencedMentor, 'react')
      const newScore = calculateRelevanceScore(newMentor, 'react')

      expect(experiencedScore).toBeGreaterThan(newScore)
    })
  })

  describe('formatSearchResults', () => {
    const mockMentors = [
      {
        id: 'mentor1',
        user: { 
          id: 'user1',
          name: 'John Doe',
          image: 'avatar1.jpg' 
        },
        bio: 'React expert',
        expertise: ['react', 'javascript'],
        averageRating: 4.8,
        totalSessions: 100,
        pricingModels: [
          { type: 'ONE_TIME', price: 2500 },
          { type: 'HOURLY', price: 3000 },
        ],
        availability: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        ],
      },
    ]

    it('should format search results correctly', () => {
      const formatted = formatSearchResults(mockMentors)

      expect(formatted).toHaveLength(1)
      expect(formatted[0]).toEqual({
        id: 'mentor1',
        name: 'John Doe',
        avatar: 'avatar1.jpg',
        bio: 'React expert',
        expertise: ['react', 'javascript'],
        rating: 4.8,
        totalSessions: 100,
        priceRange: {
          min: 2500,
          max: 3000,
        },
        availability: {
          hasAvailability: true,
          nextAvailable: expect.any(String),
        },
      })
    })

    it('should handle mentors without pricing models', () => {
      const mentorsWithoutPricing = [
        {
          ...mockMentors[0],
          pricingModels: [],
        },
      ]

      const formatted = formatSearchResults(mentorsWithoutPricing)

      expect(formatted[0].priceRange).toEqual({
        min: 0,
        max: 0,
      })
    })

    it('should handle mentors without availability', () => {
      const mentorsWithoutAvailability = [
        {
          ...mockMentors[0],
          availability: [],
        },
      ]

      const formatted = formatSearchResults(mentorsWithoutAvailability)

      expect(formatted[0].availability).toEqual({
        hasAvailability: false,
        nextAvailable: null,
      })
    })
  })
})