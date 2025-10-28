import React from 'react'
import Button from '../ui/Button'

export type PageHeaderAction = {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'ghost' | 'danger' | 'subtle'
  disabled?: boolean
}

export type PageHeaderTab = {
  id: string
  label: string
  icon?: React.ReactNode
  count?: number
}

interface PageHeaderProps {
  title: string
  description?: string
  badge?: { label: string; tone?: 'brand' | 'success' | 'warning' | 'danger' }
  primaryAction?: PageHeaderAction
  secondaryActions?: PageHeaderAction[]
  tabs?: PageHeaderTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  children?: React.ReactNode
}

export default function PageHeader({
  title,
  description,
  badge,
  primaryAction,
  secondaryActions = [],
  tabs,
  activeTab,
  onTabChange,
  children,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="header-main">
        <div className="title-block">
          <div className="title-row">
            <h1>{title}</h1>
            {badge && <span className={`badge badge-${badge.tone || 'brand'}`}>{badge.label}</span>}
          </div>
          {description && <p>{description}</p>}
        </div>

        {(primaryAction || secondaryActions.length > 0) && (
          <div className="actions">
            {secondaryActions.map(action => (
              <Button
                key={action.label}
                variant={action.variant || 'ghost'}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                leftIcon={action.icon}
              >
                {action.label}
              </Button>
            ))}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'solid'}
                size="sm"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                leftIcon={primaryAction.icon}
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>

      {children && <div className="header-content">{children}</div>}

      {tabs && tabs.length > 0 && (
        <div className="header-tabs" role="tablist">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`header-tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                <span className="tab-label">{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="tab-count">{tab.count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .page-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .header-main {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .title-block {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        h1 {
          font-size: clamp(24px, 3vw, 32px);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        p {
          margin: 0;
          color: var(--text-muted);
          font-size: var(--text-base);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          padding: 4px 10px;
          border-radius: 999px;
          letter-spacing: 0.02em;
        }

        .badge-brand {
          background: var(--brand-100);
          color: var(--brand-700);
        }

        .badge-success {
          background: rgba(34, 197, 94, 0.12);
          color: #16a34a;
        }

        .badge-warning {
          background: rgba(250, 204, 21, 0.12);
          color: #ca8a04;
        }

        .badge-danger {
          background: rgba(248, 113, 113, 0.15);
          color: #dc2626;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-2);
        }

        .header-content {
          display: grid;
          gap: var(--space-4);
        }

        .header-tabs {
          display: inline-flex;
          align-items: center;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          padding: 4px;
          width: fit-content;
        }

        .header-tab {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 8px 14px;
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          color: var(--text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .header-tab:hover {
          color: var(--text);
          background: var(--hover-bg);
        }

        .header-tab.active {
          background: var(--brand-500);
          color: white;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .tab-icon,
        .tab-label {
          display: inline-flex;
          align-items: center;
        }

        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          font-size: 12px;
          font-weight: var(--font-medium);
        }

        @media (max-width: 767px) {
          .page-header {
            gap: var(--space-3);
            margin-bottom: var(--space-4);
          }

          .header-main {
            flex-direction: column;
            align-items: flex-start;
          }

          .actions {
            width: 100%;
          }

          .header-tabs {
            width: 100%;
            justify-content: space-between;
          }

          .header-tab {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
