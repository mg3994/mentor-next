'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SupportService, SupportTicket, SupportMessage, formatTicketId, getTicketAge } from '@/lib/support-service'

interface TicketDetailProps {
  ticketId: string
  onBack?: () => void
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadTicket = async () => {
    try {
      setLoading(true)
      setError(null)

      const ticketData = await SupportService.getTicket(ticketId)
      setTicket(ticketData)
      setMessages(ticketData.messages || [])

    } catch (error) {
      console.error('Load ticket error:', error)
      setError(error instanceof Error ? error.message : 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTicket()
  }, [ticketId])

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim()) return

    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      const message = await SupportService.addMessage(ticketId, newMessage.trim(), attachments)

      setMessages(prev => [...prev, message])
      setNewMessage('')
      setAttachments([])
      setSuccess('Message sent successfully')

      // Update ticket status if needed
      if (ticket && ticket.status === 'WAITING_FOR_USER') {
        setTicket(prev => prev ? { ...prev, status: 'IN_PROGRESS' } : null)
      }

    } catch (error) {
      console.error('Send message error:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleCloseTicket = async () => {
    if (!ticket) return

    try {
      const updatedTicket = await SupportService.closeTicket(ticketId, 'Closed by user')
      setTicket(updatedTicket)
      setSuccess('Ticket closed successfully')
    } catch (error) {
      console.error('Close ticket error:', error)
      setError(error instanceof Error ? error.message : 'Failed to close ticket')
    }
  }

  const handleReopenTicket = async () => {
    if (!ticket) return

    try {
      const updatedTicket = await SupportService.reopenTicket(ticketId, 'Reopened by user')
      setTicket(updatedTicket)
      setSuccess('Ticket reopened successfully')
    } catch (error) {
      console.error('Reopen ticket error:', error)
      setError(error instanceof Error ? error.message : 'Failed to reopen ticket')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files].slice(0, 5)) // Max 5 files
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
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

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ticket...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">❌</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket not found</h3>
        <p className="text-gray-600 mb-4">The requested support ticket could not be found.</p>
        {onBack && (
          <Button onClick={onBack}>
            Back to Tickets
          </Button>
        )}
      </div>
    )
  }

  const canSendMessages = ticket.status !== 'CLOSED'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                ← Back
              </Button>
            )}
            <span className="text-2xl">{getCategoryIcon(ticket.category)}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
              <p className="text-gray-600">{formatTicketId(ticket.id)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(ticket.status)}>
              {SupportService.getStatusInfo(ticket.status).label}
            </Badge>
            <span className={`font-medium ${getPriorityColor(ticket.priority)}`}>
              {SupportService.getPriorityInfo(ticket.priority).label} Priority
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Category:</span> {SupportService.getCategoryInfo(ticket.category).label}
          </div>
          <div>
            <span className="font-medium">Created:</span> {getTicketAge(ticket.createdAt)}
          </div>
          {ticket.resolvedAt && (
            <div>
              <span className="font-medium">Resolved:</span> {getTicketAge(ticket.resolvedAt)}
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-800">{ticket.description}</p>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          {ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' ? (
            <Button variant="outline" onClick={handleReopenTicket}>
              Reopen Ticket
            </Button>
          ) : (
            <Button variant="outline" onClick={handleCloseTicket}>
              Close Ticket
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Messages ({messages.length})</h2>
        </div>

        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages yet</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isStaff ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.isStaff
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-blue-600 text-white'
                    }`}
                >
                  <p className="text-sm">{message.message}</p>
                  <p className={`text-xs mt-1 ${message.isStaff ? 'text-gray-500' : 'text-blue-100'}`}>
                    {message.isStaff ? 'Support Team' : 'You'} • {getTicketAge(message.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        {canSendMessages && (
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
            <div className="space-y-4">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                maxLength={5000}
                disabled={sending}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.txt"
                    className="text-sm text-gray-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    disabled={sending}
                  />
                  <span className="text-xs text-gray-500">
                    {newMessage.length}/5000
                  </span>
                </div>

                <Button type="submit" disabled={!newMessage.trim() || sending}>
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                      <span className="text-gray-700">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="text-red-600 hover:text-red-800 h-6 px-2"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}