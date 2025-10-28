import React from 'react'

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function LoadingState({ 
  message = "Loading...", 
  size = 'md' 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className="loading-state">
      <div className={`loading-spinner ${sizeClasses[size]}`} />
      <span className={`loading-text ${textSizeClasses[size]}`}>{message}</span>
      
      <style jsx>{`
        .loading-state {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-muted);
        }

        .loading-spinner {
          border: 2px solid var(--border);
          border-top: 2px solid var(--brand-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-text {
          font-weight: var(--font-medium);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
