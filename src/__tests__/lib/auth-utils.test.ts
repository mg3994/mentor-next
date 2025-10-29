import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { hashPassword, verifyPassword, generateToken, verifyToken } from '@/lib/auth-utils'

describe('Auth Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testpassword123'
      const hashedPassword = await hashPassword(password)
      
      expect(hashedPassword).toBeDefined()
      expect(hashedPassword).not.toBe(password)
      expect(hashedPassword.length).toBeGreaterThan(0)
    })

    it('should generate different hashes for the same password', async () => {
      const password = 'testpassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const password = 'testpassword123'
      const hashedPassword = await hashPassword(password)
      
      const isValid = await verifyPassword(password, hashedPassword)
      expect(isValid).toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const password = 'testpassword123'
      const wrongPassword = 'wrongpassword'
      const hashedPassword = await hashPassword(password)
      
      const isValid = await verifyPassword(wrongPassword, hashedPassword)
      expect(isValid).toBe(false)
    })
  })

  describe('generateToken', () => {
    it('should generate a token with user data', () => {
      const userData = {
        id: 'user123',
        email: 'test@example.com',
        roles: [{ role: 'MENTEE' }]
      }
      
      const token = generateToken(userData)
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const userData = {
        id: 'user123',
        email: 'test@example.com',
        roles: [{ role: 'MENTEE' }]
      }
      
      const token = generateToken(userData)
      const decoded = verifyToken(token)
      
      expect(decoded).toBeDefined()
      expect(decoded.id).toBe(userData.id)
      expect(decoded.email).toBe(userData.email)
    })

    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here'
      
      expect(() => verifyToken(invalidToken)).toThrow()
    })
  })
})