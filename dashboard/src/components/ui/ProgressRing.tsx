import React, { useEffect, useState } from 'react'

interface ProgressRingProps {
  value: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
  onGoalReached?: () => void
}

export default function ProgressRing({ 
  value, 
  size = 120, 
  strokeWidth = 8, 
  label,
  className = '',
  onGoalReached
}: ProgressRingProps) {
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [hasReachedGoal, setHasReachedGoal] = useState(false)
  
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (value / 100) * circumference

  useEffect(() => {
    if (value >= 100 && !hasReachedGoal) {
      setHasReachedGoal(true)
      setIsCelebrating(true)
      onGoalReached?.()
      
      // Stop celebration after animation
      setTimeout(() => setIsCelebrating(false), 2000)
    }
  }, [value, hasReachedGoal, onGoalReached])

  return (
    <div className={`progress-ring ${className} ${isCelebrating ? 'celebrating' : ''}`}>
      <svg width={size} height={size} className="progress-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--brand-500)"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="progress-circle"
        />
      </svg>
      {label && (
        <div className="progress-label">
          <span className="progress-value">{Math.round(value)}%</span>
          <span className="progress-text">{label}</span>
        </div>
      )}

      <style jsx>{`
        .progress-ring {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .progress-svg {
          transform: rotate(-90deg);
        }

        .progress-circle {
          transition: stroke-dashoffset 1s ease-in-out;
        }

        [data-theme="dark"] .progress-circle {
          filter: drop-shadow(0 0 4px var(--brand-200));
        }

        .progress-label {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .progress-value {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          color: var(--text);
          line-height: 1;
        }

        .progress-text {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: var(--space-1);
        }

        .celebrating {
          animation: celebrate 0.6s ease-in-out;
        }

        .celebrating .progress-circle {
          stroke: var(--success);
          filter: drop-shadow(0 0 8px var(--success));
        }

        .celebrating .progress-value {
          color: var(--success);
          animation: pulse 0.6s ease-in-out;
        }

        @keyframes celebrate {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
