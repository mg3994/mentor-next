'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Edit, 
  MapPin, 
  Star, 
  Users, 
  Clock, 
  Award, 
  BookOpen, 
  CheckCircle, 
  AlertCircle,
  DollarSign
} from 'lucide-react'
import { formatCurrency } from '@/utils'

interface MentorProfileDisplayProps {
  profile: {
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
    createdAt: Date
    updatedAt: Date
    user: {
      name: string
      email: string
      image?: string
    }
    pricingModels?: Array<{
      id: string
      type: string
      price: number
      duration?: number
      description?: string
      isActive: boolean
    }>
    availability?: Array<{
      id: string
      dayOfWeek: number
      startTime: string
      endTime: string
      isActive: boolean
    }>
  }
  canEdit?: boolean
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function MentorProfileDisplay({ profile, canEdit = false }: MentorProfileDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {profile.user.image && (
                <img
                  src={profile.user.image}
                  alt={profile.user.name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-2xl">{profile.user.name}</CardTitle>
                  {profile.isVerified ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                  )}
                </div>
                <CardDescription className="text-base">{profile.user.email}</CardDescription>
                <div className="flex items-center space-x-4 mt-2">
                  {profile.averageRating && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">{profile.averageRating.toFixed(1)}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">{profile.totalSessions} sessions</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">{profile.timezone}</span>
                  </div>
                </div>
              </div>
            </div>
            {canEdit && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Verification Status */}
          {!profile.isVerified && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your mentor profile is pending verification. You'll be able to accept bookings once verified.
              </AlertDescription>
            </Alert>
          )}

          {/* Bio */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">About</h3>
            <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
          </div>
        </CardContent>
      </Card>

      {/* Expertise & Experience */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-green-600" />
              <span>Certifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.certifications.length > 0 ? (
              <div className="space-y-2">
                {profile.certifications.map((cert) => (
                  <div key={cert} className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{cert}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No certifications listed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Experience & Education */}
      <Card>
        <CardHeader>
          <CardTitle>Professional Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Experience</h4>
            <p className="text-gray-700 leading-relaxed">{profile.experience}</p>
          </div>
          {profile.education && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Education</h4>
              <p className="text-gray-700">{profile.education}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Models */}
      {profile.pricingModels && profile.pricingModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Pricing</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profile.pricingModels.filter(p => p.isActive).map((pricing) => (
                <div key={pricing.id} className="border rounded-lg p-4">
                  <div className="text-center">
                    <h4 className="font-semibold capitalize">
                      {pricing.type.replace('_', ' ').toLowerCase()}
                    </h4>
                    <div className="text-2xl font-bold text-green-600 mt-2">
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
      )}

      {/* Availability */}
      {profile.availability && profile.availability.length > 0 && (
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
                .filter(a => a.isActive)
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <span className="font-medium">{dayNames[slot.dayOfWeek]}</span>
                    <span className="text-gray-600">
                      {slot.startTime} - {slot.endTime}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>
              Profile created on {new Date(profile.createdAt).toLocaleDateString()}
              {profile.updatedAt !== profile.createdAt && (
                <span> • Last updated {new Date(profile.updatedAt).toLocaleDateString()}</span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}