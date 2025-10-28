import React, { useEffect, useState } from 'react'
import { ChefHat, Sparkles, Loader2 } from 'lucide-react'

interface GenerationScreenProps {
  isVisible: boolean
  title?: string
  subtitle?: string
  estimatedTime?: string
  onComplete?: () => void
  autoComplete?: boolean
  autoCompleteDelay?: number
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

export default function GenerationScreen({
  isVisible,
  title = "Chef Nourish is cooking up something amazing!",
  subtitle = "Creating your personalized meal plan",
  estimatedTime = "30-45 seconds",
  onComplete,
  autoComplete = false,
  autoCompleteDelay = 3000
}: GenerationScreenProps) {
  const [currentMessage, setCurrentMessage] = useState(0)
  const [currentEmoji, setCurrentEmoji] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setCurrentMessage(0)
      setProgress(0)
      return
    }

    // Rotate through cooking messages
    const messageInterval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % cookingMessages.length)
    }, 2000)

    // Rotate through cooking emojis
    const emojiInterval = setInterval(() => {
      setCurrentEmoji(prev => (prev + 1) % cookingEmojis.length)
    }, 800)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        return prev + Math.random() * 15
      })
    }, 200)

    // Auto complete if enabled
    let autoCompleteTimer: NodeJS.Timeout
    if (autoComplete) {
      autoCompleteTimer = setTimeout(() => {
        setProgress(100)
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
  }, [isVisible, autoComplete, autoCompleteDelay, onComplete])

  if (!isVisible) return null

  return (
    <div className="generation-screen">
      <div className="generation-overlay">
        <div className="generation-container">
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
          <div className="generation-content">
            <h2 className="generation-title">{title}</h2>
            <p className="generation-subtitle">{subtitle}</p>
            
            {/* Progress Bar */}
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="progress-text">
                {Math.round(Math.min(progress, 100))}% complete
              </div>
            </div>

            {/* Current Message */}
            <div className="current-message">
              <Loader2 className="message-spinner" />
              <span>{cookingMessages[currentMessage]}</span>
            </div>

            {/* Estimated Time */}
            <div className="estimated-time">
              <span>Estimated time: {estimatedTime}</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .generation-screen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          pointer-events: all;
        }

        .generation-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            rgba(0, 177, 64, 0.95) 0%, 
            rgba(0, 150, 54, 0.95) 50%, 
            rgba(0, 120, 43, 0.95) 100%
          );
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .generation-container {
          text-align: center;
          color: white;
          max-width: 500px;
          padding: var(--space-8);
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
          margin-bottom: var(--space-8);
        }

        .chef-avatar {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto var(--space-4);
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }

        .chef-hat {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 60px;
          color: white;
          animation: wiggle 1.5s ease-in-out infinite;
        }

        @keyframes wiggle {
          0%, 100% { transform: translateX(-50%) rotate(0deg); }
          25% { transform: translateX(-50%) rotate(-3deg); }
          75% { transform: translateX(-50%) rotate(3deg); }
        }

        .chef-face {
          position: relative;
          width: 60px;
          height: 60px;
        }

        .chef-eyes {
          position: absolute;
          top: 15px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
        }

        .eye {
          width: 8px;
          height: 8px;
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
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 10px;
          border: 2px solid #333;
          border-top: none;
          border-radius: 0 0 20px 20px;
        }

        .cooking-emoji {
          position: absolute;
          top: -20px;
          right: -20px;
          font-size: 2rem;
          animation: float 2s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
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
          top: 20px;
          left: 20px;
          animation-delay: 0s;
        }

        .sparkle-2 {
          top: 40px;
          right: 30px;
          animation-delay: 0.7s;
        }

        .sparkle-3 {
          bottom: 30px;
          left: 30px;
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

        .generation-content {
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
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          margin: 0 0 var(--space-3) 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .generation-subtitle {
          font-size: var(--text-lg);
          margin: 0 0 var(--space-6) 0;
          opacity: 0.9;
        }

        .progress-container {
          margin-bottom: var(--space-6);
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: var(--space-2);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd700, #ffed4e);
          border-radius: 4px;
          transition: width 0.3s ease;
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .progress-text {
          font-size: var(--text-sm);
          opacity: 0.8;
        }

        .current-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          font-size: var(--text-base);
          margin-bottom: var(--space-4);
          min-height: 24px;
        }

        .message-spinner {
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .estimated-time {
          font-size: var(--text-sm);
          opacity: 0.8;
        }

        @media (max-width: 640px) {
          .generation-container {
            padding: var(--space-6);
          }

          .chef-avatar {
            width: 100px;
            height: 100px;
          }

          .chef-hat {
            width: 70px;
            height: 50px;
          }

          .generation-title {
            font-size: var(--text-xl);
          }

          .generation-subtitle {
            font-size: var(--text-base);
          }
        }
      `}</style>
    </div>
  )
}
