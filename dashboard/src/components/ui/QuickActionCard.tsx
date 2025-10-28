import React from 'react'

interface QuickActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  onClick?: () => void
  className?: string
}

export default function QuickActionCard({
  icon,
  title,
  description,
  action,
  onClick,
  className = ''
}: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`quick-action-card ${className}`}
    >
      <div className="action-icon">{icon}</div>
      <div className="action-content">
        <h3 className="action-title">{title}</h3>
        <p className="action-description">{description}</p>
        <span className="action-cta">{action}</span>
      </div>

      <style jsx>{`
        .quick-action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-6);
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-fast);
          cursor: pointer;
          text-align: center;
          width: 100%;
        }

        .quick-action-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--brand-500);
        }

        [data-theme="dark"] .quick-action-card:hover {
          box-shadow: 0 0 0 1px var(--brand-900);
        }

        .action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background-color: var(--brand-100);
          color: var(--brand-500);
          border-radius: var(--radius-lg);
        }

        [data-theme="dark"] .action-icon {
          background-color: var(--brand-100);
          color: var(--brand-400);
        }

        .action-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .action-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .action-description {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .action-cta {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--brand-500);
        }

        [data-theme="dark"] .action-cta {
          color: var(--brand-400);
        }

        .quick-action-card:focus-visible {
          outline: 2px solid var(--focus-ring);
          outline-offset: 2px;
        }
      `}</style>
    </button>
  )
}
