/**
 * Boot Error Fallback Component
 * Shows when auth boot fails with retry options
 */

import React from 'react'
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import Button from './Button'
import { Card, CardContent } from './Card'

interface BootErrorFallbackProps {
  error?: Error | null
  bootTimeMs?: number
  onRetry: () => void
  onContinueOffline?: () => void
}

export default function BootErrorFallback({ 
  error, 
  bootTimeMs,
  onRetry,
  onContinueOffline 
}: BootErrorFallbackProps) {
  const isTimeout = error?.name === 'TimeoutError'
  const isNetworkError = error?.message.includes('network') || error?.message.includes('fetch')

  return (
    <div className="boot-error-container">
      <Card className="boot-error-card">
        <CardContent>
          <div className="boot-error-content">
            <div className="boot-error-icon">
              {isNetworkError ? (
                <WifiOff size={48} />
              ) : (
                <AlertTriangle size={48} />
              )}
            </div>
            
            <h3 className="boot-error-title">
              {isTimeout ? 'Loading is taking longer than expected' :
               isNetworkError ? 'Connection problem' :
               'Something went wrong'}
            </h3>
            
            <p className="boot-error-message">
              {isTimeout ? 
                'The app is taking longer to load than usual. This might be due to a slow connection.' :
               isNetworkError ?
                'Unable to connect to our servers. Please check your internet connection.' :
                'We encountered an unexpected error while loading your account.'}
            </p>

            {bootTimeMs && bootTimeMs > 2500 && (
              <div className="boot-error-timing">
                <small>Attempted for {Math.round(bootTimeMs / 100) / 10}s</small>
              </div>
            )}

            {error && (
              <details className="boot-error-details">
                <summary>Technical details</summary>
                <pre className="boot-error-stack">
                  {error.name}: {error.message}
                </pre>
              </details>
            )}

            <div className="boot-error-actions">
              <Button 
                onClick={onRetry} 
                leftIcon={<RefreshCw size={16} />}
                variant="primary"
              >
                Try Again
              </Button>
              
              {onContinueOffline && (
                <Button 
                  onClick={onContinueOffline}
                  leftIcon={<WifiOff size={16} />}
                  variant="secondary"
                >
                  Continue Offline
                </Button>
              )}
            </div>

            <div className="boot-error-tips">
              <h4>💡 Tips:</h4>
              <ul>
                <li>Check your internet connection</li>
                <li>Try refreshing the page</li>
                <li>Clear your browser cache if the problem persists</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <style jsx>{`
        .boot-error-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: var(--space-4);
          background: var(--bg-subtle);
        }

        .boot-error-card {
          max-width: 480px;
          width: 100%;
        }

        .boot-error-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          text-align: center;
          padding: var(--space-8);
        }

        .boot-error-icon {
          color: var(--warning);
          margin-bottom: var(--space-2);
        }

        .boot-error-title {
          margin: 0;
          color: var(--text);
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
        }

        .boot-error-message {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .boot-error-timing {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .boot-error-details {
          width: 100%;
          max-width: 400px;
          margin-top: var(--space-2);
        }

        .boot-error-details summary {
          cursor: pointer;
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin-bottom: var(--space-2);
        }

        .boot-error-stack {
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: var(--text-xs);
          font-family: var(--font-mono);
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 150px;
          overflow-y: auto;
          text-align: left;
          color: var(--text);
        }

        .boot-error-actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
          justify-content: center;
          margin-top: var(--space-2);
        }

        .boot-error-tips {
          margin-top: var(--space-4);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border);
          width: 100%;
        }

        .boot-error-tips h4 {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .boot-error-tips ul {
          margin: 0;
          padding: 0;
          list-style: none;
          text-align: left;
        }

        .boot-error-tips li {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin-bottom: var(--space-1);
          position: relative;
          padding-left: var(--space-4);
        }

        .boot-error-tips li::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--brand-500);
        }

        @media (max-width: 640px) {
          .boot-error-container {
            padding: var(--space-2);
          }
          
          .boot-error-content {
            padding: var(--space-6);
          }
          
          .boot-error-actions {
            flex-direction: column;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}