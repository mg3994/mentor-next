'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Star, 
  Users, 
  MapPin, 
  Clock, 
  Award, 
  BookOpen, 
  CheckCircle,
  MessageCircle,
  Calendar,
  DollarSign
} from 'lucide-react'
import { formatCurrency } from '@/utils'
import Link from 'next/link'

interface MentorProfile {
  id: string
  bio: string
  expertise: string[]
  experience: string
  education?: string
  certifications: string[]
  timezone: string
  isVerified: boolean
  averageRating?: number
  totalSessions: number
  user: {
    id: string
    name: string
    image?: string
  }
  pricingModels: Array<{
    id: string
    type: string
    price: number
    duration?: number
    description?: string
  }>
  availability: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
  }>
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function PublicMentorProfilePage() {
  const params = useParams()
  const { data: session } = useSession()
  const [profile, setProfile] = useState<MentorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/mentors/${params.id}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch mentor profile')
        }

        setProfile(result.profile)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchProfile()
    }
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                {error || 'Mentor profile not found'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canBookSession = session && session.user.id !== profile.user.id

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-6">
                {profile.user.image && (
                  <img
                    src={profile.user.image}
                    alt={profile.user.name}
                    className="h-24 w-24 rounded-full object-cover"
                  />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-3xl font-bold text-gray-900">{profile.user.name}</h1>
                    {profile.isVerified && (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    {profile.averageRating && (
                      <div className="flex items-center space-x-1">
                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                        <span className="font-medium">{profile.averageRating.toFixed(1)}</span>
                        <span className="text-gray-500">({profile.totalSessions} sessions)</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4 text-purple-600" />
                      <span className="text-gray-600">{profile.timezone}</span>
                    </div>
                  </div>
                </div>
              </div>
              {canBookSession && (
                <div className="flex space-x-2">
                  <Button variant="outline" asChild>
                    <Link href={`/messages/new?mentorId=${profile.user.id}`}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/book/${profile.user.id}`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Book Session
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 text-lg leading-relaxed">{profile.bio}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expertise */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span>Expertise</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.expertise.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Experience */}
            <Card>
              <CardHeader>
                <CardTitle>Professional Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 leading-relaxed">{profile.experience}</p>
                {profile.education && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Education</h4>
                    <p className="text-gray-700">{profile.education}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Certifications */}
            {profile.certifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-green-600" />
                    <span>Certifications</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {profile.certifications.map((cert) => (
                      <div key={cert} className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>{cert}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span>Pricing</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profile.pricingModels.map((pricing) => (
                    <div key={pricing.id} className="border rounded-lg p-4">
                      <div className="text-center">
                        <h4 className="font-semibold capitalize">
                          {pricing.type.replace('_', ' ').toLowerCase()}
                        </h4>
                        <div className="text-xl font-bold text-green-600 mt-1">
                          {formatCurrency(pricing.price)}
                        </div>
                        {pricing.duration && (
                          <p className="text-sm text-gray-500">{pricing.duration} minutes</p>
                        )}
                        {pricing.description && (
                          <p className="text-sm text-gray-600 mt-2">{pricing.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Availability */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <span>Availability</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {profile.availability
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((slot, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <span className="font-medium">{dayNames[slot.dayOfWeek]}</span>
                        <span className="text-gray-600">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>
                    ))}
                </div>
                {canBookSession && (
                  <Button className="w-full mt-4" asChild>
                    <Link href={`/book/${profile.user.id}`}>
                      Book a Session
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Sessions</span>
                    <span className="font-semibold">{profile.totalSessions}</span>
                  </div>
                  {profile.averageRating && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Average Rating</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="font-semibold">{profile.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Verified</span>
                    <CheckCircle className={`h-4 w-4 ${profile.isVerified ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}