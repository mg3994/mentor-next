// Collaboration Service for Real-time Tools
// Handles chat, whiteboard, screen sharing, and collaborative features

export interface WhiteboardElement {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'text' | 'arrow'
  x: number
  y: number
  width?: number
  height?: number
  points?: number[]
  text?: string
  color: string
  strokeWidth: number
  timestamp: number
  userId: string
}

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: Date
  type: 'text' | 'file' | 'system'
  fileUrl?: string
  fileName?: string
}

export interface CollaborationState {
  whiteboardElements: WhiteboardElement[]
  chatMessages: ChatMessage[]
  participants: Map<string, ParticipantInfo>
  isScreenSharing: boolean
  screenSharingUserId?: string
}

export interface ParticipantInfo {
  id: string
  name: string
  role: 'mentor' | 'mentee'
  isActive: boolean
  cursor?: { x: number; y: number }
}

export interface DrawingTool {
  type: 'pen' | 'eraser' | 'rectangle' | 'circle' | 'text' | 'arrow'
  color: string
  strokeWidth: number
}

export class CollaborationService {
  private sessionId: string
  private userId: string
  private userName: string
  private dataChannel: RTCDataChannel | null = null
  private state: CollaborationState
  
  // Event callbacks
  public onWhiteboardUpdate?: (elements: WhiteboardElement[]) => void
  public onChatMessage?: (message: ChatMessage) => void
  public onParticipantUpdate?: (participants: Map<string, ParticipantInfo>) => void
  public onScreenShareUpdate?: (isSharing: boolean, userId?: string) => void
  public onError?: (error: string) => void

  constructor(sessionId: string, userId: string, userName: string) {
    this.sessionId = sessionId
    this.userId = userId
    this.userName = userName
    this.state = {
      whiteboardElements: [],
      chatMessages: [],
      participants: new Map(),
      isScreenSharing: false,
    }
  }

  // Initialize collaboration service with data channel
  initialize(dataChannel: RTCDataChannel): void {
    this.dataChannel = dataChannel
    this.setupDataChannelHandlers()
    
    // Add current user as participant
    this.state.participants.set(this.userId, {
      id: this.userId,
      name: this.userName,
      role: 'mentor', // Will be updated based on actual role
      isActive: true,
    })
  }

  // Whiteboard Methods

