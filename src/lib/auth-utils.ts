import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Role, RoleStatus } from '@prisma/client'

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

// JWT utilities
export function generateToken(userData: any): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret'
  return jwt.sign(userData, secret, { expiresIn: '24h' })
}

export function verifyToken(token: string): any {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret'
  return jwt.verify(token, secret)
}

// Role checking utilities
export function hasRole(userRoles: { role: Role; status: RoleStatus }[], role: Role): boolean {
  return userRoles.some(userRole => userRole.role === role && userRole.status === RoleStatus.ACTIVE)
}

export function hasActiveRole(userRoles: { role: Role; status: RoleStatus }[], roles: Role[]): boolean {
  return userRoles.some(userRole => 
    roles.includes(userRole.role) && userRole.status === RoleStatus.ACTIVE
  )
}

export function isAdmin(userRoles: { role: Role; status: RoleStatus }[]): boolean {
  return hasRole(userRoles, Role.ADMIN)
}

export function isMentor(userRoles: { role: Role; status: RoleStatus }[]): boolean {
  return hasRole(userRoles, Role.MENTOR)
}

export function isMentee(userRoles: { role: Role; status: RoleStatus }[]): boolean {
  return hasRole(userRoles, Role.MENTEE)
}

// Session utilities
export function canAccessSession(userId: string, session: { mentorId: string; menteeId: string }): boolean {
  return session.mentorId === userId || session.menteeId === userId
}

// Permission checking
export function canEditProfile(userId: string, profileUserId: string, userRoles: { role: Role; status: RoleStatus }[]): boolean {
  return userId === profileUserId || isAdmin(userRoles)
}

export function canManageUser(userRoles: { role: Role; status: RoleStatus }[]): boolean {
  return isAdmin(userRoles)
}

export function canAccessAdminPanel(userRoles: { role: Role; status: RoleStatus }[]): boolean {
  return isAdmin(userRoles)
}

// Generate secure tokens
export function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// Email verification utilities
export function generateEmailVerificationToken(): string {
  return generateVerificationToken()
}

export function isEmailVerificationTokenValid(_token: string, createdAt: Date): boolean {
  const tokenAge = Date.now() - createdAt.getTime()
  const maxAge = 24 * 60 * 60 * 1000 // 24 hours
  return tokenAge < maxAge
}