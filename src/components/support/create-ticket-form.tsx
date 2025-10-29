'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SupportService, SupportCategory, SupportPriority } from '@/lib/support-service'

interface CreateTicketFormProps {
  onTicketCreated?: (ticket: any) => void
  onCancel?: () => void
}

export function CreateTicketForm({ onTicketCreated, onCancel }: CreateTicketFormProps) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: '' as SupportCategory | '',
    priority: 'MEDIUM' as SupportPriority
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const categories: { value: SupportCategory; label: string; description: string }[] = [
    { value: 'TECHNICAL', label: 'Technical Issue', description: 'Problems with the platform or features' },
    { value: 'BILLING', label: 'Billing & Payments', description: 'Payment issues, refunds, or billing questions' },
    { value: 'ACCOUNT', label: 'Account Management', description: 'Profile, settings, or account access issues' },
    { value: 'SESSION', label: 'Session Support', description: 'Issues with mentoring sessions' },
    { value: 'SAFETY', label: 'Safety & Security', description: 'Report inappropriate behavior or safety concerns' },
    { value: 'FEATURE_REQUEST', label: 'Feature Request', description: 'Suggest new features or improvements' },
    { value: 'BUG_REPORT', label: 'Bug Report', description: 'Report bugs or unexpected behavior' },
    { value: 'OTHER', label: 'Other', description: 'General questions or other topics' }
  ]

  const priorities: { value: SupportPriority; label: string; description: string }[] = [
    { value: 'LOW', label: 'Low', description: 'General questions, non-urgent issues' },
    { value: 'MEDIUM', label: 'Medium', description: 'Standard issues affecting functionality' },
    { value: 'HIGH', label: 'High', description: 'Important issues requiring prompt attention' },
    { value: 'URGENT', label: 'Urgent', description: 'Critical issues affecting service availability' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.category) {
      setError('Please select a category')
      return
    }

    // Validate form data
    const validation = SupportService.validateTicketData({
      subject: formData.subject,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      attachments
    })

    if (!validation.isValid) {
      setError(validation.errors.join(', '))
      return
    }

    setIsSubmitting(true)

    try {
      const ticket = await SupportService.createTicket({
        subject: formData.subject,
        description: formData.description,
        category: formData.category,
        priority: formData.priority,
        attachments
      })

      setSuccess('Support ticket created successfully!')
      
      // Reset form
      setFormData({
        subject: '',
        description: '',
        category: '' as SupportCategory | '',
        priority: 'MEDIUM'
      })
      setAttachments([])

      if (onTicketCreated) {
        onTicketCreated(ticket)
      }

    } catch (error) {
      console.error('Create ticket error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create support ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments(prev => [...prev, ...files].slice(0, 5)) // Max 5 files
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Support Ticket</h2>
        <p className="text-gray-600">
          Describe your issue and we'll help you resolve it as quickly as possible.
        </p>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
            Subject *
          </label>
          <Input
            id="subject"
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Brief description of your issue"
            maxLength={200}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.subject.length}/200 characters
          </p>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
            Category *
          </label>
          <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as SupportCategory }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  <div>
                    <div className="font-medium">{category.label}</div>
                    <div className="text-xs text-gray-500">{category.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
            Priority
          </label>
          <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as SupportPriority }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  <div>
                    <div className="font-medium">{priority.label}</div>
                    <div className="text-xs text-gray-500">{priority.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Please provide detailed information about your issue..."
            rows={6}
            maxLength={5000}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.description.length}/5000 characters
          </p>
        </div>

        <div>
          <label htmlFor="attachments" className="block text-sm font-medium text-gray-700 mb-2">
            Attachments (Optional)
          </label>
          <input
            id="attachments"
            type="file"
            multiple
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.gif,.pdf,.txt"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            Max 5 files, 10MB each. Supported: JPG, PNG, GIF, PDF, TXT
          </p>
          
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Creating Ticket...' : 'Create Ticket'}
          </Button>
          
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}