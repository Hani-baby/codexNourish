import React from 'react'

interface PageLayoutProps {
  children: React.ReactNode
  title: string
  subtitle: string
}

export default function PageLayout({ children, title, subtitle }: PageLayoutProps) {
  return (
    <div className="page-layout">
      {children}
      
      <style jsx>{`
        .page-layout {
          width: 100%;
        }
      `}</style>
    </div>
  )
}

// Hook to set page title in the topbar
export function usePageTitle(title: string, subtitle: string) {
  React.useEffect(() => {
    // This will be handled by the routing system
    // For now, we'll modify the approach to be simpler
  }, [title, subtitle])
}
