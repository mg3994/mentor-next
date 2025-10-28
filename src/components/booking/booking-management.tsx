'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Calendar, 
  Clock, 
  User, 
  Video, 
  MessageCircle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { formatDateTime, formatCurrency } from '@/utils'
import Link from 'next/link'

interface Session {
  id: string
  startTime: string
  scheduledEnd: string
  status: string
  pricingType: string
  agreedPrice: number
  sessionLink?: string
  mentor: {
    id: string
    name: string
    image?: string
  }
  mentee: {
    id: string
    name: string
    image?: string
  }
  transaction?: {
    id: string
    amount: number
    status: string
  }
}

interface BookingManagementProps {
  userRole: 'mentor' | 'mentee'
}

const statusColors = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-yellow-100 text-yellow-800',
}

const statusIcons = {
  SCHEDULED: Clock,
  IN_PROGRESS: Video,
  COMPLETED: CheckCircle,
  CANCELLED: XCircle,
  NO_SHOW: AlertCircle,
}

export default function BookingManagement({ userRole }: BookingManagementProps) {
  const { data: session } = useSession()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('upcoming')

  useEffect(() => {
    if (session) {
      fetchSessions()
    }
  }, [session, activeTab])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (activeTab === 'upcoming') {
        params.set('status', 'SCHEDULED')
      } else if (activeTab === 'completed') {
        params.set('status', 'COMPLETED')
      } else if (activeTab === 'cancelled') {
        params.set('status', 'CANCELLED')
      }

      const response = await fetch(`/api/bookings?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        setSessions(result.sessions || [])
      } else {
        setError(result.error || 'Failed to fetch sessions')
      }
    } catch (err) {
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const cancelSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/bookings/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      if (response.ok) {
        fetchSessions() // Refresh the list
      } else {
        const result = await response.json()
        setError(result.error || 'Failed to cancel session')
      }
    } catch (err) {
      setError('Failed to cancel session')
    }
  }

  const joinSession = (sessionLink: string) => {
    // In a real implementation, this would open the video call interface
    window.open(`/session/${sessionLink}`, '_blank')
  }

  const getOtherParticipant = (session: Session) => {
    return userRole === 'mentor' ? session.mentee : session.mentor
  }

  const canCancelSession = (session: Session) => {
    const sessionStart = new Date(session.startTime)
    const now = new Date()
    const hoursUntilSession = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60)
    
    return session.status === 'SCHEDULED' && hoursUntilSession > 2 // Can cancel up to 2 hours before
  }

  const canJoinSession = (session: Session) => {
    const sessionStart = new Date(session.startTime)
    const sessionEnd = new Date(session.scheduledEnd)
    const now = new Date()
    
    return session.status === 'SCHEDULED' && 
           now >= new Date(sessionStart.getTime() - 15 * 60 * 1000) && // 15 minutes before
           now <= sessionEnd
  }

  if (!session) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please sign in to view your sessions.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {userRole === 'mentor' ? 'My Mentoring Sessions' : 'My Learning Sessions'}
        </h1>
        <p className="text-gray-600">
          Manage your {userRole === 'mentor' ? 'mentoring' : 'learning'} sessions and track your progress
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="all">All Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No {activeTab} sessions
                </h3>
                <p className="text-gray-600 mb-4">
                  {userRole === 'mentor' 
                    ? "You don't have any sessions yet. Students will book sessions with you through your profile."
                    : "You haven't booked any sessions yet. Find a mentor and schedule your first session."
                  }
                </p>
                {userRole === 'mentee' && (
                  <Button asChild>
                    <Link href="/search">Find Mentors</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const otherParticipant = getOtherParticipant(session)
                const StatusIcon = statusIcons[session.status as keyof typeof statusIcons]
                
                return (
                  <Card key={session.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          {otherParticipant.image && (
                            <img
                              src={otherParticipant.image}
                              alt={otherParticipant.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {userRole === 'mentor' ? 'Session with' : 'Learning from'} {otherParticipant.name}
                              </h3>
                              <Badge className={statusColors[session.status as keyof typeof statusColors]}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {session.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDateTime(session.startTime)}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  Duration: {Math.round((new Date(session.scheduledEnd).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))} minutes
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">
                                  {formatCurrency(session.agreedPrice)} • {session.pricingType.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col space-y-2">
                          {canJoinSession(session) && (
                            <Button
                              onClick={() => joinSession(session.sessionLink!)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Video className="h-4 w-4 mr-2" />
                              Join Session
                            </Button>
                          )}
                          
                          <Button variant="outline" asChild>
                            <Link href={`/messages/new?userId=${otherParticipant.id}`}>
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Message
                            </Link>
                          </Button>

                          {canCancelSession(session) && (
                            <Button
                              variant="outline"
                              onClick={() => cancelSession(session.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Cancel Session
                            </Button>
                          )}

                          {session.status === 'COMPLETED' && userRole === 'mentee' && (
                            <Button variant="outline" asChild>
                              <Link href={`/sessions/${session.id}/review`}>
                                Leave Review
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>

                      {session.transaction && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Payment Status:</span>
                            <Badge variant={session.transaction.status === 'COMPLETED' ? 'default' : 'secondary'}>
                              {session.transaction.status}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}