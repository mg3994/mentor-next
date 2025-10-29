// Support Service
// Handles support tickets, messaging, and help system

export interface SupportTicket {
  id: string
  userId: string
  subject: string
  description: string
  category: SupportCategory
  priority: SupportPriority
  status: SupportStatus
  assignedTo?: string
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
  user?: {
    id: string
    name: string
    email: string
  }
  assignee?: {
    id: string
    name: string
  }
  messages?: SupportMessage[]
}

export interface SupportMessage {
  id: string
  ticketId: string
  senderId: string
  message: string
  isStaff: boolean
  attachments?: string[]
  createdAt: Date
  sender?: {
    id: string
    name: string
    role: string
  }
}

export type SupportCategory = 
  | 'TECHNICAL'
  | 'BILLING'
  | 'ACCOUNT'
  | 'SESSION'
  | 'SAFETY'
  | 'FEATURE_REQUEST'
  | 'BUG_REPORT'
  | 'OTHER'

export type SupportPriority = 
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT'

export type SupportStatus = 
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_USER'
  | 'RESOLVED'
  | 'CLOSED'

export interface SupportStats {
  totalTickets: number
  openTickets: number
  resolvedTickets: number
  averageResponseTime: number
  averageResolutionTime: number
  ticketsByCategory: Record<SupportCategory, number>
  ticketsByPriority: Record<SupportPriority, number>
  ticketsByStatus: Record<SupportStatus, number>
}

export interface CreateTicketData {
  subject: string
  description: string
  category: SupportCategory
  priority?: SupportPriority
  attachments?: File[]
}

