'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  Monitor,
  MonitorOff,
  Settings,
  AlertCircle,
  Users,
  MessageCircle,
  Send
} from 'lucide-react'
import { WebRTCService, createWebRTCConfig, getMediaConstraints, type ChatMessage } from '@/lib/webrtc-service'
import { Input } from '@/components/ui/input'

interface VideoCallProps {
  sessionId: string
  userId: string
  isHost: boolean
  onCallEnd?: () => void
}

export default function VideoCall({ sessionId, userId, isHost, onCallEnd }: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<RTCPeerConnectionState>('new')
  const [showChat, setShowChat] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const webrtcServiceRef = useRef<WebRTCService | null>(null)

  useEffect(() => {
    initializeCall()
    return () => {
      cleanup()
    }
  }, [])

  const initializeCall = async () => {
    try {
      // Create WebRTC service
      const config = createWebRTCConfig(sessionId, userId, isHost)
      const webrtcService = new WebRTCService(config)
      webrtcServiceRef.current = webrtcService

      // Set up event handlers
      webrtcService.onLocalStream = (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      }

      webrtcService.onRemoteStream = (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      }

      webrtcService.onConnectionStateChange = (state) => {
        setConnectionStatus(state)
        if (state === 'connected') {
          setIsCallActive(true)
        } else if (state === 'disconnected' || state === 'failed') {
          setIsCallActive(false)
        }
      }

      webrtcService.onChatMessage = (message) => {
        setChatMessages(prev => [...prev, message])
      }

      webrtcService.onError = (errorMessage) => {
        setError(errorMessage)
      }

      // Initialize WebRTC
      await webrtcService.initialize()

      // Get user media
      const constraints = getMediaConstraints('medium')
      await webrtcService.getUserMedia(constraints)

      // For demo purposes, simulate connection after a delay
      setTimeout(() => {
        setConnectionStatus('connected')
        setIsCallActive(true)
      }, 2000)

    } catch (err) {
      setError('Failed to initialize video call. Please check permissions.')
      console.error('Video call initialization error:', err)
    }
  }

  const cleanup = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.cleanup()
      webrtcServiceRef.current = null
    }
  }

  const toggleVideo = () => {
    if (webrtcServiceRef.current) {
      const enabled = webrtcServiceRef.current.toggleVideo()
      setIsVideoEnabled(enabled)
    }
  }

  const toggleAudio = () => {
    if (webrtcServiceRef.current) {
      const enabled = webrtcServiceRef.current.toggleAudio()
      setIsAudioEnabled(enabled)
    }
  }

  const toggleScreenShare = async () => {
    try {
      if (webrtcServiceRef.current) {
        if (!isScreenSharing) {
          await webrtcServiceRef.current.getDisplayMedia()
          setIsScreenSharing(true)
        } else {
          await webrtcServiceRef.current.stopScreenShare()
          setIsScreenSharing(false)
        }
      }
    } catch (err) {
      setError('Failed to share screen')
      console.error('Screen share error:', err)
    }
  }

  const sendChatMessage = () => {
    if (webrtcServiceRef.current && chatMessage.trim()) {
      webrtcServiceRef.current.sendChatMessage(chatMessage.trim())
      setChatMessage('')
    }
  }

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const endCall = () => {
    cleanup()
    setIsCallActive(false)
    if (onCallEnd) {
      onCallEnd()
    }
  }

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Video Area */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Connection Status */}
        {connectionStatus !== 'connected' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">
                    {connectionStatus === 'new' || connectionStatus === 'connecting' 
                      ? 'Connecting to session...' 
                      : connectionStatus === 'failed' 
                      ? 'Connection failed' 
                      : 'Connection lost'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Remote Video (Main) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ display: connectionStatus === 'connected' ? 'block' : 'none' }}
        />

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-white" />
            </div>
          )}
        </div>

        {/* Session Info */}
        <div className="absolute top-4 left-4">
          <Card className="bg-black/50 border-gray-600">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2 text-white">
                <Users className="h-4 w-4" />
                <span className="text-sm">Session: {sessionId.slice(-8)}</span>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="absolute right-4 top-4 bottom-20 w-80 bg-white rounded-lg shadow-lg flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Session Chat</h3>
            </div>
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.userId === userId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg ${
                    msg.userId === userId 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-800'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Chat Input */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button onClick={sendChatMessage} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900 p-4">
        <div className="flex items-center justify-center space-x-4">
          <Button
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-12 h-12"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-12 h-12"
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={toggleScreenShare}
            className="rounded-full w-12 h-12"
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            onClick={endCall}
            className="rounded-full w-12 h-12"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>

          <Button
            variant={showChat ? "default" : "secondary"}
            size="lg"
            onClick={() => setShowChat(!showChat)}
            className="rounded-full w-12 h-12"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="rounded-full w-12 h-12"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Call Status */}
        <div className="text-center mt-2">
          <p className="text-sm text-gray-400">
            {connectionStatus === 'connected' ? 'Call in progress' : 'Connecting...'}
          </p>
        </div>
      </div>
    </div>
  )
}