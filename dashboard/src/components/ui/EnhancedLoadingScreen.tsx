/**
 * Enhanced Loading Screen with timeout handling and fallbacks
 */

import React, { useState, useEffect } from 'react'
import { RefreshCw, Clock, Wifi } from 'lucide-react'
import Button from './Button'
import ProgressRing from './ProgressRing'

interface EnhancedLoadingScreenProps {
  title?: string
  subtitle?: string
  showMascot?: boolean
  showProgress?: boolean
  
  // Timeout handling
  timeoutMs?: number
  onTimeout?: () => void
  onRetry?: () => void
  
  // Progress tracking
  currentStep?: string
  progress?: number
  
  // Performance metrics
  startTime?: number
  maxTimeMs?: number
}

export default function EnhancedLoadingScreen({
  title = "Nourish",
  subtitle = "Loading your dashboard...",
  showMascot = true,
  showProgress = false,
  timeoutMs = 1500,
  onTimeout,
  onRetry,
  currentStep,
  progress,
  startTime,
  maxTimeMs = 2500
}: EnhancedLoadingScreenProps) {
  const [showSpinner, setShowSpinner] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Show spinner after 150ms to avoid flicker
  useEffect(() => {
    const timer = setTimeout(() => setShowSpinner(true), 150)
    return () => clearTimeout(timer)
  }, [])

  // Handle timeout
  useEffect(() => {
    if (!timeoutMs || isTimedOut) return

    const timer = setTimeout(() => {
      console.warn(`⏰ Loading timeout after ${timeoutMs}ms`)
      setIsTimedOut(true)
      onTimeout?.()
    }, timeoutMs)

    return () => clearTimeout(timer)
  }, [timeoutMs, onTimeout, isTimedOut])

  // Track elapsed time
  useEffect(() => {
    if (!startTime) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      setElapsedTime(elapsed)
    }, 100)

    return () => clearInterval(interval)
  }, [startTime])

  const formatElapsedTime = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`
  }

  const isSlowLoading = elapsedTime > (maxTimeMs || 2500)

  if (isTimedOut) {
    return (
      <div className="loading-screen timeout">
        <div className="loading-content">
          <div className="loading-icon timeout-icon">
            <Clock size={48} />
          </div>
          
          <h2 className="loading-title">Still working...</h2>
          <p className="loading-subtitle">
            This is taking longer than expected. 
            {elapsedTime > 0 && (
              <span className="elapsed-time">
                {' '}({formatElapsedTime(elapsedTime)} elapsed)
              </span>
            )}
          </p>

          <div className="loading-actions">
            {onRetry && (
              <Button 
                onClick={onRetry}
                leftIcon={<RefreshCw size={16} />}
                variant="primary"
              >
                Try Again
              </Button>
            )}
            
            <Button 
              onClick={() => window.location.reload()}
              leftIcon={<Wifi size={16} />}
              variant="secondary"
            >
              Refresh Page
            </Button>
          </div>

          <div className="loading-tips">
            <small>
              💡 Check your internet connection or try refreshing the page
            </small>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`loading-screen ${isSlowLoading ? 'slow-loading' : ''}`}>
      <div className="loading-content">
        {showMascot && (
          <div className="loading-mascot">
            <img 
              src="/mascot.png" 
              alt="Nourish Mascot" 
              className="mascot-image"
            />
          </div>
        )}

        <div className="loading-text">
          <h2 className="loading-title">{title}</h2>
          <p className="loading-subtitle">
            {currentStep || subtitle}
          </p>
        </div>

        {showSpinner && (
          <div className="loading-spinner-container">
            {showProgress && typeof progress === 'number' ? (
              <ProgressRing 
                progress={progress} 
                size={48}
                strokeWidth={3}
                showPercentage={true}
              />
            ) : (
              <div className="loading-spinner" />
            )}
          </div>
        )}

        {isSlowLoading && (
          <div className="slow-loading-warning">
            <small>
              <Clock size={12} /> Taking longer than usual... ({formatElapsedTime(elapsedTime)})
            </small>
          </div>
        )}
      </div>

      <style jsx>{`
        .loading-screen {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, var(--bg) 0%, var(--bg-subtle) 100%);
          padding: var(--space-4);
        }

        .loading-screen.timeout {
          background: var(--bg-subtle);
        }

        .loading-screen.slow-loading {
          background: linear-gradient(135deg, var(--bg) 0%, var(--warning-50) 100%);
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          text-align: center;
          max-width: 400px;
          width: 100%;
        }

        .loading-mascot {
          margin-bottom: var(--space-2);
        }

        .mascot-image {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          animation: gentle-bounce 2s ease-in-out infinite;
        }

        .loading-text {
          margin-bottom: var(--space-2);
        }

        .loading-title {
          margin: 0;
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .loading-subtitle {
          margin: 0;
          font-size: var(--text-base);
          color: var(--text-muted);
          line-height: 1.5;
        }

        .elapsed-time {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .loading-spinner-container {
          margin: var(--space-2) 0;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid var(--border);
          border-top: 3px solid var(--brand-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-icon {
          margin-bottom: var(--space-2);
        }

        .timeout-icon {
          color: var(--warning);
        }

        .loading-actions {
          display: flex;
          gap: var(--space-3);
          margin-top: var(--space-4);
          flex-wrap: wrap;
          justify-content: center;
        }

        .loading-tips {
          margin-top: var(--space-4);
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .slow-loading-warning {
          margin-top: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--warning-100);
          border: 1px solid var(--warning-200);
          border-radius: var(--radius-sm);
          color: var(--warning-700);
          font-size: var(--text-sm);
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @media (max-width: 640px) {
          .loading-screen {
            padding: var(--space-2);
          }
          
          .loading-actions {
            flex-direction: column;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