export class SupportService {
  // Create a new support ticket
  static async createTicket(ticketData: CreateTicketData): Promise<SupportTicket> {
    try {
      const formData = new FormData()
      formData.append('subject', ticketData.subject)
      formData.append('description', ticketData.description)
      formData.append('category', ticketData.category)
      formData.append('priority', ticketData.priority || 'MEDIUM')
      
      // Add attachments if any
      if (ticketData.attachments) {
        ticketData.attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file)
        })
      }

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create support ticket')
      }

      const result = await response.json()
      return result.ticket

    } catch (error) {
      console.error('Create ticket error:', error)
      throw error
    }
  }

  // Get user's support tickets
  static async getUserTickets(
    options: {
      status?: SupportStatus
      category?: SupportCategory
      limit?: number
      offset?: number
    } = {}
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    try {
      const params = new URLSearchParams()
      if (options.status) params.append('status', options.status)
      if (options.category) params.append('category', options.category)
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.offset) params.append('offset', options.offset.toString())

      const response = await fetch(`/api/support/tickets?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch support tickets')
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('Get user tickets error:', error)
      throw error
    }
  }

  // Get specific ticket with messages
  static async getTicket(ticketId: string): Promise<SupportTicket> {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to fetch ticket')
      }

      const result = await response.json()
      return result.ticket

    } catch (error) {
      console.error('Get ticket error:', error)
      throw error
    }
  }

  // Add message to ticket
  static async addMessage(
    ticketId: string, 
    content: string, 
    attachments?: File[]
  ): Promise<SupportMessage> {
    try {
      const formData = new FormData()
      formData.append('content', content)
      
      // Add attachments if any
      if (attachments) {
        attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file)
        })
      }

      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add message')
      }

      const result = await response.json()
      return result.message

    } catch (error) {
      console.error('Add message error:', error)
      throw error
    }
  }

  // Update ticket status (admin only)
  static async updateTicketStatus(
    ticketId: string, 
    status: SupportStatus,
    assignedTo?: string
  ): Promise<SupportTicket> {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, assignedTo }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update ticket status')
      }

      const result = await response.json()
      return result.ticket

    } catch (error) {
      console.error('Update ticket status error:', error)
      throw error
    }
  }

  // Get support statistics (admin only)
  static async getSupportStats(): Promise<SupportStats> {
    try {
      const response = await fetch('/api/support/stats')

      if (!response.ok) {
        throw new Error('Failed to fetch support statistics')
      }

      const result = await response.json()
      return result.stats

    } catch (error) {
      console.error('Get support stats error:', error)
      throw error
    }
  }

  // Search tickets (admin only)
  static async searchTickets(
    query: string,
    filters: {
      status?: SupportStatus[]
      category?: SupportCategory[]
      priority?: SupportPriority[]
      assignedTo?: string
      dateFrom?: Date
      dateTo?: Date
    } = {}
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    try {
      const params = new URLSearchParams()
      params.append('query', query)
      
      if (filters.status) {
        filters.status.forEach(status => params.append('status', status))
      }
      if (filters.category) {
        filters.category.forEach(category => params.append('category', category))
      }
      if (filters.priority) {
        filters.priority.forEach(priority => params.append('priority', priority))
      }
      if (filters.assignedTo) params.append('assignedTo', filters.assignedTo)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString())
      if (filters.dateTo) params.append('dateTo', filters.dateTo.toISOString())

      const response = await fetch(`/api/support/search?${params}`)

      if (!response.ok) {
        throw new Error('Failed to search tickets')
      }

      const result = await response.json()
      return result

    } catch (error) {
      console.error('Search tickets error:', error)
      throw error
    }
  }

  // Close ticket
  static async closeTicket(ticketId: string, reason?: string): Promise<SupportTicket> {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to close ticket')
      }

      const result = await response.json()
      return result.ticket

    } catch (error) {
      console.error('Close ticket error:', error)
      throw error
    }
  }

  // Reopen ticket
  static async reopenTicket(ticketId: string, reason?: string): Promise<SupportTicket> {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to reopen ticket')
      }

      const result = await response.json()
      return result.ticket

    } catch (error) {
      console.error('Reopen ticket error:', error)
      throw error
    }
  }

  // Validate ticket data
  static validateTicketData(data: CreateTicketData): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data.subject || data.subject.trim().length === 0) {
      errors.push('Subject is required')
    } else if (data.subject.length > 200) {
      errors.push('Subject must be 200 characters or less')
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Description is required')
    } else if (data.description.length < 10) {
      errors.push('Description must be at least 10 characters')
    } else if (data.description.length > 5000) {
      errors.push('Description must be 5000 characters or less')
    }

    if (!data.category) {
      errors.push('Category is required')
    }

    // Validate attachments
    if (data.attachments) {
      if (data.attachments.length > 5) {
        errors.push('Maximum 5 attachments allowed')
      }

      const maxSize = 10 * 1024 * 1024 // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']

      data.attachments.forEach((file, index) => {
        if (file.size > maxSize) {
          errors.push(`Attachment ${index + 1} exceeds 10MB limit`)
        }
        if (!allowedTypes.includes(file.type)) {
          errors.push(`Attachment ${index + 1} has unsupported file type`)
        }
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Get category display info
  static getCategoryInfo(category: SupportCategory): { label: string; description: string; icon: string } {
    const categoryMap = {
      TECHNICAL: { label: 'Technical Issue', description: 'Problems with the platform or features', icon: '🔧' },
      BILLING: { label: 'Billing & Payments', description: 'Payment issues, refunds, or billing questions', icon: '💳' },
      ACCOUNT: { label: 'Account Management', description: 'Profile, settings, or account access issues', icon: '👤' },
      SESSION: { label: 'Session Support', description: 'Issues with mentoring sessions', icon: '📹' },
      SAFETY: { label: 'Safety & Security', description: 'Report inappropriate behavior or safety concerns', icon: '🛡️' },
      FEATURE_REQUEST: { label: 'Feature Request', description: 'Suggest new features or improvements', icon: '💡' },
      BUG_REPORT: { label: 'Bug Report', description: 'Report bugs or unexpected behavior', icon: '🐛' },
      OTHER: { label: 'Other', description: 'General questions or other topics', icon: '❓' }
    }

    return categoryMap[category]
  }

  // Get priority display info
  static getPriorityInfo(priority: SupportPriority): { label: string; color: string; description: string } {
    const priorityMap = {
      LOW: { label: 'Low', color: 'text-gray-600', description: 'General questions, non-urgent issues' },
      MEDIUM: { label: 'Medium', color: 'text-blue-600', description: 'Standard issues affecting functionality' },
      HIGH: { label: 'High', color: 'text-orange-600', description: 'Important issues requiring prompt attention' },
      URGENT: { label: 'Urgent', color: 'text-red-600', description: 'Critical issues affecting service availability' }
    }

    return priorityMap[priority]
  }

  // Get status display info
  static getStatusInfo(status: SupportStatus): { label: string; color: string; description: string } {
    const statusMap = {
      OPEN: { label: 'Open', color: 'text-blue-600', description: 'Ticket is open and awaiting response' },
      IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-600', description: 'Ticket is being worked on' },
      WAITING_FOR_USER: { label: 'Waiting for User', color: 'text-purple-600', description: 'Waiting for user response' },
      RESOLVED: { label: 'Resolved', color: 'text-green-600', description: 'Issue has been resolved' },
      CLOSED: { label: 'Closed', color: 'text-gray-600', description: 'Ticket has been closed' }
    }

    return statusMap[status]
  }

  // Format response time
  static formatResponseTime(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)} minutes`
    } else if (minutes < 1440) {
      return `${Math.round(minutes / 60)} hours`
    } else {
      return `${Math.round(minutes / 1440)} days`
    }
  }

  // Calculate SLA status
  static calculateSLAStatus(ticket: SupportTicket): {
    status: 'met' | 'at_risk' | 'breached'
    timeRemaining: number
    slaTarget: number
  } {
    const slaTargets = {
      LOW: 48 * 60, // 48 hours in minutes
      MEDIUM: 24 * 60, // 24 hours
      HIGH: 8 * 60, // 8 hours
      URGENT: 2 * 60 // 2 hours
    }

    const target = slaTargets[ticket.priority]
    const elapsed = (new Date().getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60)
    const remaining = target - elapsed

    let status: 'met' | 'at_risk' | 'breached'
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      status = elapsed <= target ? 'met' : 'breached'
    } else if (remaining <= target * 0.2) { // 20% of time remaining
      status = 'at_risk'
    } else if (remaining <= 0) {
      status = 'breached'
    } else {
      status = 'met'
    }

    return {
      status,
      timeRemaining: Math.max(0, remaining),
      slaTarget: target
    }
  }
}

// Utility functions

export function createTicketData(
  subject: string,
  description: string,
  category: SupportCategory,
  priority: SupportPriority = 'MEDIUM',
  attachments?: File[]
): CreateTicketData {
  return {
    subject,
    description,
    category,
    priority,
    attachments
  }
}

export function formatTicketId(id: string): string {
  return `#${id.substring(0, 8).toUpperCase()}`
}

export function getTicketAge(createdAt: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(createdAt).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Less than 1 hour'
  if (diffHours < 24) return `${diffHours} hours`
  if (diffDays < 7) return `${diffDays} days`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`
  return `${Math.floor(diffDays / 30)} months`
}