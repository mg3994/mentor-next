// Accessibility utilities for the mentor platform

// ARIA label generators
export const generateAriaLabel = {
  button: (action: string, context?: string) => 
    context ? `${action} ${context}` : action,
  
  link: (destination: string, context?: string) => 
    context ? `Go to ${destination} ${context}` : `Go to ${destination}`,
  
  input: (fieldName: string, required = false) => 
    `${fieldName}${required ? ' (required)' : ''}`,
  
  status: (status: string, context?: string) => 
    context ? `${context} status: ${status}` : `Status: ${status}`,
  
  progress: (current: number, total: number, context?: string) => 
    context ? `${context}: ${current} of ${total}` : `${current} of ${total}`,
}

// Screen reader announcements
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  if (typeof window === 'undefined') return
  
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message
  
  document.body.appendChild(announcement)
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

// Focus management
export const focusManagement = {
  // Trap focus within a container
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }
    
    container.addEventListener('keydown', handleTabKey)
    firstElement?.focus()
    
    return () => container.removeEventListener('keydown', handleTabKey)
  },
  
  // Return focus to previous element
  returnFocus: (previousElement: HTMLElement | null) => {
    if (previousElement) {
      previousElement.focus()
    }
  },
  
  // Focus first error in form
  focusFirstError: (formElement: HTMLElement) => {
    const firstError = formElement.querySelector('[aria-invalid="true"]') as HTMLElement
    if (firstError) {
      firstError.focus()
      announceToScreenReader('Please correct the errors in the form', 'assertive')
    }
  }
}

// Keyboard navigation helpers
export const keyboardNavigation = {
  // Handle arrow key navigation in lists
  handleArrowKeys: (
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onIndexChange: (index: number) => void
  ) => {
    let newIndex = currentIndex
    
    switch (event.key) {
      case 'ArrowDown':
        newIndex = Math.min(currentIndex + 1, items.length - 1)
        break
      case 'ArrowUp':
        newIndex = Math.max(currentIndex - 1, 0)
        break
      case 'Home':
        newIndex = 0
        break
      case 'End':
        newIndex = items.length - 1
        break
      default:
        return
    }
    
    event.preventDefault()
    onIndexChange(newIndex)
    items[newIndex]?.focus()
  },
  
  // Handle escape key
  handleEscape: (callback: () => void) => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }
}

// Color contrast utilities
export const colorContrast = {
  // Check if color combination meets WCAG AA standards
  meetsWCAGAA: (foreground: string, background: string): boolean => {
    // This is a simplified check - in production, use a proper contrast ratio library
    const getLuminance = (color: string): number => {
      // Convert hex to RGB and calculate luminance
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255
      const g = parseInt(hex.substr(2, 2), 16) / 255
      const b = parseInt(hex.substr(4, 2), 16) / 255
      
      const [rs, gs, bs] = [r, g, b].map(c => 
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      )
      
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
    }
    
    const l1 = getLuminance(foreground)
    const l2 = getLuminance(background)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    
    return ratio >= 4.5 // WCAG AA standard
  }
}

// Form accessibility helpers
export const formAccessibility = {
  // Generate form field IDs and associate labels
  generateFieldId: (fieldName: string, formId?: string) => 
    formId ? `${formId}-${fieldName}` : `field-${fieldName}`,
  
  // Create error message associations
  associateErrorMessage: (fieldId: string, errorId: string) => ({
    'aria-describedby': errorId,
    'aria-invalid': 'true'
  }),
  
  // Generate help text associations
  associateHelpText: (fieldId: string, helpId: string) => ({
    'aria-describedby': helpId
  })
}

// Modal accessibility
export const modalAccessibility = {
  // Set up modal with proper ARIA attributes
  setupModal: (modalElement: HTMLElement, titleId: string, descriptionId?: string) => {
    modalElement.setAttribute('role', 'dialog')
    modalElement.setAttribute('aria-modal', 'true')
    modalElement.setAttribute('aria-labelledby', titleId)
    if (descriptionId) {
      modalElement.setAttribute('aria-describedby', descriptionId)
    }
  },
  
  // Handle modal open/close
  handleModalToggle: (isOpen: boolean, modalElement: HTMLElement, triggerElement?: HTMLElement) => {
    if (isOpen) {
      // Store current focus
      const previousFocus = document.activeElement as HTMLElement
      
      // Trap focus and focus first element
      const cleanup = focusManagement.trapFocus(modalElement)
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      
      return () => {
        cleanup()
        document.body.style.overflow = ''
        focusManagement.returnFocus(triggerElement || previousFocus)
      }
    }
  }
}

// Table accessibility
export const tableAccessibility = {
  // Generate table headers with proper scope
  generateTableHeaders: (headers: string[]) => 
    headers.map(header => ({
      scope: 'col' as const,
      children: header
    })),
  
  // Generate row headers
  generateRowHeader: (content: string) => ({
    scope: 'row' as const,
    children: content
  }),
  
  // Add table caption
  addTableCaption: (caption: string) => ({
    children: caption,
    className: 'sr-only'
  })
}

// Skip links
export const skipLinks = {
  // Create skip to main content link
  createSkipLink: (targetId: string, text = 'Skip to main content') => ({
    href: `#${targetId}`,
    className: 'sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-2 z-50',
    children: text
  })
}

// Reduced motion preferences
export const respectsReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// High contrast mode detection
export const detectHighContrastMode = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

// Screen reader detection (basic)
export const detectScreenReader = () => {
  if (typeof navigator === 'undefined') return false
  return navigator.userAgent.includes('NVDA') || 
         navigator.userAgent.includes('JAWS') || 
         navigator.userAgent.includes('VoiceOver')
}

// Accessibility testing helpers
export const a11yTesting = {
  // Check for missing alt text
  checkMissingAltText: () => {
    const images = document.querySelectorAll('img:not([alt])')
    if (images.length > 0) {
      console.warn(`Found ${images.length} images without alt text:`, images)
    }
  },
  
  // Check for missing form labels
  checkMissingFormLabels: () => {
    const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])')
    const unlabeled = Array.from(inputs).filter(input => {
      const id = input.getAttribute('id')
      return !id || !document.querySelector(`label[for="${id}"]`)
    })
    
    if (unlabeled.length > 0) {
      console.warn(`Found ${unlabeled.length} form inputs without labels:`, unlabeled)
    }
  },
  
  // Check color contrast (basic)
  checkColorContrast: () => {
    // This would require a more sophisticated implementation
    console.log('Color contrast checking would require additional libraries')
  }
}