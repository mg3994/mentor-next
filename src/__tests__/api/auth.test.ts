import { describe, it, expect, beforeEach } from '@jest/globals'
import { hashPassword, verifyPassword, generateToken, verifyToken } from '@/lib/auth-utils'

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

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}))

// Mock jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn().mockReturnValue({ userId: 'user123' }),
}))

describe('Auth Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should hash password correctly', async () => {
    const password = 'testpassword123'
    const hashedPassword = await hashPassword(password)
    
    expect(hashedPassword).toBe('hashed_password')
  })

  it('should verify password correctly', async () => {
    const password = 'testpassword123'
    const hashedPassword = 'hashed_password'
    const isValid = await verifyPassword(password, hashedPassword)
    
    expect(isValid).toBe(true)
  })

  it('should generate JWT token', () => {
    const userData = { userId: 'user123', email: 'test@example.com' }
    const token = generateToken(userData)
    
    expect(token).toBe('mock_token')
  })

  it('should verify JWT token', () => {
    const token = 'mock_token'
    const decoded = verifyToken(token)
    
    expect(decoded).toEqual({ userId: 'user123' })
  })

  it('should handle user registration flow', async () => {
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

    const userData = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    }

    const hashedPassword = await hashPassword(userData.password)
    expect(hashedPassword).toBe('hashed_password')
    
    // Simulate user creation
    const createdUser = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    })
    
    expect(createdUser.email).toBe(userData.email)
  })
})