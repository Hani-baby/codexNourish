import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  delta?: {
    value: number
    label: string
    trend: 'up' | 'down'
  }
  icon?: React.ReactNode
  tooltip?: string
}

export default function StatCard({ title, value, delta, icon, tooltip }: StatCardProps) {
  return (
    <div className="stat-card" title={tooltip}>
      <div className="stat-header">
        <div className="stat-title">{title}</div>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
      
      <div className="stat-value">{value}</div>
      
      {delta && (
        <div className={`stat-delta stat-delta-${delta.trend}`}>
          {delta.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{delta.value > 0 ? '+' : ''}{delta.value}% {delta.label}</span>
        </div>
      )}

      <style jsx>{`
        .stat-card {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-fast);
        }

        .stat-card:hover {
          box-shadow: var(--shadow-md);
        }

        .stat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-2);
        }

        .stat-title {
          font-size: var(--text-sm);
          color: var(--text-muted);
          font-weight: var(--font-medium);
        }

        .stat-icon {
          color: var(--icon);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-value {
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin-bottom: var(--space-2);
        }

        .stat-delta {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
        }

        .stat-delta-up {
          color: var(--brand-500);
        }

        [data-theme="dark"] .stat-delta-up {
          color: var(--brand-400);
        }

        .stat-delta-down {
          color: var(--danger);
        }
      `}</style>
    </div>
  )
}