  addWhiteboardElement(element: Omit<WhiteboardElement, 'id' | 'timestamp' | 'userId'>): void {
    const whiteboardElement: WhiteboardElement = {
      ...element,
      id: `${this.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      userId: this.userId,
    }

    this.state.whiteboardElements.push(whiteboardElement)
    this.broadcastWhiteboardUpdate([whiteboardElement])
    this.onWhiteboardUpdate?.(this.state.whiteboardElements)
  }

  updateWhiteboardElement(elementId: string, updates: Partial<WhiteboardElement>): void {
    const elementIndex = this.state.whiteboardElements.findIndex(el => el.id === elementId)
    if (elementIndex !== -1) {
      this.state.whiteboardElements[elementIndex] = {
        ...this.state.whiteboardElements[elementIndex],
        ...updates,
        timestamp: Date.now(),
      }
      
      this.broadcastWhiteboardUpdate([this.state.whiteboardElements[elementIndex]])
      this.onWhiteboardUpdate?.(this.state.whiteboardElements)
    }
  }

  removeWhiteboardElement(elementId: string): void {
    this.state.whiteboardElements = this.state.whiteboardElements.filter(el => el.id !== elementId)
    
    this.broadcastMessage({
      type: 'whiteboard_remove',
      data: { elementId },
    })
    
    this.onWhiteboardUpdate?.(this.state.whiteboardElements)
  }

  clearWhiteboard(): void {
    this.state.whiteboardElements = []
    
    this.broadcastMessage({
      type: 'whiteboard_clear',
      data: {},
    })
    
    this.onWhiteboardUpdate?.(this.state.whiteboardElements)
  }

  getWhiteboardElements(): WhiteboardElement[] {
    return this.state.whiteboardElements
  }

  // Chat Methods

  sendChatMessage(message: string): void {
    const chatMessage: ChatMessage = {
      id: `${this.userId}_${Date.now()}`,
      userId: this.userId,
      userName: this.userName,
      message,
      timestamp: new Date(),
      type: 'text',
    }

    this.state.chatMessages.push(chatMessage)
    
    this.broadcastMessage({
      type: 'chat_message',
      data: chatMessage,
    })
    
    this.onChatMessage?.(chatMessage)
  }

  sendFileMessage(fileName: string, fileUrl: string): void {
    const chatMessage: ChatMessage = {
      id: `${this.userId}_${Date.now()}`,
      userId: this.userId,
      userName: this.userName,
      message: `Shared file: ${fileName}`,
      timestamp: new Date(),
      type: 'file',
      fileName,
      fileUrl,
    }

    this.state.chatMessages.push(chatMessage)
    
    this.broadcastMessage({
      type: 'chat_message',
      data: chatMessage,
    })
    
    this.onChatMessage?.(chatMessage)
  }

  getChatMessages(): ChatMessage[] {
    return this.state.chatMessages
  }

  // Screen Sharing Methods

  startScreenShare(): void {
    this.state.isScreenSharing = true
    this.state.screenSharingUserId = this.userId
    
    this.broadcastMessage({
      type: 'screen_share_start',
      data: { userId: this.userId },
    })
    
    this.onScreenShareUpdate?.(true, this.userId)
  }

  stopScreenShare(): void {
    this.state.isScreenSharing = false
    this.state.screenSharingUserId = undefined
    
    this.broadcastMessage({
      type: 'screen_share_stop',
      data: { userId: this.userId },
    })
    
    this.onScreenShareUpdate?.(false)
  }

  // Participant Methods

  updateParticipantCursor(x: number, y: number): void {
    const participant = this.state.participants.get(this.userId)
    if (participant) {
      participant.cursor = { x, y }
      
      this.broadcastMessage({
        type: 'cursor_update',
        data: { userId: this.userId, x, y },
      })
    }
  }

  addParticipant(participant: ParticipantInfo): void {
    this.state.participants.set(participant.id, participant)
    this.onParticipantUpdate?.(this.state.participants)
  }

  removeParticipant(participantId: string): void {
    this.state.participants.delete(participantId)
    this.onParticipantUpdate?.(this.state.participants)
  }

  getParticipants(): Map<string, ParticipantInfo> {
    return this.state.participants
  }

  // Utility Methods

  exportWhiteboardAsImage(): string {
    // Create a canvas element to render the whiteboard
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080
    const ctx = canvas.getContext('2d')!
    
    // Set white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Render all whiteboard elements
    this.state.whiteboardElements.forEach(element => {
      ctx.strokeStyle = element.color
      ctx.lineWidth = element.strokeWidth
      
      switch (element.type) {
        case 'line':
          if (element.points && element.points.length >= 4) {
            ctx.beginPath()
            ctx.moveTo(element.points[0], element.points[1])
            for (let i = 2; i < element.points.length; i += 2) {
              ctx.lineTo(element.points[i], element.points[i + 1])
            }
            ctx.stroke()
          }
          break
          
        case 'rectangle':
          ctx.strokeRect(element.x, element.y, element.width || 0, element.height || 0)
          break
          
        case 'circle':
          const radius = Math.min(element.width || 0, element.height || 0) / 2
          ctx.beginPath()
          ctx.arc(element.x + radius, element.y + radius, radius, 0, 2 * Math.PI)
          ctx.stroke()
          break
          
        case 'text':
          ctx.fillStyle = element.color
          ctx.font = `${element.strokeWidth * 4}px Arial`
          ctx.fillText(element.text || '', element.x, element.y)
          break
      }
    })
    
    return canvas.toDataURL('image/png')
  }

  saveSessionState(): string {
    return JSON.stringify({
      whiteboardElements: this.state.whiteboardElements,
      chatMessages: this.state.chatMessages,
      timestamp: Date.now(),
    })
  }

  loadSessionState(stateData: string): void {
    try {
      const data = JSON.parse(stateData)
      this.state.whiteboardElements = data.whiteboardElements || []
      this.state.chatMessages = data.chatMessages || []
      
      this.onWhiteboardUpdate?.(this.state.whiteboardElements)
      data.chatMessages?.forEach((msg: ChatMessage) => {
        this.onChatMessage?.(msg)
      })
    } catch (error) {
      console.error('Failed to load session state:', error)
      this.onError?.('Failed to load session state')
    }
  }

  // Private Methods

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleIncomingMessage(message)
      } catch (error) {
        console.error('Failed to parse collaboration message:', error)
      }
    }

    this.dataChannel.onerror = (error) => {
      console.error('Collaboration data channel error:', error)
      this.onError?.('Collaboration connection error')
    }
  }

  private handleIncomingMessage(message: any): void {
    switch (message.type) {
      case 'whiteboard_update':
        message.data.forEach((element: WhiteboardElement) => {
          const existingIndex = this.state.whiteboardElements.findIndex(el => el.id === element.id)
          if (existingIndex !== -1) {
            this.state.whiteboardElements[existingIndex] = element
          } else {
            this.state.whiteboardElements.push(element)
          }
        })
        this.onWhiteboardUpdate?.(this.state.whiteboardElements)
        break

      case 'whiteboard_remove':
        this.state.whiteboardElements = this.state.whiteboardElements.filter(
          el => el.id !== message.data.elementId
        )
        this.onWhiteboardUpdate?.(this.state.whiteboardElements)
        break

      case 'whiteboard_clear':
        this.state.whiteboardElements = []
        this.onWhiteboardUpdate?.(this.state.whiteboardElements)
        break

      case 'chat_message':
        this.state.chatMessages.push(message.data)
        this.onChatMessage?.(message.data)
        break

      case 'screen_share_start':
        this.state.isScreenSharing = true
        this.state.screenSharingUserId = message.data.userId
        this.onScreenShareUpdate?.(true, message.data.userId)
        break

      case 'screen_share_stop':
        this.state.isScreenSharing = false
        this.state.screenSharingUserId = undefined
        this.onScreenShareUpdate?.(false)
        break

      case 'cursor_update':
        const participant = this.state.participants.get(message.data.userId)
        if (participant) {
          participant.cursor = { x: message.data.x, y: message.data.y }
          this.onParticipantUpdate?.(this.state.participants)
        }
        break

      case 'participant_join':
        this.addParticipant(message.data)
        break

      case 'participant_leave':
        this.removeParticipant(message.data.userId)
        break
    }
  }

  private broadcastMessage(message: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message))
    }
  }

  private broadcastWhiteboardUpdate(elements: WhiteboardElement[]): void {
    this.broadcastMessage({
      type: 'whiteboard_update',
      data: elements,
    })
  }

  // Cleanup
  cleanup(): void {
    this.state.whiteboardElements = []
    this.state.chatMessages = []
    this.state.participants.clear()
    this.dataChannel = null
  }
}

// Utility functions for collaboration tools

export function createDrawingTool(
  type: DrawingTool['type'] = 'pen',
  color: string = '#000000',
  strokeWidth: number = 2
): DrawingTool {
  return { type, color, strokeWidth }
}

export function generateElementId(userId: string): string {
  return `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function isPointInElement(x: number, y: number, element: WhiteboardElement): boolean {
  switch (element.type) {
    case 'rectangle':
      return x >= element.x && 
             x <= element.x + (element.width || 0) && 
             y >= element.y && 
             y <= element.y + (element.height || 0)
             
    case 'circle':
      const centerX = element.x + (element.width || 0) / 2
      const centerY = element.y + (element.height || 0) / 2
      const radius = Math.min(element.width || 0, element.height || 0) / 2
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
      return distance <= radius
      
    case 'text':
      // Approximate text bounds
      const textWidth = (element.text?.length || 0) * element.strokeWidth * 2
      const textHeight = element.strokeWidth * 4
      return x >= element.x && 
             x <= element.x + textWidth && 
             y >= element.y - textHeight && 
             y <= element.y
             
    case 'line':
      // Check if point is near any line segment
      if (!element.points || element.points.length < 4) return false
      
      for (let i = 0; i < element.points.length - 2; i += 2) {
        const x1 = element.points[i]
        const y1 = element.points[i + 1]
        const x2 = element.points[i + 2]
        const y2 = element.points[i + 3]
        
        const distance = distanceToLineSegment(x, y, x1, y1, x2, y2)
        if (distance <= element.strokeWidth + 2) return true
      }
      return false
      
    default:
      return false
  }
}

function distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  
  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx: number, yy: number

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}