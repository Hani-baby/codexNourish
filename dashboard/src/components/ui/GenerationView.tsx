import React, { useEffect, useState } from 'react'
import { ChefHat, Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import Button from './Button'

interface GenerationViewProps {
  isVisible: boolean
  title?: string
  subtitle?: string
  estimatedTime?: string
  statusMessage?: string
  progress?: number
  isBusy?: boolean
  onComplete?: () => void
  autoComplete?: boolean
  autoCompleteDelay?: number
  error?: string | null
  onRetry?: () => void
}

const cookingMessages = [
  "Chef Nourish is analyzing your preferences...",
  "Crafting the perfect meal combinations...",
  "Optimizing ingredients for maximum nutrition...",
  "Calculating portions and quantities...",
  "Cross-referencing with your pantry...",
  "Finalizing your personalized plan..."
]

const cookingEmojis = ["🥘", "👨‍🍳", "🍽️", "🥗", "🍳", "🧑‍🍳", "🍲", "🥘"]

export default function GenerationView({
  isVisible,
  title = "Chef Nourish is cooking up something amazing!",
  subtitle = "Creating your personalized meal plan",
  estimatedTime = "30-45 seconds",
  statusMessage,
  progress,
  isBusy = true,
  onComplete,
  autoComplete = false,
  autoCompleteDelay = 3000,
  error,
  onRetry
}: GenerationViewProps) {
  const [currentMessage, setCurrentMessage] = useState(0)
  const [currentEmoji, setCurrentEmoji] = useState(0)
  const [internalProgress, setInternalProgress] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setCurrentMessage(0)
      setInternalProgress(0)
      return
    }

    if (typeof progress === 'number') {
      setInternalProgress(progress)
      return
    }

    const messageInterval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % cookingMessages.length)
    }, 2000)

    const emojiInterval = setInterval(() => {
      setCurrentEmoji(prev => (prev + 1) % cookingEmojis.length)
    }, 800)

    const progressInterval = setInterval(() => {
      setInternalProgress(prev => {
        if (prev >= 100) return 100
        return prev + Math.random() * 15
      })
    }, 200)

    let autoCompleteTimer: NodeJS.Timeout | undefined
    if (autoComplete) {
      autoCompleteTimer = setTimeout(() => {
        setInternalProgress(100)
        setTimeout(() => {
          onComplete?.()
        }, 500)
      }, autoCompleteDelay)
    }

    return () => {
      clearInterval(messageInterval)
      clearInterval(emojiInterval)
      clearInterval(progressInterval)
      if (autoCompleteTimer) clearTimeout(autoCompleteTimer)
    }
  }, [isVisible, progress, autoComplete, autoCompleteDelay, onComplete])

  if (!isVisible) return null

  // Show error state
  if (error) {
    return (
      <div className="generation-view error-state">
        <div className="generation-content">
          <div className="error-animation">
            <div className="error-icon">
              <AlertCircle size={48} />
            </div>
          </div>

          <div className="generation-text">
            <h2 className="generation-title">Oops! Something went wrong</h2>
            <p className="generation-subtitle">{error}</p>
            
            <div className="error-actions">
              {onRetry && (
                <Button 
                  variant="solid" 
                  leftIcon={<RefreshCw size={16} />}
                  onClick={onRetry}
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="generation-view">
      <div className="generation-content">
        {/* Chef Nourish Animation */}
        <div className="chef-animation">
          <div className="chef-avatar">
            <ChefHat className="chef-hat" />
            <div className="chef-face">
              <div className="chef-eyes">
                <div className="eye left-eye"></div>
                <div className="eye right-eye"></div>
              </div>
              <div className="chef-smile"></div>
            </div>
          </div>
          <div className="cooking-emoji">
            {cookingEmojis[currentEmoji]}
          </div>
          <div className="sparkles">
            <Sparkles className="sparkle-1" />
            <Sparkles className="sparkle-2" />
            <Sparkles className="sparkle-3" />
          </div>
        </div>

        {/* Content */}
        <div className="generation-text">
          <h2 className="generation-title">{title}</h2>
          <p className="generation-subtitle">{subtitle}</p>
          
          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${Math.min(internalProgress, 100)}%` }}
              />
            </div>
            <div className="progress-text">
              {Math.round(Math.min(internalProgress, 100))}% complete
            </div>
          </div>

          {/* Current Message */}
          <div className="current-message">
            <Loader2 className="message-spinner" />
            <span>{statusMessage || cookingMessages[currentMessage]}</span>
          </div>

          {/* Estimated Time */}
          <div className="estimated-time">
            <span>{isBusy ? `Estimated time: ${estimatedTime}` : 'Chef Nourish has finished this step.'}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .generation-view {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          padding: var(--space-8);
          background: linear-gradient(135deg, 
            var(--brand-50) 0%, 
            var(--brand-100) 50%, 
            var(--brand-200) 100%
          );
          border-radius: var(--radius-2xl);
          border: 1px solid var(--brand-200);
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .generation-content {
          text-align: center;
          color: var(--text);
          max-width: 500px;
          width: 100%;
          animation: slideUp 0.6s ease-out;
        }

        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(30px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .chef-animation {
          position: relative;
          margin-bottom: var(--space-6);
        }

        .chef-avatar {
          position: relative;
          width: 100px;
          height: 100px;
          margin: 0 auto var(--space-4);
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-8px);
          }
          60% {
            transform: translateY(-4px);
          }
        }

        .chef-hat {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 45px;
          color: white;
          animation: wiggle 1.5s ease-in-out infinite;
        }

        @keyframes wiggle {
          0%, 100% { transform: translateX(-50%) rotate(0deg); }
          25% { transform: translateX(-50%) rotate(-2deg); }
          75% { transform: translateX(-50%) rotate(2deg); }
        }

        .chef-face {
          position: relative;
          width: 50px;
          height: 50px;
        }

        .chef-eyes {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 6px;
        }

        .eye {
          width: 6px;
          height: 6px;
          background: #333;
          border-radius: 50%;
          animation: blink 3s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }

        .chef-smile {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 16px;
          height: 8px;
          border: 2px solid #333;
          border-top: none;
          border-radius: 0 0 16px 16px;
        }

        .cooking-emoji {
          position: absolute;
          top: -15px;
          right: -15px;
          font-size: 1.5rem;
          animation: float 2s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .sparkles {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .sparkle-1, .sparkle-2, .sparkle-3 {
          position: absolute;
          color: #ffd700;
          animation: sparkle 2s ease-in-out infinite;
        }

        .sparkle-1 {
          top: 15px;
          left: 15px;
          animation-delay: 0s;
        }

        .sparkle-2 {
          top: 30px;
          right: 20px;
          animation-delay: 0.7s;
        }

        .sparkle-3 {
          bottom: 25px;
          left: 25px;
          animation-delay: 1.4s;
        }

        @keyframes sparkle {
          0%, 100% { 
            opacity: 0; 
            transform: scale(0.5) rotate(0deg); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1) rotate(180deg); 
          }
        }

        .generation-text {
          animation: fadeInUp 0.8s ease-out 0.3s both;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .generation-title {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          margin: 0 0 var(--space-3) 0;
          color: var(--text);
        }

        .generation-subtitle {
          font-size: var(--text-base);
          margin: 0 0 var(--space-6) 0;
          color: var(--text-muted);
        }

        .progress-container {
          margin-bottom: var(--space-6);
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(0, 177, 64, 0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: var(--space-2);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--brand-500), var(--brand-600));
          border-radius: 3px;
          transition: width 0.3s ease;
          box-shadow: 0 0 8px rgba(0, 177, 64, 0.3);
        }

        .progress-text {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .current-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          margin-bottom: var(--space-4);
          min-height: 20px;
          color: var(--text);
        }

        .message-spinner {
          width: 14px;
          height: 14px;
          animation: spin 1s linear infinite;
          color: var(--brand-500);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .estimated-time {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .error-state {
          background: linear-gradient(135deg, 
            rgba(248, 113, 113, 0.1) 0%, 
            rgba(248, 113, 113, 0.05) 50%, 
            rgba(248, 113, 113, 0.1) 100%
          );
          border-color: rgba(248, 113, 113, 0.3);
        }

        .error-animation {
          position: relative;
          margin-bottom: var(--space-6);
        }

        .error-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto;
          background: rgba(248, 113, 113, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--danger);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.05);
            opacity: 0.8;
          }
        }

        .error-actions {
          margin-top: var(--space-6);
          display: flex;
          justify-content: center;
        }

        @media (max-width: 640px) {
          .generation-view {
            padding: var(--space-6);
            min-height: 300px;
          }

          .chef-avatar {
            width: 80px;
            height: 80px;
          }

          .chef-hat {
            width: 50px;
            height: 35px;
          }

          .generation-title {
            font-size: var(--text-lg);
          }

          .generation-subtitle {
            font-size: var(--text-sm);
          }
        }
      `}</style>
    </div>
  )
}
