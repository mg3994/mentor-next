'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SupportService, SupportTicket, SupportStatus, SupportCategory, formatTicketId, getTicketAge } from '@/lib/support-service'

interface TicketListProps {
  onTicketSelect?: (ticket: SupportTicket) => void
  onCreateTicket?: () => void
}

export function TicketList({ onTicketSelect, onCreateTicket }: TicketListProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    status: '' as SupportStatus | '',
    category: '' as SupportCategory | ''
  })
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    hasMore: false,
    total: 0
  })

  const loadTickets = async (reset = false) => {
    try {
      setLoading(true)
      setError(null)

      const options = {
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        limit: pagination.limit,
        offset: reset ? 0 : pagination.offset
      }

      const result = await SupportService.getUserTickets(options)
      
      if (reset) {
        setTickets(result.tickets)
        setPagination(prev => ({
          ...prev,
          offset: 0,
          hasMore: result.tickets.length >= pagination.limit,
          total: result.total
        }))
      } else {
        setTickets(prev => [...prev, ...result.tickets])
        setPagination(prev => ({
          ...prev,
          offset: prev.offset + pagination.limit,
          hasMore: result.tickets.length >= pagination.limit,
          total: result.total
        }))
      }

    } catch (error) {
      console.error('Load tickets error:', error)
      setError(error instanceof Error ? error.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets(true)
  }, [filters])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || ''
    }))
  }

  const getStatusColor = (status: SupportStatus) => {
    const colors = {
      OPEN: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      WAITING_FOR_USER: 'bg-purple-100 text-purple-800',
      RESOLVED: 'bg-green-100 text-green-800',
      CLOSED: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'text-gray-600',
      MEDIUM: 'text-blue-600',
      HIGH: 'text-orange-600',
      URGENT: 'text-red-600'
    }
    return colors[priority] || 'text-gray-600'
  }

  const getCategoryIcon = (category: SupportCategory) => {
    const icons = {
      TECHNICAL: '🔧',
      BILLING: '💳',
      ACCOUNT: '👤',
      SESSION: '📹',
      SAFETY: '🛡️',
      FEATURE_REQUEST: '💡',
      BUG_REPORT: '🐛',
      OTHER: '❓'
    }
    return icons[category] || '❓'
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
          <p className="text-gray-600">
            {pagination.total > 0 ? `${pagination.total} ticket${pagination.total !== 1 ? 's' : ''}` : 'No tickets found'}
          </p>
        </div>
        
        {onCreateTicket && (
          <Button onClick={onCreateTicket}>
            Create New Ticket
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="WAITING_FOR_USER">Waiting for User</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            <SelectItem value="TECHNICAL">Technical Issue</SelectItem>
            <SelectItem value="BILLING">Billing & Payments</SelectItem>
            <SelectItem value="ACCOUNT">Account Management</SelectItem>
            <SelectItem value="SESSION">Session Support</SelectItem>
            <SelectItem value="SAFETY">Safety & Security</SelectItem>
            <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
            <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {tickets.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🎫</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No support tickets</h3>
          <p className="text-gray-600 mb-4">
            {filters.status || filters.category 
              ? 'No tickets match your current filters.' 
              : 'You haven\'t created any support tickets yet.'
            }
          </p>
          {onCreateTicket && (
            <Button onClick={onCreateTicket}>
              Create Your First Ticket
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onTicketSelect?.(ticket)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCategoryIcon(ticket.category)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                    <p className="text-sm text-gray-600">{formatTicketId(ticket.id)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(ticket.status)}>
                    {SupportService.getStatusInfo(ticket.status).label}
                  </Badge>
                  <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                    {SupportService.getPriorityInfo(ticket.priority).label}
                  </span>
                </div>
              </div>

              <p className="text-gray-700 mb-4 line-clamp-2">
                {ticket.description}
              </p>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span>Created {getTicketAge(ticket.createdAt)}</span>
                  {ticket.resolvedAt && (
                    <span>Resolved {getTicketAge(ticket.resolvedAt)}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {ticket.assignee && (
                    <span>Assigned to {ticket.assignee.name}</span>
                  )}
                  {ticket.messages && ticket.messages.length > 0 && (
                    <span>{ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {pagination.hasMore && (
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => loadTickets(false)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}