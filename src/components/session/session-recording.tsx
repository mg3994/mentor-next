'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Video, 
  Square, 
  Pause, 
  Play,
  Download,
  Settings,
  AlertCircle,
  Clock,
  HardDrive
} from 'lucide-react'
import { RecordingService, type RecordingData, formatDuration, formatFileSize } from '@/lib/recording-service'

interface SessionRecordingProps {
  sessionId: string
  userId: string
  recordingService: RecordingService
  localStream: MediaStream | null
}

export default function SessionRecording({ 
  sessionId, 
  userId, 
  recordingService, 
  localStream 
}: SessionRecordingProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<RecordingData[]>([])
  const [processingRecording, setProcessingRecording] = useState(false)

  useEffect(() => {
    // Set up recording service callbacks
    recordingService.onRecordingStart = () => {
      setIsRecording(true)
      setError(null)
    }

    recordingService.onRecordingStop = (recordingData) => {
      setIsRecording(false)
      setRecordingDuration(0)
      setRecordings(prev => [recordingData, ...prev])
      setProcessingRecording(false)
    }

    recordingService.onRecordingError = (errorMessage) => {
      setError(errorMessage)
      setIsRecording(false)
      setProcessingRecording(false)
    }

    recordingService.onRecordingProgress = (duration) => {
      setRecordingDuration(duration)
    }

    return () => {
      // Cleanup callbacks
      recordingService.onRecordingStart = undefined
      recordingService.onRecordingStop = undefined
      recordingService.onRecordingError = undefined
      recordingService.onRecordingProgress = undefined
    }
  }, [recordingService])

  const startRecording = async () => {
    if (!localStream) {
      setError('No media stream available for recording')
      return
    }

    try {
      await recordingService.startRecording(localStream)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording')
    }
  }

  const stopRecording = async () => {
    try {
      setProcessingRecording(true)
      await recordingService.stopRecording()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording')
      setProcessingRecording(false)
    }
  }

  const downloadRecording = async (recording: RecordingData) => {
    if (recording.downloadUrl) {
      const link = document.createElement('a')
      link.href = recording.downloadUrl
      link.download = recording.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const getRecordingStatusColor = () => {
    if (processingRecording) return 'text-yellow-600'
    if (isRecording) return 'text-red-600'
    return 'text-gray-600'
  }

  const getRecordingStatusText = () => {
    if (processingRecording) return 'Processing...'
    if (isRecording) return 'Recording'
    return 'Ready'
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center space-x-2">
          <Video className="h-5 w-5" />
          <span>Session Recording</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Recording Controls */}
        <div className="space-y-4">
          {/* Status Display */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
              }`} />
              <span className={`font-medium ${getRecordingStatusColor()}`}>
                {getRecordingStatusText()}
              </span>
            </div>
            
            {isRecording && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(recordingDuration)}</span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={!localStream || processingRecording}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Video className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                disabled={processingRecording}
                variant="destructive"
                size="sm"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>

          {/* Processing Indicator */}
          {processingRecording && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing recording...</span>
              </div>
              <Progress className="w-full" />
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Recordings List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          <h4 className="font-medium text-gray-900">Session Recordings</h4>
          
          {recordings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recordings yet</p>
              <p className="text-sm">Start recording to capture your session</p>
            </div>
          ) : (
            recordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0">
                  <Video className="h-5 w-5 text-gray-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {recording.fileName}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{formatDuration(recording.duration)}</span>
                    <span>•</span>
                    <span>{formatFileSize(recording.fileSize)}</span>
                    <span>•</span>
                    <span className="capitalize">{recording.quality} quality</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(recording.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadRecording(recording)}
                    className="h-8 w-8 p-0"
                    disabled={!recording.downloadUrl}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recording Guidelines */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Recordings include both video and audio</p>
          <p>• Files are automatically saved after stopping</p>
          <p>• Recordings are available for download immediately</p>
          <p>• Both participants can access session recordings</p>
        </div>
      </CardContent>
    </Card>
  )
}