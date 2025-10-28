import React from 'react'
import Button from './Button'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  primaryAction?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
      
      {(primaryAction || secondaryAction) && (
        <div className="empty-actions">
          {primaryAction && (
            <Button onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      <style jsx>{`
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-12);
          gap: var(--space-4);
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background-color: var(--panel-2);
          color: var(--text-muted);
          border-radius: var(--radius-2xl);
          margin-bottom: var(--space-2);
        }

        .empty-title {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .empty-description {
          font-size: var(--text-base);
          color: var(--text-muted);
          margin: 0;
          max-width: 400px;
        }

        .empty-actions {
          display: flex;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }

        @media (max-width: 767px) {
          .empty-actions {
            flex-direction: column;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
