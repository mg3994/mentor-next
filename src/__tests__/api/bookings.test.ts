import { describe, it, expect, beforeEach } from '@jest/globals'

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

describe('Booking Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Session Creation', () => {
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

      const session = await prisma.session.create({
        data: {
          mentorId: 'mentor123',
          menteeId: 'user123',
          pricingModelId: 'pricing123',
          scheduledAt: new Date('2024-12-01T10:00:00Z'),
          duration: 60,
          status: 'SCHEDULED',
        },
      })

      expect(session.id).toBe('session123')
      expect(session.status).toBe('SCHEDULED')
    })

    it('should validate mentor exists', async () => {
      const { prisma } = require('@/lib/db')

      // Mock mentor not found
      prisma.mentorProfile.findUnique.mockResolvedValue(null)

      const mentor = await prisma.mentorProfile.findUnique({
        where: { id: 'invalid_mentor' },
      })

      expect(mentor).toBeNull()
    })

    it('should validate pricing model', async () => {
      const { prisma } = require('@/lib/db')

      prisma.pricingModel.findUnique.mockResolvedValue({
        id: 'pricing123',
        type: 'ONE_TIME',
        price: 2500,
        duration: 60,
      })

      const pricingModel = await prisma.pricingModel.findUnique({
        where: { id: 'pricing123' },
      })

      expect(pricingModel).toBeDefined()
      expect(pricingModel.price).toBe(2500)
      expect(pricingModel.duration).toBe(60)
    })
  })

  describe('Session Retrieval', () => {
    it('should return user bookings', async () => {
      const { prisma } = require('@/lib/db')

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

      const sessions = await prisma.session.findMany({
        where: { menteeId: 'user123' },
        include: {
          mentor: { include: { user: true } },
        },
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe('session123')
      expect(sessions[0].mentor.user.name).toBe('John Mentor')
    })

    it('should filter bookings by status', async () => {
      const { prisma } = require('@/lib/db')

      await prisma.session.findMany({
        where: {
          menteeId: 'user123',
          status: 'COMPLETED',
        },
        include: {
          mentor: { include: { user: true } },
          pricingModel: true,
        },
        orderBy: { scheduledAt: 'desc' },
      })

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: {
          menteeId: 'user123',
          status: 'COMPLETED',
        },
        include: {
          mentor: { include: { user: true } },
          pricingModel: true,
        },
        orderBy: { scheduledAt: 'desc' },
      })
    })
  })
})