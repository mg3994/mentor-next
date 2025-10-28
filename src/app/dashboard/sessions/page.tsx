'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import BookingManagement from '@/components/booking/booking-management'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function SessionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/dashboard/sessions')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to view your sessions.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Determine user role for the booking management component
  const isMentor = hasRole(session.user.roles, Role.MENTOR)
  const isMentee = hasRole(session.user.roles, Role.MENTEE)
  
  // Default to mentee if user has both roles
  const userRole = isMentor && !isMentee ? 'mentor' : 'mentee'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BookingManagement userRole={userRole} />
      </div>
    </div>
  )
}