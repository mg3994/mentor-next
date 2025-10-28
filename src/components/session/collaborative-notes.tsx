'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  FileText, 
  Save, 
  Download, 
  Users,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface SessionNote {
  id: string
  sessionId: string
  content: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

interface CollaborativeNotesProps {
  sessionId: string
  userId: string
  userName: string
  isReadOnly?: boolean
}

export default function CollaborativeNotes({ 
  sessionId, 
  userId, 
  userName,
  isReadOnly = false 
}: CollaborativeNotesProps) {
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [currentNote, setCurrentNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadNotes()
  }, [sessionId])

  useEffect(() => {
    // Auto-save functionality
    if (autoSaveEnabled && currentNote.trim() && !isReadOnly) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveNote()
      }, 2000) // Auto-save after 2 seconds of inactivity
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [currentNote, autoSaveEnabled, isReadOnly])

  const loadNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/sessions/notes?sessionId=${sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load notes')
      }
      
      const data = await response.json()
      setNotes(data.notes || [])
      
      // Load the most recent note content for editing
      if (data.notes && data.notes.length > 0) {
        setCurrentNote(data.notes[0].content)
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const saveNote = async () => {
    if (!currentNote.trim() || isReadOnly) return

    try {
      setSaving(true)
      setError(null)
      
      const response = await fetch('/api/sessions/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          content: currentNote.trim(),
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save note')
      }
      
      const data = await response.json()
      
      // Update notes list
      setNotes(prev => [data.note, ...prev.filter(n => n.id !== data.note.id)])
      setLastSaved(new Date())
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const handleNoteChange = (value: string) => {
    setCurrentNote(value)
  }

  const handleManualSave = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    saveNote()
  }

  const downloadNotes = () => {
    if (notes.length === 0) return

    const notesContent = notes
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(note => {
        const date = new Date(note.createdAt).toLocaleString()
        return `=== Note from ${date} ===\n${note.content}\n\n`
      })
      .join('')

    const blob = new Blob([notesContent], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session-notes-${sessionId}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return new Date(date).toLocaleDateString()
  }

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Session Notes</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading notes...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Session Notes</span>
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          
          <div className="flex items-center space-x-2">
            {notes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadNotes}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
            
            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSave}
                disabled={saving || !currentNote.trim()}
                className="h-8"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Current Note Editor */}
        {!isReadOnly && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Collaborative Notes</span>
              <div className="flex items-center space-x-2">
                {lastSaved && (
                  <div className="flex items-center space-x-1 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>Saved {formatTimeAgo(lastSaved)}</span>
                  </div>
                )}
                {saving && (
                  <div className="flex items-center space-x-1 text-xs text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
              </div>
            </div>
            
            <Textarea
              ref={textareaRef}
              value={currentNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Start taking notes... Changes are automatically saved."
              className="min-h-[200px] resize-none"
              disabled={saving}
            />
            
            <div className="text-xs text-gray-500">
              Auto-save enabled • Changes saved automatically after 2 seconds
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Notes History */}
        <div className="flex-1 overflow-y-auto space-y-3">
          <h4 className="font-medium text-gray-900 text-sm">Notes History</h4>
          
          {notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No notes yet</p>
              <p className="text-sm">Start taking notes to collaborate with your session partner</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-600">
                      {new Date(note.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600">
                      {note.createdBy === userId ? 'You' : 'Partner'}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">
                    {note.content}
                  </div>
                  
                  {note.updatedAt !== note.createdAt && (
                    <div className="text-xs text-gray-500 mt-2">
                      Last edited: {new Date(note.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Guidelines */}
        <div className="text-xs text-gray-500 space-y-1 border-t pt-3">
          <p>• Notes are shared between all session participants</p>
          <p>• Changes are automatically saved every 2 seconds</p>
          <p>• Export notes to download a complete session summary</p>
          <p>• Notes are preserved for future reference</p>
        </div>
      </CardContent>
    </Card>
  )
}