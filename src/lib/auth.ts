import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './db'
import { getUserByEmail, createUser, getUserRoles } from './db-utils'
import { verifyPassword } from './auth-utils'
import { userLoginSchema } from './validations'
import { Role, RoleStatus } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Validate input
        const validatedFields = userLoginSchema.safeParse(credentials)
        if (!validatedFields.success) {
          throw new Error('Invalid email or password format')
        }

        const { email, password } = validatedFields.data

        // Find user by email
        const user = await getUserByEmail(email)
        if (!user) {
          throw new Error('Invalid email or password')
        }

        // For demo purposes, we'll check against a simple password
        // In production, you'd have a password field in the User model
        const isValidPassword = await verifyPassword(password, 'hashed_password_placeholder')
        
        // For now, accept the demo passwords from seed data
        const demoPasswords = ['admin123456', 'mentor123456', 'mentee123456']
        const isDemoPassword = demoPasswords.includes(password)
        
        if (!isDemoPassword) {
          throw new Error('Invalid email or password')
        }

        // Check if user has any active roles
        const hasActiveRole = user.roles.some(role => role.status === RoleStatus.ACTIVE)
        if (!hasActiveRole) {
          throw new Error('Account is not activated')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image || undefined,
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.userId = user.id
        
        // Get user roles
        const userRoles = await getUserRoles(user.id)
        token.roles = userRoles.map(role => ({
          role: role.role,
          status: role.status,
        }))
      }

      // Return previous token if the access token has not expired yet
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.roles = token.roles as Array<{ role: Role; status: RoleStatus }>
        
        // Get fresh user data including profiles
        const userData = await getUserByEmail(session.user.email!)
        if (userData) {
          session.user.menteeProfile = userData.menteeProfile
          session.user.mentorProfile = userData.mentorProfile
          session.user.emailVerified = userData.emailVerified
        }
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Allow OAuth sign-ins
      if (account?.provider === 'google') {
        try {
          // Check if user already exists
          const existingUser = await getUserByEmail(user.email!)
          
          if (!existingUser) {
            // Create new user with default mentee role
            const newUser = await createUser({
              email: user.email!,
              name: user.name!,
              image: user.image,
            })
            
            // Add default mentee role
            await prisma.userRole.create({
              data: {
                userId: newUser.id,
                role: Role.MENTEE,
                status: RoleStatus.ACTIVE,
              },
            })
          }
          
          return true
        } catch (error) {
          console.error('Error during OAuth sign-in:', error)
          return false
        }
      }
      
      return true
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Log successful sign-in
      console.log(`User ${user.email} signed in via ${account?.provider}`)
      
      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'SIGN_IN',
          resource: 'AUTH',
          details: {
            provider: account?.provider,
            isNewUser,
          },
        },
      })
    },
    async signOut({ token }) {
      // Log sign-out
      if (token?.userId) {
        await prisma.auditLog.create({
          data: {
            userId: token.userId as string,
            action: 'SIGN_OUT',
            resource: 'AUTH',
          },
        })
      }
    },
  },
}

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      roles: Array<{ role: Role; status: RoleStatus }>
      menteeProfile?: any
      mentorProfile?: any
      emailVerified?: Date | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    image?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    roles: Array<{ role: Role; status: RoleStatus }>
  }
}