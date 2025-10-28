import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'brand' | 'info' | 'success' | 'danger' | 'neutral'
  size?: 'xs' | 'sm'
  icon?: React.ReactNode
  className?: string
}

export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  className = ''
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} badge-${size} ${className}`}>
      {icon && <span className="badge-icon">{icon}</span>}
      <span className="badge-text">{children}</span>

      <style jsx>{`
        .badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-weight: var(--font-medium);
          border-radius: var(--radius-md);
          white-space: nowrap;
        }

        .badge-xs {
          padding: var(--space-1) var(--space-2);
          font-size: var(--text-xs);
        }

        .badge-sm {
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-xs);
        }

        .badge-brand {
          background-color: var(--brand-100);
          color: var(--brand-500);
        }

        .badge-info {
          background-color: rgba(59, 130, 246, 0.1);
          color: var(--info);
        }

        .badge-success {
          background-color: rgba(16, 185, 129, 0.1);
          color: var(--success);
        }

        .badge-danger {
          background-color: rgba(225, 77, 77, 0.1);
          color: var(--danger);
        }

        .badge-neutral {
          background-color: var(--panel-2);
          color: var(--text-muted);
        }

        [data-theme="dark"] .badge-brand {
          background-color: var(--brand-100);
          color: var(--brand-400);
        }

        .badge-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .badge-text {
          line-height: 1;
        }
      `}</style>
    </span>
  )
}
