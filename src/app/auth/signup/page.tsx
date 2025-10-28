'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userRegistrationSchema, type UserRegistration } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

interface SignUpData extends UserRegistration {
  confirmPassword: string
  isMentor: boolean
  isMentee: boolean
  agreeToTerms: boolean
}

const signUpSchema = userRegistrationSchema.extend({
  confirmPassword: userRegistrationSchema.shape.password,
  isMentor: userRegistrationSchema.shape.password.optional(),
  isMentee: userRegistrationSchema.shape.password.optional(),
  agreeToTerms: userRegistrationSchema.shape.password.optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.isMentor || data.isMentee, {
  message: "Please select at least one role",
  path: ["isMentee"],
}).refine((data) => data.agreeToTerms, {
  message: "You must agree to the terms and conditions",
  path: ["agreeToTerms"],
})

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      isMentee: true,
      isMentor: false,
      agreeToTerms: false,
    },
  })

  const watchIsMentor = watch('isMentor')
  const watchIsMentee = watch('isMentee')
  const watchAgreeToTerms = watch('agreeToTerms')

  const onSubmit = async (data: SignUpData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          roles: [
            ...(data.isMentee ? ['MENTEE'] : []),
            ...(data.isMentor ? ['MENTOR'] : []),
          ],
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/auth/signin?message=Registration successful. Please sign in.')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Registration Successful!</h3>
              <p className="mt-1 text-sm text-gray-500">
                Redirecting you to sign in...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Create account</CardTitle>
          <CardDescription className="text-center">
            Join our mentorship platform and start learning or teaching
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                {...register('name')}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label>I want to join as:</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isMentee"
                    checked={watchIsMentee}
                    onCheckedChange={(checked) => setValue('isMentee', !!checked)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="isMentee" className="text-sm font-normal">
                    Mentee - I want to learn from experts
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isMentor"
                    checked={watchIsMentor}
                    onCheckedChange={(checked) => setValue('isMentor', !!checked)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="isMentor" className="text-sm font-normal">
                    Mentor - I want to share my expertise
                  </Label>
                </div>
              </div>
              {errors.isMentee && (
                <p className="text-sm text-red-600">{errors.isMentee.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="agreeToTerms"
                checked={watchAgreeToTerms}
                onCheckedChange={(checked) => setValue('agreeToTerms', !!checked)}
                disabled={isLoading}
              />
              <Label htmlFor="agreeToTerms" className="text-sm font-normal">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-500">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {errors.agreeToTerms && (
              <p className="text-sm text-red-600">{errors.agreeToTerms.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}