'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  MessageSquare, 
  FileText, 
  Share2,
  Settings,
  Maximize2,
  Minimize2,
  Users,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileSessionInterfaceProps {
  sessionId: string
  session: {
    id: string
    status: string
    scheduledAt: Date
    duration: number
    mentor: {
      user: {
        name: string
        image?: string
      }
    }
    mentee: {
      user: {
        name: string
        image?: string
      }
    }
  }
}

export default function MobileSessionInterface({ sessionId, session }: MobileSessionInterfaceProps) {
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState('video')
  const [sessionTime, setSessionTime] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleVideo = () => setIsVideoOn(!isVideoOn)
  const toggleAudio = () => setIsAudioOn(!isAudioOn)
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  const endSession = async () => {
    try {
      await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
      })
      // Redirect to session summary or dashboard
    } catch (error) {
      console.error('Failed to end session:', error)
    }
  }

  return (
    <div className={cn(
      'flex flex-col h-screen bg-gray-900',
      isFullscreen ? 'fixed inset-0 z-50' : ''
    )}>
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between text-white">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            )} />
            <span className="text-sm font-medium">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono">{formatTime(sessionTime)}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="text-white hover:bg-gray-700"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          {/* Tab Navigation */}
          <div className="bg-gray-800 px-4">
            <TabsList className="grid w-full grid-cols-4 bg-gray-700">
              <TabsTrigger value="video" className="text-xs">
                <Video className="h-4 w-4 mr-1" />
                Video
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs">
                <MessageSquare className="h-4 w-4 mr-1" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">
                <FileText className="h-4 w-4 mr-1" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs">
                <Share2 className="h-4 w-4 mr-1" />
                Files
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Video Tab */}
          <TabsContent value="video" className="flex-1 p-0 m-0">
            <div className="relative h-full bg-black">
              {/* Remote Video */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gray-600 rounded-full flex items-center justify-center">
                  <Users className="h-16 w-16 text-gray-400" />
                </div>
              </div>
              
              {/* Local Video (Picture-in-Picture) */}
              <div className="absolute top-4 right-4 w-24 h-32 bg-gray-700 rounded-lg overflow-hidden">
                {isVideoOn ? (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs">You</span>
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                    <VideoOff className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Participant Info */}
              <div className="absolute bottom-20 left-4 right-4">
                <div className="bg-black bg-opacity-50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-white">
                    <div>
                      <p className="font-medium">{session.mentor.user.name}</p>
                      <p className="text-sm text-gray-300">Mentor</p>
                    </div>
                    <Badge variant="secondary" className="bg-green-600">
                      Speaking
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 p-4 bg-white">
            <div className="h-full flex flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto mb-4">
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                    <p className="text-sm">Welcome to the session! How can I help you today?</p>
                    <p className="text-xs text-gray-500 mt-1">{session.mentor.user.name}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white rounded-lg p-3 max-w-xs">
                    <p className="text-sm">Thanks! I'd like to discuss React best practices.</p>
                    <p className="text-xs text-blue-100 mt-1">You</p>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button size="sm">Send</Button>
              </div>
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 p-4 bg-white">
            <div className="h-full">
              <textarea
                placeholder="Take notes during your session..."
                className="w-full h-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 p-4 bg-white">
            <div className="space-y-4">
              <Button className="w-full" variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Upload File
              </Button>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Shared Files</h4>
                <div className="text-sm text-gray-500">
                  No files shared yet
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Control Bar */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center space-x-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAudio}
            className={cn(
              'w-12 h-12 rounded-full',
              isAudioOn 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-red-600 hover:bg-red-500 text-white'
            )}
          >
            {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleVideo}
            className={cn(
              'w-12 h-12 rounded-full',
              isVideoOn 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-red-600 hover:bg-red-500 text-white'
            )}
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={endSession}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700"
          >
            <Phone className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-500 text-white"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}