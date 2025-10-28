'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { mentorProfileSchema, type MentorProfile } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle } from 'lucide-react'
import MentorProfileForm from '@/components/onboarding/mentor-profile-form'

export default function MentorOnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if not authenticated or not a mentor
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin?callbackUrl=/onboarding/mentor')
      return
    }

    const isMentor = session.user.roles.some(role => role.role === 'MENTOR')
    if (!isMentor) {
      router.push('/')
      return
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Mentor Platform!</h1>
          <p className="mt-2 text-lg text-gray-600">
            Let's set up your mentor profile to help students find you
          </p>
        </div>

        <MentorProfileForm />
      </div>
    </div>
  )
}