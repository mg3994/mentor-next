// Session Notes Service
// Handles collaborative note-taking functionality

export interface SessionNote {
  id: string
  sessionId: string
  content: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface NotesConfig {
  sessionId: string
  userId: string
  autoSave?: boolean
  autoSaveDelay?: number
}

export class NotesService {
  private config: NotesConfig
  private autoSaveTimeout: NodeJS.Timeout | null = null
  
  // Event callbacks
  public onNoteSaved?: (note: SessionNote) => void
  public onNoteError?: (error: string) => void
  public onNotesLoaded?: (notes: SessionNote[]) => void

  constructor(config: NotesConfig) {
    this.config = {
      autoSave: true,
      autoSaveDelay: 2000, // 2 seconds
      ...config,
    }
  }

  // Load all session notes
  async loadNotes(): Promise<SessionNote[]> {
    try {
      const response = await fetch(`/api/sessions/notes?sessionId=${this.config.sessionId}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to load notes')
      }
      
      const data = await response.json()
      const notes = data.notes || []
      
      this.onNotesLoaded?.(notes)
      return notes
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load notes'
      this.onNoteError?.(errorMessage)
      throw error
    }
  }

  // Save or update a note
  async saveNote(content: string): Promise<SessionNote> {
    try {
      if (!content.trim()) {
        throw new Error('Note content cannot be empty')
      }

      const response = await fetch('/api/sessions/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          content: content.trim(),
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to save note')
      }
      
      const data = await response.json()
      const note = data.note
      
      this.onNoteSaved?.(note)
      return note
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note'
      this.onNoteError?.(errorMessage)
      throw error
    }
  }

  // Update a specific note
  async updateNote(noteId: string, content: string): Promise<SessionNote> {
    try {
      if (!content.trim()) {
        throw new Error('Note content cannot be empty')
      }

      const response = await fetch(`/api/sessions/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update note')
      }
      
      const data = await response.json()
      const note = data.note
      
      this.onNoteSaved?.(note)
      return note
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update note'
      this.onNoteError?.(errorMessage)
      throw error
    }
  }

  // Delete a note
  async deleteNote(noteId: string): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/notes/${noteId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete note')
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete note'
      this.onNoteError?.(errorMessage)
      throw error
    }
  }

  // Auto-save functionality
  scheduleAutoSave(content: string): void {
    if (!this.config.autoSave || !content.trim()) return

    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
    }

    // Schedule new auto-save
    this.autoSaveTimeout = setTimeout(() => {
      this.saveNote(content).catch(error => {
        console.error('Auto-save failed:', error)
      })
    }, this.config.autoSaveDelay)
  }

  // Cancel pending auto-save
  cancelAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
      this.autoSaveTimeout = null
    }
  }

  // Export notes as text
  exportNotes(notes: SessionNote[]): string {
    if (notes.length === 0) return ''

    const sortedNotes = notes.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return sortedNotes
      .map(note => {
        const date = new Date(note.createdAt).toLocaleString()
        const updatedText = note.updatedAt !== note.createdAt 
          ? ` (Updated: ${new Date(note.updatedAt).toLocaleString()})`
          : ''
        
        return `=== Note from ${date}${updatedText} ===\n${note.content}\n\n`
      })
      .join('')
  }

  // Download notes as file
  downloadNotes(notes: SessionNote[], filename?: string): void {
    const content = this.exportNotes(notes)
    if (!content) return

    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    
    a.href = url
    a.download = filename || `session-notes-${this.config.sessionId}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Get note statistics
  getNotesStats(notes: SessionNote[]): {
    totalNotes: number
    totalCharacters: number
    totalWords: number
    lastUpdated: Date | null
    contributors: string[]
  } {
    if (notes.length === 0) {
      return {
        totalNotes: 0,
        totalCharacters: 0,
        totalWords: 0,
        lastUpdated: null,
        contributors: [],
      }
    }

    const totalCharacters = notes.reduce((sum, note) => sum + note.content.length, 0)
    const totalWords = notes.reduce((sum, note) => {
      const words = note.content.trim().split(/\s+/).filter(word => word.length > 0)
      return sum + words.length
    }, 0)

    const lastUpdated = notes.reduce((latest, note) => {
      const noteDate = new Date(note.updatedAt)
      return !latest || noteDate > latest ? noteDate : latest
    }, null as Date | null)

    const contributors = [...new Set(notes.map(note => note.createdBy))]

    return {
      totalNotes: notes.length,
      totalCharacters,
      totalWords,
      lastUpdated,
      contributors,
    }
  }

  // Cleanup resources
  cleanup(): void {
    this.cancelAutoSave()
    this.onNoteSaved = undefined
    this.onNoteError = undefined
    this.onNotesLoaded = undefined
  }
}

// Utility functions

export function createNotesService(sessionId: string, userId: string, options?: Partial<NotesConfig>): NotesService {
  return new NotesService({
    sessionId,
    userId,
    ...options,
  })
}

export function formatNotePreview(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength).trim() + '...'
}

export function validateNoteContent(content: string): { isValid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: 'Content is required' }
  }

  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Content cannot be empty' }
  }

  if (trimmed.length > 10000) {
    return { isValid: false, error: 'Content is too long (maximum 10,000 characters)' }
  }

  return { isValid: true }
}

export function searchNotes(notes: SessionNote[], query: string): SessionNote[] {
  if (!query.trim()) return notes

  const searchTerm = query.toLowerCase()
  return notes.filter(note => 
    note.content.toLowerCase().includes(searchTerm)
  )
}

export function groupNotesByDate(notes: SessionNote[]): Record<string, SessionNote[]> {
  const groups: Record<string, SessionNote[]> = {}
  
  notes.forEach(note => {
    const date = new Date(note.createdAt).toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(note)
  })

  return groups
}