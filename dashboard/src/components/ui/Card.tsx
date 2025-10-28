import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {children}
      
      <style jsx>{`
        .card {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`}>
      {children}
      
      <style jsx>{`
        .card-header {
          padding: var(--space-6);
          border-bottom: 1px solid var(--border);
        }
      `}</style>
    </div>
  )
}

interface CardTitleProps {
  children: React.ReactNode
  className?: string
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`card-title ${className}`}>
      {children}
      
      <style jsx>{`
        .card-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }
      `}</style>
    </h3>
  )
}

interface CardDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`card-description ${className}`}>
      {children}
      
      <style jsx>{`
        .card-description {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: var(--space-1) 0 0 0;
        }
      `}</style>
    </p>
  )
}

interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`card-content ${className}`}>
      {children}
      
      <style jsx>{`
        .card-content {
          padding: var(--space-6);
        }
      `}</style>
    </div>
  )
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`card-footer ${className}`}>
      {children}
      
      <style jsx>{`
        .card-footer {
          padding: var(--space-6);
          border-top: 1px solid var(--border);
          background-color: var(--panel-2);
        }
      `}</style>
    </div>
  )
}

export default Card