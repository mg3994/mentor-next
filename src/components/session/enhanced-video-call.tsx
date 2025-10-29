'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Users,
  FileText,
  Upload,
  Camera,
  AlertCircle,
  Loader2
} from 'lucide-react'
import VideoCall from './video-call'
import FileSharing from './file-sharing'
import SessionRecording from './session-recording'
import CollaborativeNotes from './collaborative-notes'
import { WebRTCService } from '@/lib/webrtc-service'
import { RecordingService, createRecordingConfig } from '@/lib/recording-service'

interface EnhancedVideoCallProps {
  sessionId: string
  userId: string
  userName: string
  isHost: boolean
  onCallEnd?: () => void
}

export default function EnhancedVideoCall({ 
  sessionId, 
  userId, 
  userName,
  isHost,
  onCallEnd
}: EnhancedVideoCallProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [activeTab, setActiveTab] = useState('video')
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null)
  const recordingServiceRef = useRef<RecordingService | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    initializeServices()
    return () => {
      cleanup()
    }
  }, [])

  const initializeServices = async () => {
    try {
      // Initialize WebRTC service
      webrtcServiceRef.current = new WebRTCService({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        sessionId,
        userId,
        isHost,
      })

      // Set up WebRTC callbacks
      webrtcServiceRef.current.onConnectionStateChange = (state) => {
        const mappedState = state === 'connected' ? 'connected' : 
                           state === 'connecting' ? 'connecting' :
                           state === 'failed' || state === 'disconnected' ? 'error' : 'disconnected'
        setConnectionStatus(mappedState)
        setIsConnected(state === 'connected')
      }

      webrtcServiceRef.current.onLocalStream = (stream) => {
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
      }

      webrtcServiceRef.current.onRemoteStream = (stream) => {
        setRemoteStream(stream)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
        }
      }

      webrtcServiceRef.current.onError = (errorMessage) => {
        setError(errorMessage)
        setConnectionStatus('error')
      }

      // Initialize Recording service
      const recordingConfig = createRecordingConfig(sessionId, userId, {
        quality: 'medium',
        includeAudio: true,
        includeVideo: true,
      })
      
      recordingServiceRef.current = new RecordingService(recordingConfig)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize services')
    }
  }

  const startCall = async () => {
    if (!webrtcServiceRef.current) return

    try {
      setConnectionStatus('connecting')
      setError(null)
      await webrtcServiceRef.current.initialize()
      await webrtcServiceRef.current.getUserMedia()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call')
      setConnectionStatus('error')
    }
  }

  const endCall = async () => {
    if (!webrtcServiceRef.current) return

    try {
      webrtcServiceRef.current.cleanup()
      setConnectionStatus('disconnected')
      setIsConnected(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end call')
    }
  }

  const toggleVideo = async () => {
    if (!webrtcServiceRef.current) return

    try {
      const newState = !isVideoEnabled
      await webrtcServiceRef.current.toggleVideo(newState)
      setIsVideoEnabled(newState)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle video')
    }
  }

  const toggleAudio = async () => {
    if (!webrtcServiceRef.current) return

    try {
      const newState = !isAudioEnabled
      await webrtcServiceRef.current.toggleAudio(newState)
      setIsAudioEnabled(newState)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle audio')
    }
  }

  const toggleScreenShare = async () => {
    if (!webrtcServiceRef.current) return

    try {
      if (!isScreenSharing) {
        await webrtcServiceRef.current.getDisplayMedia()
        setIsScreenSharing(true)
      } else {
        webrtcServiceRef.current.stopScreenShare()
        setIsScreenSharing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle screen share')
    }
  }

  const cleanup = () => {
    webrtcServiceRef.current?.cleanup()
    recordingServiceRef.current?.cleanup()
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600'
      case 'connecting': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected'
      case 'connecting': return 'Connecting...'
      case 'error': return 'Connection Error'
      default: return 'Disconnected'
    }
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
            connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          <span className={`font-medium ${getConnectionStatusColor()}`}>
            {getConnectionStatusText()}
          </span>
          {connectionStatus === 'connecting' && (
            <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
          )}
        </div>

        <div className="flex items-center space-x-2">
          {!isConnected ? (
            <Button
              onClick={startCall}
              disabled={connectionStatus === 'connecting'}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Phone className="h-4 w-4 mr-2" />
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Call'}
            </Button>
          ) : (
            <Button
              onClick={endCall}
              variant="destructive"
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              End Call
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video Call Area */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-4 h-full flex flex-col">
              {/* Video Streams */}
              <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden">
                {/* Remote Video */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* No Video Placeholder */}
                {!remoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Waiting for participant...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Controls */}
              {isConnected && (
                <div className="flex items-center justify-center space-x-4 mt-4">
                  <Button
                    variant={isVideoEnabled ? "default" : "destructive"}
                    size="sm"
                    onClick={toggleVideo}
                  >
                    {isVideoEnabled ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant={isAudioEnabled ? "default" : "destructive"}
                    size="sm"
                    onClick={toggleAudio}
                  >
                    {isAudioEnabled ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant={isScreenSharing ? "secondary" : "outline"}
                    size="sm"
                    onClick={toggleScreenShare}
                  >
                    {isScreenSharing ? (
                      <MonitorOff className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="notes" className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center space-x-1">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger value="recording" className="flex items-center space-x-1">
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Record</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4">
              <TabsContent value="notes" className="h-full m-0">
                <CollaborativeNotes
                  sessionId={sessionId}
                  userId={userId}
                  userName={userName}
                />
              </TabsContent>

              <TabsContent value="files" className="h-full m-0">
                {recordingServiceRef.current && (
                  <FileSharing
                    sessionId={sessionId}
                    userId={userId}
                    recordingService={recordingServiceRef.current}
                  />
                )}
              </TabsContent>

              <TabsContent value="recording" className="h-full m-0">
                {recordingServiceRef.current && (
                  <SessionRecording
                    sessionId={sessionId}
                    userId={userId}
                    recordingService={recordingServiceRef.current}
                    localStream={localStream}
                  />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}