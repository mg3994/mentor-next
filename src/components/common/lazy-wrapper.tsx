'use client'

import { Suspense, ComponentType, useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  className?: string
}

// Default loading fallback
const DefaultFallback = () => (
  <Card className="w-full">
    <CardContent className="flex items-center justify-center p-8">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-gray-600">Loading...</span>
      </div>
    </CardContent>
  </Card>
)

// Skeleton loading components
export const SkeletonCard = () => (
  <Card className="w-full">
    <CardContent className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-8 bg-gray-200 rounded w-full"></div>
      </div>
    </CardContent>
  </Card>
)

export const SkeletonTable = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 rounded w-full"></div>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex space-x-4">
        <div className="h-4 bg-gray-200 rounded flex-1"></div>
        <div className="h-4 bg-gray-200 rounded flex-1"></div>
        <div className="h-4 bg-gray-200 rounded flex-1"></div>
      </div>
    ))}
  </div>
)

export const SkeletonProfile = () => (
  <Card className="w-full">
    <CardContent className="p-6">
      <div className="animate-pulse">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    </CardContent>
  </Card>
)

// Main lazy wrapper component
export default function LazyWrapper({ 
  children, 
  fallback = <DefaultFallback />, 
  className 
}: LazyWrapperProps) {
  return (
    <div className={className}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </div>
  )
}

// HOC for lazy loading components
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function LazyComponent(props: P) {
    return (
      <LazyWrapper fallback={fallback}>
        <Component {...props} />
      </LazyWrapper>
    )
  }
}

// Intersection Observer based lazy loading
export function LazyOnVisible({ 
  children, 
  fallback = <DefaultFallback />,
  rootMargin = '50px',
  threshold = 0.1 
}: LazyWrapperProps & {
  rootMargin?: string
  threshold?: number
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref, rootMargin, threshold])

  return (
    <div ref={setRef}>
      {isVisible ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  )
}

// Image lazy loading component
interface LazyImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  placeholder?: string
}

export function LazyImage({ 
  src, 
  alt, 
  className, 
  width, 
  height, 
  placeholder = '/placeholder-image.png' 
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' }
    )

    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref])

  return (
    <div ref={setRef} className={className}>
      {isInView && (
        <img
          src={isLoaded ? src : placeholder}
          alt={alt}
          width={width}
          height={height}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-50'
          }`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  )
}