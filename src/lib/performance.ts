import { lazy } from 'react'

// Lazy load components for better performance
export const LazyEarningsDashboard = lazy(() => import('@/components/earnings/earnings-dashboard'))
export const LazyMentorSearch = lazy(() => import('@/components/search/mentor-search'))
export const LazySessionBooking = lazy(() => import('@/components/booking/session-booking'))
export const LazyVideoCall = lazy(() => import('@/components/session/enhanced-video-call'))
export const LazyAdminDashboard = lazy(() => import('@/app/admin/page'))
export const LazyPlatformAnalytics = lazy(() => import('@/components/admin/platform-analytics'))

// Image optimization utilities
export const optimizeImageUrl = (url: string, width?: number, height?: number, quality = 75) => {
  if (!url) return '/placeholder-avatar.png'
  
  // For Next.js Image optimization
  const params = new URLSearchParams()
  if (width) params.set('w', width.toString())
  if (height) params.set('h', height.toString())
  params.set('q', quality.toString())
  
  return `${url}?${params.toString()}`
}

// Preload critical resources
export const preloadCriticalResources = () => {
  // Preload critical fonts
  const fontLink = document.createElement('link')
  fontLink.rel = 'preload'
  fontLink.href = '/fonts/inter-var.woff2'
  fontLink.as = 'font'
  fontLink.type = 'font/woff2'
  fontLink.crossOrigin = 'anonymous'
  document.head.appendChild(fontLink)
  
  // Preload critical images
  const avatarLink = document.createElement('link')
  avatarLink.rel = 'preload'
  avatarLink.href = '/placeholder-avatar.png'
  avatarLink.as = 'image'
  document.head.appendChild(avatarLink)
}

// Bundle size optimization
export const dynamicImport = (componentPath: string) => {
  return lazy(() => import(componentPath))
}

// Performance monitoring
export const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now()
  fn()
  const end = performance.now()
  console.log(`${name} took ${end - start} milliseconds`)
}

// Memory optimization
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
) => {
  if (typeof window === 'undefined') return null
  
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  })
}

// Virtual scrolling helper
export const calculateVisibleItems = (
  containerHeight: number,
  itemHeight: number,
  scrollTop: number,
  totalItems: number,
  overscan = 5
) => {
  const visibleStart = Math.floor(scrollTop / itemHeight)
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    totalItems - 1
  )
  
  return {
    start: Math.max(0, visibleStart - overscan),
    end: Math.min(totalItems - 1, visibleEnd + overscan),
  }
}

// Resource hints
export const addResourceHints = () => {
  // DNS prefetch for external resources
  const dnsPrefetch = (domain: string) => {
    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = domain
    document.head.appendChild(link)
  }
  
  // Preconnect to critical third-party domains
  const preconnect = (domain: string) => {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = domain
    document.head.appendChild(link)
  }
  
  // Add hints for common external resources
  dnsPrefetch('//fonts.googleapis.com')
  dnsPrefetch('//api.razorpay.com')
  preconnect('//fonts.gstatic.com')
}

// Service Worker registration
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.log('SW registered: ', registration)
    } catch (registrationError) {
      console.log('SW registration failed: ', registrationError)
    }
  }
}

// Critical CSS inlining helper
export const inlineCriticalCSS = (css: string) => {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}

// Web Vitals tracking
export const trackWebVitals = () => {
  if (typeof window !== 'undefined') {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.log)
      getFID(console.log)
      getFCP(console.log)
      getLCP(console.log)
      getTTFB(console.log)
    })
  }
}