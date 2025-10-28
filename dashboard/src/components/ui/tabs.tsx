import React, { useState } from 'react'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onTabChange?: (tabId: string) => void
  variant?: 'underline' | 'pill'
  className?: string
}

export default function Tabs({
  tabs,
  defaultTab,
  onTabChange,
  variant = 'underline',
  className = ''
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onTabChange?.(tabId)
  }

  return (
    <div className={`tabs tabs-${variant} ${className}`}>
      <div className="tabs-list" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .tabs {
          width: 100%;
        }

        .tabs-list {
          display: flex;
          gap: var(--space-1);
          border-bottom: 1px solid var(--border);
        }

        .tabs-pill .tabs-list {
          background-color: var(--panel-2);
          border-radius: var(--radius-lg);
          padding: var(--space-1);
          border-bottom: none;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          position: relative;
          min-height: 44px;
        }

        .tabs-underline .tab {
          border-radius: 0;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          color: var(--text);
          background-color: var(--hover-bg);
        }

        .tabs-underline .tab:hover {
          background-color: transparent;
        }

        .tab.active {
          color: var(--brand-500);
        }

        [data-theme="dark"] .tab.active {
          color: var(--brand-400);
        }

        .tabs-underline .tab.active {
          border-bottom-color: var(--brand-500);
          background-color: transparent;
        }

        [data-theme="dark"] .tabs-underline .tab.active {
          border-bottom-color: var(--brand-400);
        }

        .tabs-pill .tab.active {
          background-color: var(--panel);
          box-shadow: var(--shadow-sm);
        }

        .tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tab-label {
          line-height: 1;
        }

        .tab:focus-visible {
          outline: 2px solid var(--focus-ring);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  )
}
