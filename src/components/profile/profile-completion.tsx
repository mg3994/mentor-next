'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface CompletionItem {
  id: string
  label: string
  completed: boolean
  required: boolean
  note?: string
}

interface ProfileCompletionProps {
  userType: 'mentor' | 'mentee'
  profile?: any
  className?: string
}

export default function ProfileCompletion({ userType, profile, className }: ProfileCompletionProps) {
  const getMentorCompletionItems = (): CompletionItem[] => {
    const items = [
      {
        id: 'bio',
        label: 'Professional Bio',
        completed: profile?.bio && profile.bio.length >= 50,
        required: true,
        note: 'Add a detailed professional bio (minimum 50 characters)',
      },
      {
        id: 'expertise',
        label: 'Areas of Expertise',
        completed: profile?.expertise && profile.expertise.length > 0,
        required: true,
        note: 'Select your areas of expertise',
      },
      {
        id: 'experience',
        label: 'Professional Experience',
        completed: profile?.experience && profile.experience.length >= 10,
        required: true,
        note: 'Add your professional experience (minimum 10 characters)',
      },
      {
        id: 'pricing',
        label: 'Pricing Models',
        completed: profile?.pricingModels && profile.pricingModels.length > 0,
        required: true,
        note: 'Set up your pricing models for sessions',
      },
      {
        id: 'availability',
        label: 'Availability Schedule',
        completed: profile?.availability && profile.availability.length > 0,
        required: true,
        note: 'Configure your available time slots',
      },
      {
        id: 'education',
        label: 'Education Background',
        completed: profile?.education && profile.education.length > 0,
        required: false,
        note: 'Add your educational background',
      },
      {
        id: 'certifications',
        label: 'Certifications',
        completed: profile?.certifications && profile.certifications.length > 0,
        required: false,
        note: 'Add relevant certifications',
      },
      {
        id: 'verification',
        label: 'Profile Verification',
        completed: profile?.isVerified,
        required: true,
        note: 'Pending admin review',
      },
    ]

    return items
  }

  const getMenteeCompletionItems = (): CompletionItem[] => {
    const items = [
      {
        id: 'interests',
        label: 'Areas of Interest',
        completed: profile?.interests && profile.interests.length > 0,
        required: true,
        note: 'Select your areas of interest',
      },
      {
        id: 'goals',
        label: 'Learning Goals',
        completed: profile?.learningGoals && profile.learningGoals.length > 0,
        required: false,
      },
      {
        id: 'timezone',
        label: 'Timezone',
        completed: profile?.timezone,
        required: true,
      },
    ]

    return items
  }

  const items = userType === 'mentor' ? getMentorCompletionItems() : getMenteeCompletionItems()
  const requiredItems = items.filter(item => item.required)
  const completedRequired = requiredItems.filter(item => item.completed).length
  const totalRequired = requiredItems.length
  const completedOptional = items.filter(item => !item.required && item.completed).length
  const totalOptional = items.filter(item => !item.required).length

  const requiredProgress = (completedRequired / totalRequired) * 100
  const overallProgress = ((completedRequired + completedOptional) / items.length) * 100

  const getProfileStrength = () => {
    if (requiredProgress === 100 && completedOptional === totalOptional) return 'Excellent'
    if (requiredProgress === 100) return 'Complete'
    if (requiredProgress >= 75) return 'Good'
    if (requiredProgress >= 50) return 'Fair'
    return 'Incomplete'
  }

  const getStrengthColor = () => {
    const strength = getProfileStrength()
    switch (strength) {
      case 'Excellent': return 'text-green-600'
      case 'Complete': return 'text-blue-600'
      case 'Good': return 'text-yellow-600'
      case 'Fair': return 'text-orange-600'
      default: return 'text-red-600'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Profile Completion</CardTitle>
            <CardDescription>
              Complete your profile to {userType === 'mentor' ? 'attract more students' : 'find better mentors'}
            </CardDescription>
          </div>
          <Badge variant="outline" className={getStrengthColor()}>
            {getProfileStrength()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Required Items ({completedRequired}/{totalRequired})</span>
            <span className="font-medium">{Math.round(requiredProgress)}%</span>
          </div>
          <Progress value={requiredProgress} className="h-2" />
          
          {totalOptional > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span>Overall Progress ({completedRequired + completedOptional}/{items.length})</span>
                <span className="font-medium">{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </>
          )}
        </div>

        {/* Completion Items */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-900">Required Items</h4>
          {requiredItems.map((item) => (
            <div key={item.id} className="flex items-center space-x-3">
              {item.completed ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
              <div className="flex-1">
                <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-600'}`}>
                  {item.label}
                </span>
                {item.note && !item.completed && (
                  <p className="text-xs text-gray-500">{item.note}</p>
                )}
              </div>
              {!item.completed && item.id !== 'verification' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/profile/${userType}`}>
                    Add
                  </Link>
                </Button>
              )}
            </div>
          ))}

          {totalOptional > 0 && (
            <>
              <h4 className="font-medium text-sm text-gray-900 mt-6">Optional Items</h4>
              {items.filter(item => !item.required).map((item) => (
                <div key={item.id} className="flex items-center space-x-3">
                  {item.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-600'}`}>
                      {item.label}
                    </span>
                  </div>
                  {!item.completed && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/profile/${userType}`}>
                        Add
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Call to Action */}
        {requiredProgress < 100 && (
          <div className="pt-4 border-t">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium">
                  Complete required items to {userType === 'mentor' ? 'start accepting bookings' : 'improve mentor matching'}
                </p>
                <Button className="mt-2" size="sm" asChild>
                  <Link href={`/profile/${userType}`}>
                    Complete Profile
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}