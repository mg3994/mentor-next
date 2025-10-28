'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Edit, MapPin, Target, Clock } from 'lucide-react'
import MenteeProfileForm from './mentee-profile-form'

interface MenteeProfileDisplayProps {
  profile: {
    id: string
    learningGoals?: string
    interests: string[]
    timezone: string
    createdAt: Date
    updatedAt: Date
    user: {
      name: string
      email: string
      image?: string
    }
  }
  canEdit?: boolean
}

export default function MenteeProfileDisplay({ profile, canEdit = false }: MenteeProfileDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Mentee Profile</h2>
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
        <MenteeProfileForm 
          initialData={profile} 
          onSuccess={() => setIsEditing(false)} 
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              {profile.user.image && (
                <img
                  src={profile.user.image}
                  alt={profile.user.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              )}
              <div>
                <CardTitle className="text-2xl">{profile.user.name}</CardTitle>
                <CardDescription className="text-base">{profile.user.email}</CardDescription>
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
        <CardContent className="space-y-6">
          {/* Learning Goals */}
          {profile.learningGoals && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Learning Goals</h3>
              </div>
              <p className="text-gray-700 leading-relaxed">{profile.learningGoals}</p>
            </div>
          )}

          {/* Interests */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 bg-green-600 rounded-full flex items-center justify-center">
                <div className="h-2 w-2 bg-white rounded-full" />
              </div>
              <h3 className="text-lg font-semibold">Areas of Interest</h3>
            </div>
            {profile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No interests specified</p>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Timezone</h3>
            </div>
            <p className="text-gray-700">{profile.timezone}</p>
          </div>

          {/* Profile Stats */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>
                Profile created on {new Date(profile.createdAt).toLocaleDateString()}
                {profile.updatedAt !== profile.createdAt && (
                  <span> • Last updated {new Date(profile.updatedAt).toLocaleDateString()}</span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Completion Tips */}
      {(!profile.learningGoals || profile.interests.length === 0) && canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Complete Your Profile</CardTitle>
            <CardDescription>
              A complete profile helps mentors understand how they can best help you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {!profile.learningGoals && (
                <Alert>
                  <AlertDescription>
                    Add your learning goals to help mentors understand what you want to achieve
                  </AlertDescription>
                </Alert>
              )}
              {profile.interests.length === 0 && (
                <Alert>
                  <AlertDescription>
                    Add areas of interest to help mentors find you for relevant topics
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <Button 
              className="mt-4" 
              onClick={() => setIsEditing(true)}
            >
              Complete Profile
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}