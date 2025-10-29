'use client'

import { useState } from 'react'
import { CreateTicketForm } from '@/components/support/create-ticket-form'
import { TicketList } from '@/components/support/ticket-list'
import { TicketDetail } from '@/components/support/ticket-detail'
import { SupportTicket } from '@/lib/support-service'

type View = 'list' | 'create' | 'detail'

export default function SupportPage() {
  const [currentView, setCurrentView] = useState<View>('list')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

  const handleTicketCreated = (ticket: SupportTicket) => {
    setSelectedTicketId(ticket.id)
    setCurrentView('detail')
  }

  const handleTicketSelect = (ticket: SupportTicket) => {
    setSelectedTicketId(ticket.id)
    setCurrentView('detail')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setSelectedTicketId(null)
  }

  const handleCreateTicket = () => {
    setCurrentView('create')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'list' && (
          <TicketList
            onTicketSelect={handleTicketSelect}
            onCreateTicket={handleCreateTicket}
          />
        )}

        {currentView === 'create' && (
          <CreateTicketForm
            onTicketCreated={handleTicketCreated}
            onCancel={handleBackToList}
          />
        )}

        {currentView === 'detail' && selectedTicketId && (
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={handleBackToList}
          />
        )}
      </div>
    </div>
  )
}