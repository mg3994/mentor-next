'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Video, AlertCircle } from 'lucide-react'
import EnhancedVideoCall from '@/components/session/enhanced-video-call'

interface SessionPageProps {
  params: {
    sessionId: string
  }
}

interface SessionData {
  id: string
  status: string
  startTime: string
  scheduledEnd: string
  roomId?: string
  participants: Array<{
    id: string
    name: string
    image?: string
    role: 'mentor' | 'mentee'
    isHost: boolean
  }>
  currentUser: {
    id: string
    role: 'mentor' | 'mentee'
    isHost: boolean
  }
}

export default function SessionPage({ params }: SessionPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isJoiningCall, setIsJoiningCall] = useState(false)
  const [inCall, setInCall] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }

    fetchSessionData()
  }, [session, status])

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/sessions/room?sessionId=${params.sessionId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load session')
      }

      setSessionData(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  const createOrJoinRoom = async () => {
    if (!sessionData) return

    setIsJoiningCall(true)
    try {
      let response

      if (sessionData.roomId) {
        // Join existing room
        response = await fetch('/api/sessions/room', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: params.sessionId,
            roomId: sessionData.roomId,
          }),
        })
      } else {
        // Create new room
        response = await fetch('/api/sessions/room', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: params.sessionId,
          }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join session')
      }

      // Update session data with room info
      setSessionData(prev => prev ? {
        ...prev,
        roomId: data.room.id,
      } : null)

      setInCall(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session')
    } finally {
      setIsJoiningCall(false)
    }
  }

  const handleCallEnd = () => {
    setInCall(false)
    router.push('/dashboard/sessions')
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span>Session Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-4 space-x-2">
              <Button onClick={() => router.push('/dashboard/sessions')} variant="outline">
                Back to Sessions
              </Button>
              <Button onClick={fetchSessionData}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Session not found</p>
      </div>
    )
  }

  if (inCall) {
    return (
      <EnhancedVideoCall
        sessionId={params.sessionId}
        userId={session!.user.id}
        userName={session!.user.name || 'User'}
        isHost={sessionData.currentUser.isHost}
        onCallEnd={handleCallEnd}
      />
    )
  }

  const otherParticipant = sessionData.participants.find(p => p.id !== session!.user.id)
  const sessionTime = new Date(sessionData.startTime)
  const isSessionTime = new Date() >= sessionTime

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">Mentorship Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Info */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-4">
              {sessionData.participants.map((participant) => (
                <div key={participant.id} className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    {participant.image ? (
                      <img
                        src={participant.image}
                        alt={participant.name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-semibold text-gray-600">
                        {participant.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{participant.name}</p>
                  <p className="text-sm text-gray-500 capitalize">{participant.role}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-100 rounded-lg p-4">
              <p className="text-sm text-gray-600">Session Time</p>
              <p className="font-semibold">
                {sessionTime.toLocaleDateString()} at {sessionTime.toLocaleTimeString()}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Status: <span className="capitalize">{sessionData.status.toLowerCase().replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          {/* Session Actions */}
          <div className="space-y-4">
            {!isSessionTime && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This session is scheduled for {sessionTime.toLocaleString()}. 
                  You can join up to 15 minutes before the scheduled time.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center space-x-4">
              <Button
                onClick={createOrJoinRoom}
                disabled={isJoiningCall || (!isSessionTime && sessionData.status !== 'IN_PROGRESS')}
                size="lg"
                className="px-8"
              >
                {isJoiningCall ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    {sessionData.roomId ? 'Join Session' : 'Start Session'}
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/sessions')}
              >
                Back to Dashboard
              </Button>
            </div>
          </div>

          {/* Session Guidelines */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Session Guidelines</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure you have a stable internet connection</li>
              <li>• Test your camera and microphone before joining</li>
              <li>• Find a quiet, well-lit environment</li>
              <li>• Be respectful and professional during the session</li>
              <li>• Use the chat feature for sharing links or notes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}