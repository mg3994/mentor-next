'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import EarningsDashboard from '@/components/earnings/earnings-dashboard'
import { hasRole } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'

export default function EarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/dashboard/earnings')
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
            Please sign in to view your earnings.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Check if user has mentor role
  const isMentor = hasRole(session.user.roles, Role.MENTOR)
  if (!isMentor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to be a mentor to view earnings. Please complete your mentor profile setup.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EarningsDashboard />
      </div>
    </div>
  )
}