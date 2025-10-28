// WebRTC Service for Real-time Video/Audio Communication
// Handles peer-to-peer connections, signaling, and media management

export interface WebRTCConfig {
  iceServers: RTCIceServer[]
  sessionId: string
  userId: string
  isHost: boolean
}

export interface MediaConstraints {
  video: boolean | MediaTrackConstraints
  audio: boolean | MediaTrackConstraints
}

export interface SessionParticipant {
  id: string
  name: string
  role: 'mentor' | 'mentee'
  isHost: boolean
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'chat'
  sessionId: string
  userId: string
  data?: any
}

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: Date
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private dataChannel: RTCDataChannel | null = null
  private signalingChannel: WebSocket | null = null
  
  private config: WebRTCConfig
  private participants: Map<string, SessionParticipant> = new Map()
  private chatMessages: ChatMessage[] = []
  
  // Event callbacks
  public onLocalStream?: (stream: MediaStream) => void
  public onRemoteStream?: (stream: MediaStream) => void
  public onParticipantJoined?: (participant: SessionParticipant) => void
  public onParticipantLeft?: (participantId: string) => void
  public onChatMessage?: (message: ChatMessage) => void
  public onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  public onError?: (error: string) => void

  constructor(config: WebRTCConfig) {
    this.config = config
  }

  // Initialize WebRTC connection
  async initialize(): Promise<void> {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers.length > 0 ? this.config.iceServers : [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })

      // Set up event handlers
      this.setupPeerConnectionHandlers()

      // Create data channel for chat and file sharing
      if (this.config.isHost) {
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
          ordered: true,
        })
        this.setupDataChannelHandlers(this.dataChannel)
      } else {
        this.peerConnection.ondatachannel = (event) => {
          this.dataChannel = event.channel
          this.setupDataChannelHandlers(this.dataChannel)
        }
      }

      // Initialize signaling (simplified - in production would use WebSocket server)
      await this.initializeSignaling()

    } catch (error) {
      console.error('WebRTC initialization error:', error)
      this.onError?.('Failed to initialize WebRTC connection')
      throw error
    }
  }

  // Get user media (camera and microphone)
  async getUserMedia(constraints: MediaConstraints = { video: true, audio: true }): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.localStream = stream
      
      // Add tracks to peer connection
      if (this.peerConnection) {
        stream.getTracks().forEach(track => {
          this.peerConnection!.addTrack(track, stream)
        })
      }

      this.onLocalStream?.(stream)
      return stream

    } catch (error) {
      console.error('getUserMedia error:', error)
      this.onError?.('Failed to access camera/microphone. Please check permissions.')
      throw error
    }
  }

  // Get screen sharing stream
  async getDisplayMedia(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // Replace video track with screen share
      if (this.peerConnection && this.localStream) {
        const videoTrack = stream.getVideoTracks()[0]
        const sender = this.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        )
        
        if (sender) {
          await sender.replaceTrack(videoTrack)
        }

        // Handle screen share end
        videoTrack.onended = () => {
          this.stopScreenShare()
        }
      }

      return stream

    } catch (error) {
      console.error('getDisplayMedia error:', error)
      this.onError?.('Failed to share screen')
      throw error
    }
  }

  // Stop screen sharing and return to camera
  async stopScreenShare(): Promise<void> {
    if (this.localStream && this.peerConnection) {
      const cameraTrack = this.localStream.getVideoTracks()[0]
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      )
      
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack)
      }
    }
  }

  // Toggle video track
  toggleVideo(enabled?: boolean): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled
        return videoTrack.enabled
      }
    }
    return false
  }

  // Toggle audio track
  toggleAudio(enabled?: boolean): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled
        return audioTrack.enabled
      }
    }
    return false
  }

  // Send chat message
  sendChatMessage(message: string): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const chatMessage: ChatMessage = {
        id: Date.now().toString(),
        userId: this.config.userId,
        userName: 'You', // In real app, would get from user data
        message,
        timestamp: new Date(),
      }

      this.dataChannel.send(JSON.stringify({
        type: 'chat',
        data: chatMessage,
      }))

      this.chatMessages.push(chatMessage)
      this.onChatMessage?.(chatMessage)
    }
  }

  // Get chat messages
  getChatMessages(): ChatMessage[] {
    return this.chatMessages
  }

  // Create offer (for host)
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)
    
    // In production, would send offer through signaling server
    return offer
  }

  // Create answer (for guest)
  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    await this.peerConnection.setRemoteDescription(offer)
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    
    return answer
  }

  // Handle answer (for host)
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    await this.peerConnection.setRemoteDescription(answer)
  }

  // Handle ICE candidate
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    await this.peerConnection.addIceCandidate(candidate)
  }

  // Get connection statistics
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) return null
    return await this.peerConnection.getStats()
  }

  // Cleanup and close connection
  cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Close signaling channel
    if (this.signalingChannel) {
      this.signalingChannel.close()
      this.signalingChannel = null
    }

    // Clear participants
    this.participants.clear()
    this.chatMessages = []
  }

  // Private methods

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0]
      this.onRemoteStream?.(event.streams[0])
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // In production, would send candidate through signaling server
        console.log('ICE candidate:', event.candidate)
      }
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState
      this.onConnectionStateChange?.(state)
      
      if (state === 'failed' || state === 'disconnected') {
        this.onError?.('Connection lost')
      }
    }

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection!.iceConnectionState
      console.log('ICE connection state:', state)
    }
  }

  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('Data channel opened')
    }

    channel.onclose = () => {
      console.log('Data channel closed')
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        if (message.type === 'chat') {
          this.chatMessages.push(message.data)
          this.onChatMessage?.(message.data)
        }
      } catch (error) {
        console.error('Data channel message error:', error)
      }
    }

    channel.onerror = (error) => {
      console.error('Data channel error:', error)
    }
  }

  private async initializeSignaling(): Promise<void> {
    // Simplified signaling - in production would use WebSocket server
    // For demo purposes, we'll simulate the signaling process
    
    // Simulate joining session
    setTimeout(() => {
      const participant: SessionParticipant = {
        id: this.config.userId,
        name: 'Current User',
        role: this.config.isHost ? 'mentor' : 'mentee',
        isHost: this.config.isHost,
      }
      
      this.participants.set(this.config.userId, participant)
      this.onParticipantJoined?.(participant)
    }, 1000)
  }
}

// Utility functions for WebRTC

export function createWebRTCConfig(sessionId: string, userId: string, isHost: boolean): WebRTCConfig {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // In production, would include TURN servers for NAT traversal
    ],
    sessionId,
    userId,
    isHost,
  }
}

export function getMediaConstraints(quality: 'low' | 'medium' | 'high' = 'medium'): MediaConstraints {
  const constraints: MediaConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: true,
  }

  switch (quality) {
    case 'low':
      constraints.video = {
        width: { max: 640 },
        height: { max: 480 },
        frameRate: { max: 15 },
      }
      break
    case 'medium':
      constraints.video = {
        width: { max: 1280 },
        height: { max: 720 },
        frameRate: { max: 30 },
      }
      break
    case 'high':
      constraints.video = {
        width: { max: 1920 },
        height: { max: 1080 },
        frameRate: { max: 30 },
      }
      break
  }

  return constraints
}