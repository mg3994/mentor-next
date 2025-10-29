import { describe, it, expect, beforeEach } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/bookings/route'

// Mock database
jest.mock('@/lib/db', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    mentorProfile: {
      findUnique: jest.fn(),
    },
    pricingModel: {
      findUnique: jest.fn(),
    },
  },
}))

// Mock auth
jest.mock('@/lib/auth-utils', () => ({
  getServerSession: jest.fn(),
}))

describe('/api/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/bookings', () => {
    it('should create a new booking successfully', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { prisma } = require('@/lib/db')

      // Mock authenticated user
      getServerSession.mockResolvedValue({
        user: { id: 'user123', roles: [{ role: 'MENTEE' }] },
      })

      // Mock mentor and pricing model
      prisma.mentorProfile.findUnique.mockResolvedValue({
        id: 'mentor123',
        userId: 'mentor_user123',
      })

      prisma.pricingModel.findUnique.mockResolvedValue({
        id: 'pricing123',
        type: 'ONE_TIME',
        price: 2500,
        duration: 60,
      })

      // Mock session creation
      const mockSession = {
        id: 'session123',
        mentorId: 'mentor123',
        menteeId: 'user123',
        scheduledAt: new Date('2024-12-01T10:00:00Z'),
        duration: 60,
        status: 'SCHEDULED',
      }
      prisma.session.create.mockResolvedValue(mockSession)

      const { req } = createMocks({
        method: 'POST',
        body: {
          mentorId: 'mentor123',
          pricingModelId: 'pricing123',
          scheduledAt: '2024-12-01T10:00:00Z',
          duration: 60,
        },
      })

      const response = await handler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.session.id).toBe('session123')
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          mentorId: 'mentor123',
          menteeId: 'user123',
          pricingModelId: 'pricing123',
          scheduledAt: new Date('2024-12-01T10:00:00Z'),
          duration: 60,
          status: 'SCHEDULED',
        },
        include: expect.any(Object),
      })
    })

    it('should return error for invalid mentor', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { prisma } = require('@/lib/db')

      getServerSession.mockResolvedValue({
        user: { id: 'user123', roles: [{ role: 'MENTEE' }] },
      })

      // Mock mentor not found
      prisma.mentorProfile.findUnique.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: {
          mentorId: 'invalid_mentor',
          pricingModelId: 'pricing123',
          scheduledAt: '2024-12-01T10:00:00Z',
          duration: 60,
        },
      })

      const response = await handler.POST(req)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Mentor not found')
    })

    it('should return error for unauthenticated user', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      
      getServerSession.mockResolvedValue(null)

      const { req } = createMocks({
        method: 'POST',
        body: {
          mentorId: 'mentor123',
          pricingModelId: 'pricing123',
          scheduledAt: '2024-12-01T10:00:00Z',
          duration: 60,
        },
      })

      const response = await handler.POST(req)

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/bookings', () => {
    it('should return user bookings', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { prisma } = require('@/lib/db')

      getServerSession.mockResolvedValue({
        user: { id: 'user123', roles: [{ role: 'MENTEE' }] },
      })

      const mockSessions = [
        {
          id: 'session123',
          scheduledAt: new Date('2024-12-01T10:00:00Z'),
          duration: 60,
          status: 'SCHEDULED',
          mentor: {
            user: { name: 'John Mentor' },
          },
        },
      ]
      prisma.session.findMany.mockResolvedValue(mockSessions)

      const { req } = createMocks({
        method: 'GET',
      })

      const response = await handler.GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sessions).toHaveLength(1)
      expect(data.sessions[0].id).toBe('session123')
    })

    it('should filter bookings by status', async () => {
      const { getServerSession } = require('@/lib/auth-utils')
      const { prisma } = require('@/lib/db')

      getServerSession.mockResolvedValue({
        user: { id: 'user123', roles: [{ role: 'MENTEE' }] },
      })

      const { req } = createMocks({
        method: 'GET',
        query: { status: 'COMPLETED' },
      })

      await handler.GET(req)

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: {
          menteeId: 'user123',
          status: 'COMPLETED',
        },
        include: expect.any(Object),
        orderBy: { scheduledAt: 'desc' },
      })
    })
  })
})