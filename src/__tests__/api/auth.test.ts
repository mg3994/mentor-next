import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/auth/register/route'

// Mock database
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
  },
}))

// Mock auth utils
jest.mock('@/lib/auth-utils', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
}))

describe('/api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should register a new user successfully', async () => {
    const { prisma } = require('@/lib/db')
    
    // Mock user doesn't exist
    prisma.user.findUnique.mockResolvedValue(null)
    
    // Mock user creation
    const mockUser = {
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
    }
    prisma.user.create.mockResolvedValue(mockUser)
    prisma.userRole.create.mockResolvedValue({
      id: 'role123',
      userId: 'user123',
      role: 'MENTEE',
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'MENTEE',
      },
    })

    await handler.POST(req)

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'test@example.com',
        password: 'hashed_password',
        name: 'Test User',
      },
    })
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: {
        userId: 'user123',
        role: 'MENTEE',
        status: 'ACTIVE',
      },
    })
  })

  it('should return error for existing user', async () => {
    const { prisma } = require('@/lib/db')
    
    // Mock user already exists
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing_user',
      email: 'test@example.com',
    })

    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'MENTEE',
      },
    })

    const response = await handler.POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('User already exists')
  })

  it('should validate required fields', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'test@example.com',
        // Missing password, name, and role
      },
    })

    const response = await handler.POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('validation')
  })

  it('should validate email format', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
        role: 'MENTEE',
      },
    })

    const response = await handler.POST(req)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('email')
  })
})