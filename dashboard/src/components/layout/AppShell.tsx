import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useMediaQuery } from '../../lib/hooks'

interface AppShellProps {
  children: React.ReactNode
  pageTitle?: string
  pageSubtitle?: string
}

export default function AppShell({ children, pageTitle, pageSubtitle }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1280px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1279px)')

  return (
    <div className="app-shell">
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        variant={isDesktop ? 'expanded' : isTablet ? 'collapsed' : 'mobile'}
      />
      
      <div className="main-content">
        <Topbar 
          onMenuClick={() => setSidebarOpen(true)} 
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
        />
        
        <main className="content">
          <div className="content-container">
            {children}
          </div>
        </main>
      </div>

      <style jsx>{`
        .app-shell {
          display: flex;
          height: 100vh;
          background-color: var(--bg);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
        }

        .content-container {
          max-width: var(--max-content-width);
          margin: 0 auto;
          width: 100%;
        }

        @media (max-width: 767px) {
          .content {
            padding: var(--space-4);
          }
        }
      `}</style>
    </div>
  )
}
