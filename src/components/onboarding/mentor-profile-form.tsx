'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { mentorProfileSchema, type MentorProfile } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, X, Plus, CheckCircle } from 'lucide-react'
import { EXPERTISE_CATEGORIES, COMMON_TIMEZONES } from '@/lib/constants'

export default function MentorProfileForm() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([])
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([])
  const [newExpertise, setNewExpertise] = useState('')
  const [newCertification, setNewCertification] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MentorProfile>({
    resolver: zodResolver(mentorProfileSchema),
    defaultValues: {
      expertise: [],
      certifications: [],
      timezone: 'UTC',
    },
  })

  const watchTimezone = watch('timezone')

  const addExpertise = (expertise: string) => {
    if (expertise && !selectedExpertise.includes(expertise) && selectedExpertise.length < 10) {
      const updated = [...selectedExpertise, expertise]
      setSelectedExpertise(updated)
      setValue('expertise', updated)
    }
    setNewExpertise('')
  }

  const removeExpertise = (expertise: string) => {
    const updated = selectedExpertise.filter(e => e !== expertise)
    setSelectedExpertise(updated)
    setValue('expertise', updated)
  }

  const addCertification = (certification: string) => {
    if (certification && !selectedCertifications.includes(certification) && selectedCertifications.length < 10) {
      const updated = [...selectedCertifications, certification]
      setSelectedCertifications(updated)
      setValue('certifications', updated)
    }
    setNewCertification('')
  }

  const removeCertification = (certification: string) => {
    const updated = selectedCertifications.filter(c => c !== certification)
    setSelectedCertifications(updated)
    setValue('certifications', updated)
  }

  const onSubmit = async (data: MentorProfile) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mentor/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          expertise: selectedExpertise,
          certifications: selectedCertifications,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create mentor profile')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Profile Created!</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your mentor profile has been submitted for review. Redirecting to dashboard...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Your Mentor Profile</CardTitle>
        <CardDescription>
          Tell us about your expertise and experience to help students find you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Bio Section */}
          <div className="space-y-2">
            <Label htmlFor="bio">Professional Bio *</Label>
            <Textarea
              id="bio"
              placeholder="Tell students about your background, experience, and what you can help them with..."
              className="min-h-[120px]"
              {...register('bio')}
              disabled={isLoading}
            />
            {errors.bio && (
              <p className="text-sm text-red-600">{errors.bio.message}</p>
            )}
          </div>

          {/* Expertise Section */}
          <div className="space-y-3">
            <Label>Areas of Expertise *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedExpertise.map((expertise) => (
                <Badge key={expertise} variant="secondary" className="flex items-center gap-1">
                  {expertise}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeExpertise(expertise)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select onValueChange={(value) => addExpertise(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select expertise area" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERTISE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Or add custom expertise"
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise(newExpertise))}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addExpertise(newExpertise)}
                disabled={!newExpertise || isLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.expertise && (
              <p className="text-sm text-red-600">{errors.expertise.message}</p>
            )}
          </div>

          {/* Experience Section */}
          <div className="space-y-2">
            <Label htmlFor="experience">Professional Experience *</Label>
            <Textarea
              id="experience"
              placeholder="Describe your relevant work experience, achievements, and background..."
              {...register('experience')}
              disabled={isLoading}
            />
            {errors.experience && (
              <p className="text-sm text-red-600">{errors.experience.message}</p>
            )}
          </div>

          {/* Education Section */}
          <div className="space-y-2">
            <Label htmlFor="education">Education</Label>
            <Input
              id="education"
              placeholder="Your educational background (e.g., Computer Science, MIT)"
              {...register('education')}
              disabled={isLoading}
            />
            {errors.education && (
              <p className="text-sm text-red-600">{errors.education.message}</p>
            )}
          </div>

          {/* Certifications Section */}
          <div className="space-y-3">
            <Label>Certifications</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedCertifications.map((cert) => (
                <Badge key={cert} variant="secondary" className="flex items-center gap-1">
                  {cert}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeCertification(cert)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add certification (e.g., AWS Solutions Architect)"
                value={newCertification}
                onChange={(e) => setNewCertification(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification(newCertification))}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addCertification(newCertification)}
                disabled={!newCertification || isLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Timezone Section */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone *</Label>
            <Select onValueChange={(value) => setValue('timezone', value)} defaultValue="UTC">
              <SelectTrigger>
                <SelectValue placeholder="Select your timezone" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timezone && (
              <p className="text-sm text-red-600">{errors.timezone.message}</p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              disabled={isLoading}
              className="flex-1"
            >
              Skip for Now
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}