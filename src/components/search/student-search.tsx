'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  Users, 
  MapPin, 
  BookOpen, 
  MessageCircle,
  UserPlus,
  Target
} from 'lucide-react'
import { EXPERTISE_CATEGORIES, COMMON_TIMEZONES } from '@/lib/constants'
import Link from 'next/link'

interface StudentProfile {
  id: string
  learningGoals?: string
  interests: string[]
  timezone: string
  user: {
    id: string
    name: string
    image?: string
  }
}

interface StudyGroup {
  id: string
  name: string
  description: string
  topic: string
  memberCount: number
  maxMembers: number
  isPublic: boolean
  createdBy: {
    name: string
  }
}

export default function StudentSearch() {
  const { data: session } = useSession()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'students' | 'groups'>('students')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      query: '',
      interests: [],
      timezone: '',
    },
  })

  const watchQuery = watch('query')

  useEffect(() => {
    if (session) {
      // Load initial data
      searchStudents({})
      loadStudyGroups()
    }
  }, [session])

  const searchStudents = async (searchData: any) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchData.query) params.set('q', searchData.query)
      if (selectedInterests.length) params.set('interests', selectedInterests.join(','))
      if (searchData.timezone) params.set('timezone', searchData.timezone)

      const response = await fetch(`/api/search/students?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        setStudents(result.students || [])
      }
    } catch (error) {
      console.error('Student search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStudyGroups = async () => {
    try {
      const response = await fetch('/api/study-groups')
      const result = await response.json()

      if (response.ok) {
        setStudyGroups(result.groups || [])
      }
    } catch (error) {
      console.error('Study groups load error:', error)
    }
  }

  const onSubmit = (data: any) => {
    if (activeTab === 'students') {
      searchStudents(data)
    }
  }

  const addInterest = (interest: string) => {
    if (!selectedInterests.includes(interest)) {
      const updated = [...selectedInterests, interest]
      setSelectedInterests(updated)
      setValue('interests', updated)
    }
  }

  const removeInterest = (interest: string) => {
    const updated = selectedInterests.filter(i => i !== interest)
    setSelectedInterests(updated)
    setValue('interests', updated)
  }

  const connectWithStudent = async (studentId: string) => {
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      })

      if (response.ok) {
        // Show success message or update UI
        console.log('Connection request sent')
      }
    } catch (error) {
      console.error('Connection error:', error)
    }
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>
            Please sign in to connect with other students and join study groups.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect with Fellow Learners</h1>
        <p className="text-lg text-gray-600">
          Find study partners and join groups to learn together
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-6">
        <Button
          variant={activeTab === 'students' ? 'default' : 'outline'}
          onClick={() => setActiveTab('students')}
        >
          <Users className="h-4 w-4 mr-2" />
          Find Students
        </Button>
        <Button
          variant={activeTab === 'groups' ? 'default' : 'outline'}
          onClick={() => setActiveTab('groups')}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Study Groups
        </Button>
      </div>

      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Search Form */}
          <Card>
            <CardHeader>
              <CardTitle>Find Study Partners</CardTitle>
              <CardDescription>
                Connect with students who share your learning interests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by name or learning goals..."
                        className="pl-10"
                        {...register('query')}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Interests Filter */}
                  <div className="space-y-2">
                    <Label>Common Interests</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedInterests.map((interest) => (
                        <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                          {interest}
                          <button
                            type="button"
                            onClick={() => removeInterest(interest)}
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Select onValueChange={addInterest}>
                      <SelectTrigger>
                        <SelectValue placeholder="Add interest" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERTISE_CATEGORIES.filter(cat => !selectedInterests.includes(cat)).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Timezone Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select onValueChange={(value) => setValue('timezone', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any timezone</SelectItem>
                        {COMMON_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Student Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {students.map((student) => (
              <Card key={student.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    {student.user.image && (
                      <img
                        src={student.user.image}
                        alt={student.user.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.user.name}</h3>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-3 w-3 mr-1" />
                        {student.timezone}
                      </div>
                    </div>
                  </div>

                  {student.learningGoals && (
                    <div className="mb-4">
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Target className="h-3 w-3 mr-1" />
                        Learning Goals
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {student.learningGoals}
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="text-sm text-gray-600 mb-2">Interests</div>
                    <div className="flex flex-wrap gap-1">
                      {student.interests.slice(0, 3).map((interest) => (
                        <Badge key={interest} variant="outline" className="text-xs">
                          {interest}
                        </Badge>
                      ))}
                      {student.interests.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{student.interests.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => connectWithStudent(student.user.id)}
                      className="flex-1"
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Connect
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/messages/new?userId=${student.user.id}`}>
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Message
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {students.length === 0 && !loading && (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
                <p className="text-gray-600">
                  Try adjusting your search criteria to find study partners.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Study Groups Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Study Groups</h2>
              <p className="text-gray-600">Join or create groups to learn together</p>
            </div>
            <Button asChild>
              <Link href="/study-groups/create">
                <UserPlus className="h-4 w-4 mr-2" />
                Create Group
              </Link>
            </Button>
          </div>

          {/* Study Groups List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studyGroups.map((group) => (
              <Card key={group.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{group.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {group.topic}
                      </Badge>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <div>{group.memberCount}/{group.maxMembers} members</div>
                      <div className="text-xs">by {group.createdBy.name}</div>
                    </div>
                  </div>

                  <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                    {group.description}
                  </p>

                  <div className="flex space-x-2">
                    <Button size="sm" className="flex-1" asChild>
                      <Link href={`/study-groups/${group.id}`}>
                        View Group
                      </Link>
                    </Button>
                    {group.memberCount < group.maxMembers && (
                      <Button size="sm" variant="outline">
                        Join
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {studyGroups.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No study groups yet</h3>
                <p className="text-gray-600 mb-4">
                  Be the first to create a study group and start learning together.
                </p>
                <Button asChild>
                  <Link href="/study-groups/create">
                    Create First Group
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}