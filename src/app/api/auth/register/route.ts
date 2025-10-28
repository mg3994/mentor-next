import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth-utils'
import { createAuditLog } from '@/lib/db-utils'
import { Role, RoleStatus } from '@prisma/client'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
  roles: z.array(z.enum(['MENTEE', 'MENTOR'])).min(1, 'At least one role is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedFields = registerSchema.safeParse(body)
    if (!validatedFields.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validatedFields.error.errors },
        { status: 400 }
      )
    }

    const { name, email, password, roles } = validatedFields.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password (for demo purposes, we'll store a placeholder)
    // In production, you'd add a password field to the User model
    const hashedPassword = await hashPassword(password)

    // Create user with roles
    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerified: new Date(), // Auto-verify for demo
        roles: {
          create: roles.map(role => ({
            role: role as Role,
            status: role === 'MENTOR' ? RoleStatus.PENDING : RoleStatus.ACTIVE,
          })),
        },
      },
      include: {
        roles: true,
      },
    })

    // Create default profiles based on roles
    if (roles.includes('MENTEE')) {
      await prisma.menteeProfile.create({
        data: {
          userId: user.id,
          interests: [],
          timezone: 'UTC',
        },
      })
    }

    if (roles.includes('MENTOR')) {
      // Mentor profile will be created during onboarding
      // For now, just create a placeholder
      await prisma.mentorProfile.create({
        data: {
          userId: user.id,
          bio: '',
          expertise: [],
          experience: '',
          timezone: 'UTC',
          isVerified: false,
        },
      })
    }

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'USER_REGISTERED',
      resource: 'USER',
      details: {
        roles,
        method: 'credentials',
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    // Return success (don't include sensitive data)
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles.map(r => ({ role: r.role, status: r.status })),
      },
    })

  } catch (error) {
    console.error('Registration error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}