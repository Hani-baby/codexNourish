import React, { useState, useEffect } from 'react'

interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  distance?: number
  duration?: number
  easing?: string
}

export default function AnimatedCard({ 
  children, 
  className = '',
  delay = 0,
  direction = 'up',
  distance = 30,
  duration = 0.6,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)'
}: AnimatedCardProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  const getTransform = () => {
    if (isVisible) return 'translate3d(0, 0, 0)'
    
    switch (direction) {
      case 'up':
        return `translate3d(0, ${distance}px, 0)`
      case 'down':
        return `translate3d(0, -${distance}px, 0)`
      case 'left':
        return `translate3d(${distance}px, 0, 0)`
      case 'right':
        return `translate3d(-${distance}px, 0, 0)`
      default:
        return `translate3d(0, ${distance}px, 0)`
    }
  }

  return (
    <div className={`animated-card ${className}`}>
      {children}
      
      <style jsx>{`
        .animated-card {
          transform: ${getTransform()};
          opacity: ${isVisible ? 1 : 0};
          transition: transform ${duration}s ${easing}, opacity ${duration}s ${easing};
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}

// Enhanced version with intersection observer for performance
export function AnimatedCardOnScroll({ 
  children, 
  className = '',
  delay = 0,
  direction = 'up',
  distance = 30,
  duration = 0.6,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  threshold = 0.1
}: AnimatedCardProps & { threshold?: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const [elementRef, setElementRef] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!elementRef) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true)
          }, delay)
          observer.unobserve(elementRef)
        }
      },
      { threshold }
    )

    observer.observe(elementRef)

    return () => observer.disconnect()
  }, [elementRef, delay, threshold])

  const getTransform = () => {
    if (isVisible) return 'translate3d(0, 0, 0)'
    
    switch (direction) {
      case 'up':
        return `translate3d(0, ${distance}px, 0)`
      case 'down':
        return `translate3d(0, -${distance}px, 0)`
      case 'left':
        return `translate3d(${distance}px, 0, 0)`
      case 'right':
        return `translate3d(-${distance}px, 0, 0)`
      default:
        return `translate3d(0, ${distance}px, 0)`
    }
  }

  return (
    <div 
      ref={setElementRef}
      className={`animated-card-scroll ${className}`}
    >
      {children}
      
      <style jsx>{`
        .animated-card-scroll {
          transform: ${getTransform()};
          opacity: ${isVisible ? 1 : 0};
          transition: transform ${duration}s ${easing}, opacity ${duration}s ${easing};
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}

// Utility function to create staggered animations
export function createStaggeredDelay(index: number, baseDelay: number = 0, increment: number = 100): number {
  return baseDelay + (index * increment)
}
