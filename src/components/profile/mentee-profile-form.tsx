'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { menteeProfileSchema, type MenteeProfile } from '@/lib/validations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, X, Plus, CheckCircle } from 'lucide-react'
import { COMMON_TIMEZONES } from '@/lib/constants'

interface MenteeProfileFormProps {
  initialData?: any
  onSuccess?: () => void
}

export default function MenteeProfileForm({ initialData, onSuccess }: MenteeProfileFormProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialData?.interests || [])
  const [newInterest, setNewInterest] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MenteeProfile>({
    resolver: zodResolver(menteeProfileSchema),
    defaultValues: {
      learningGoals: initialData?.learningGoals || '',
      interests: initialData?.interests || [],
      timezone: initialData?.timezone || 'UTC',
    },
  })

  const watchTimezone = watch('timezone')

  const addInterest = (interest: string) => {
    if (interest && !selectedInterests.includes(interest) && selectedInterests.length < 10) {
      const updated = [...selectedInterests, interest]
      setSelectedInterests(updated)
      setValue('interests', updated)
    }
    setNewInterest('')
  }

  const removeInterest = (interest: string) => {
    const updated = selectedInterests.filter(i => i !== interest)
    setSelectedInterests(updated)
    setValue('interests', updated)
  }

  const onSubmit = async (data: MenteeProfile) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mentee/profile', {
        method: initialData ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          interests: selectedInterests,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save mentee profile')
      }

      setSuccess(true)
      if (onSuccess) {
        setTimeout(onSuccess, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Profile Saved!</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your mentee profile has been updated successfully.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Update' : 'Create'} Your Mentee Profile</CardTitle>
        <CardDescription>
          Tell mentors about your learning goals and interests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Learning Goals Section */}
          <div className="space-y-2">
            <Label htmlFor="learningGoals">Learning Goals</Label>
            <Textarea
              id="learningGoals"
              placeholder="What do you want to learn or achieve? Be specific about your goals..."
              className="min-h-[100px]"
              {...register('learningGoals')}
              disabled={isLoading}
            />
            {errors.learningGoals && (
              <p className="text-sm text-red-600">{errors.learningGoals.message}</p>
            )}
          </div>

          {/* Interests Section */}
          <div className="space-y-3">
            <Label>Areas of Interest *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedInterests.map((interest) => (
                <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                  {interest}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeInterest(interest)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add an area of interest (e.g., React, Data Science, Career Development)"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest(newInterest))}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addInterest(newInterest)}
                disabled={!newInterest || isLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errors.interests && (
              <p className="text-sm text-red-600">{errors.interests.message}</p>
            )}
          </div>

          {/* Timezone Section */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone *</Label>
            <Select 
              onValueChange={(value) => setValue('timezone', value)} 
              defaultValue={initialData?.timezone || 'UTC'}
            >
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
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update Profile' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}