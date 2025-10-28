import React, { useState, useEffect } from 'react'
import { Sparkles, ChefHat, Clock, Users, Calendar } from 'lucide-react'
import { mockCurationFacts, mockCurationJokes } from '../../lib/mockData'

interface MealPlanLoadingStateProps {
  isVisible: boolean
  progress: number
  currentStep: string
  onComplete: () => void
}

export default function MealPlanLoadingState({ 
  isVisible, 
  progress, 
  currentStep, 
  onComplete 
}: MealPlanLoadingStateProps) {
  const [currentFact, setCurrentFact] = useState('')
  const [showJoke, setShowJoke] = useState(false)
  const [animationClass, setAnimationClass] = useState('')

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setShowJoke(true)
        setCurrentFact(mockCurationJokes[Math.floor(Math.random() * mockCurationJokes.length)])
        setAnimationClass('joke')
      } else {
        setShowJoke(false)
        setCurrentFact(mockCurationFacts[Math.floor(Math.random() * mockCurationFacts.length)])
        setAnimationClass('fact')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isVisible])

  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(() => {
        onComplete()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [progress, onComplete])

  if (!isVisible) return null

  const steps = [
    { icon: <Calendar size={20} />, label: 'Analyzing preferences' },
    { icon: <ChefHat size={20} />, label: 'Finding recipes' },
    { icon: <Sparkles size={20} />, label: 'Balancing nutrition' },
    { icon: <Users size={20} />, label: 'Adjusting portions' },
    { icon: <Clock size={20} />, label: 'Finalizing schedule' }
  ]

  const currentStepIndex = Math.min(Math.floor(progress / 20), 4)

  return (
    <div className="loading-overlay">
      <div className="loading-container">
        {/* Floating Food Elements */}
        <div className="floating-food">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`food-element food-${i + 1}`}>
              {getFoodEmoji(i)}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="loading-content">
          {/* Chef Mascot */}
          <div className="mascot-container">
            <img src="/mascot.png" alt="Chef Nourish" className="mascot-cooking" />
            <div className="cooking-sparkles">
              <Sparkles size={16} className="sparkle-1" />
              <Sparkles size={12} className="sparkle-2" />
              <Sparkles size={14} className="sparkle-3" />
            </div>
          </div>

          {/* Main Message */}
          <h2 className="loading-title">
            Nourish is cooking up your perfect meal plan...
          </h2>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              />
              <div className="progress-glow" />
            </div>
            <div className="progress-text">{Math.round(progress)}%</div>
          </div>

          {/* Current Step */}
          <div className="current-step">
            <div className="step-icon">
              {steps[currentStepIndex]?.icon}
            </div>
            <span className="step-text">{currentStep}</span>
          </div>

          {/* Step Progress */}
          <div className="steps-container">
            {steps.map((step, index) => (
              <div 
                key={index} 
                className={`step-item ${index <= currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}`}
              >
                <div className="step-icon-small">
                  {step.icon}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
            ))}
          </div>

          {/* Fun Facts */}
          <div className="facts-container">
            <div className={`fact-bubble ${animationClass}`}>
              <div className="fact-icon">
                {showJoke ? '😄' : '💡'}
              </div>
              <p className="fact-text">{currentFact}</p>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="loading-info">
            <div className="info-badges">
              <div className="info-badge">
                <Clock size={14} />
                <span>Sep 14 - Sep 20</span>
              </div>
              <div className="info-badge">
                <Sparkles size={14} />
                <span>Surprise me!</span>
              </div>
              <div className="info-badge">
                <ChefHat size={14} />
                <span>3 meals/day</span>
              </div>
              <div className="info-badge">
                <Users size={14} />
                <span>2 servings</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, var(--brand-50) 0%, var(--brand-100) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal);
          padding: var(--space-4);
        }

        [data-theme="dark"] .loading-overlay {
          background: linear-gradient(135deg, rgba(21, 181, 107, 0.05) 0%, rgba(21, 181, 107, 0.1) 100%);
        }

        .loading-container {
          position: relative;
          width: 100%;
          max-width: 600px;
          text-align: center;
        }

        .floating-food {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .food-element {
          position: absolute;
          font-size: 1.5rem;
          opacity: 0.6;
          animation: float-food 8s ease-in-out infinite;
        }

        .food-1 { top: 10%; left: 10%; animation-delay: 0s; }
        .food-2 { top: 20%; right: 15%; animation-delay: 1s; }
        .food-3 { bottom: 30%; left: 8%; animation-delay: 2s; }
        .food-4 { bottom: 20%; right: 12%; animation-delay: 3s; }
        .food-5 { top: 60%; left: 20%; animation-delay: 4s; }
        .food-6 { top: 40%; right: 25%; animation-delay: 5s; }
        .food-7 { top: 30%; left: 70%; animation-delay: 1.5s; }
        .food-8 { bottom: 60%; right: 30%; animation-delay: 2.5s; }
        .food-9 { top: 80%; left: 60%; animation-delay: 3.5s; }
        .food-10 { top: 15%; left: 50%; animation-delay: 4.5s; }
        .food-11 { bottom: 40%; left: 40%; animation-delay: 5.5s; }
        .food-12 { top: 70%; right: 60%; animation-delay: 6s; }

        @keyframes float-food {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(5deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
          75% { transform: translateY(-25px) rotate(7deg); }
        }

        .loading-content {
          position: relative;
          z-index: 1;
          background: rgba(255, 255, 255, 0.9);
          border-radius: var(--radius-2xl);
          padding: var(--space-10);
          box-shadow: var(--shadow-xl);
          backdrop-filter: blur(10px);
        }

        [data-theme="dark"] .loading-content {
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid var(--border);
        }

        .mascot-container {
          position: relative;
          display: inline-block;
          margin-bottom: var(--space-8);
        }

        .mascot-cooking {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid var(--brand);
          animation: cooking-bounce 2s ease-in-out infinite;
          box-shadow: var(--shadow-lg);
          object-fit: cover;
        }

        .cooking-sparkles {
          position: absolute;
          top: -10px;
          right: -10px;
          width: 60px;
          height: 60px;
        }

        .sparkle-1, .sparkle-2, .sparkle-3 {
          position: absolute;
          color: var(--brand);
          animation: sparkle-dance 1.5s ease-in-out infinite;
        }

        .sparkle-1 { top: 0; left: 0; animation-delay: 0s; }
        .sparkle-2 { top: 15px; right: 0; animation-delay: 0.5s; }
        .sparkle-3 { bottom: 0; left: 15px; animation-delay: 1s; }

        @keyframes cooking-bounce {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }

        @keyframes sparkle-dance {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          50% { transform: scale(1.3) rotate(180deg); opacity: 0.7; }
        }

        .loading-title {
          font-size: var(--text-3xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin: 0 0 var(--space-8) 0;
          line-height: 1.2;
        }

        .progress-container {
          position: relative;
          margin-bottom: var(--space-8);
        }

        .progress-bar {
          width: 100%;
          height: 12px;
          background-color: var(--panel-2);
          border-radius: var(--radius-full);
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--brand), var(--brand-600));
          border-radius: var(--radius-full);
          transition: width 0.5s ease-out;
          position: relative;
        }

        .progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: progress-shine 2s ease-in-out infinite;
        }

        @keyframes progress-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .progress-glow {
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(90deg, var(--brand), var(--brand-600));
          border-radius: var(--radius-full);
          opacity: 0.3;
          filter: blur(4px);
          z-index: -1;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          right: var(--space-4);
          transform: translateY(-50%);
          font-size: var(--text-sm);
          font-weight: var(--font-bold);
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .current-step {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          margin-bottom: var(--space-8);
          padding: var(--space-4) var(--space-6);
          background: var(--brand-100);
          border-radius: var(--radius-lg);
          border: 1px solid var(--brand-200);
        }

        [data-theme="dark"] .current-step {
          background: rgba(21, 181, 107, 0.1);
          border-color: rgba(21, 181, 107, 0.2);
        }

        .step-icon {
          color: var(--brand);
          animation: pulse-icon 2s ease-in-out infinite;
        }

        @keyframes pulse-icon {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .step-text {
          font-size: var(--text-base);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .steps-container {
          display: flex;
          justify-content: center;
          gap: var(--space-4);
          margin-bottom: var(--space-8);
          flex-wrap: wrap;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
          opacity: 0.4;
        }

        .step-item.completed {
          opacity: 1;
        }

        .step-item.active {
          opacity: 1;
          background: var(--brand-50);
          transform: scale(1.05);
        }

        [data-theme="dark"] .step-item.active {
          background: rgba(21, 181, 107, 0.05);
        }

        .step-icon-small {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--panel-2);
          color: var(--text-muted);
          transition: all var(--transition-fast);
        }

        .step-item.completed .step-icon-small {
          background: var(--brand);
          color: white;
        }

        .step-item.active .step-icon-small {
          background: var(--brand);
          color: white;
          animation: pulse-active 1s ease-in-out infinite;
        }

        @keyframes pulse-active {
          0%, 100% { box-shadow: 0 0 0 0 rgba(21, 181, 107, 0.7); }
          50% { box-shadow: 0 0 0 6px rgba(21, 181, 107, 0); }
        }

        .step-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          text-align: center;
          max-width: 80px;
        }

        .step-item.completed .step-label,
        .step-item.active .step-label {
          color: var(--text);
          font-weight: var(--font-medium);
        }

        .facts-container {
          margin-bottom: var(--space-8);
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fact-bubble {
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4) var(--space-6);
          max-width: 400px;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          animation: fade-in 0.5s ease-out;
        }

        .fact-bubble.joke {
          background: var(--warning-100);
          border-color: var(--warning-200);
        }

        [data-theme="dark"] .fact-bubble.joke {
          background: rgba(251, 191, 36, 0.1);
          border-color: rgba(251, 191, 36, 0.2);
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fact-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .fact-text {
          font-size: var(--text-sm);
          color: var(--text);
          margin: 0;
          line-height: 1.4;
          font-style: italic;
        }

        .loading-info {
          border-top: 1px solid var(--border);
          padding-top: var(--space-6);
        }

        .info-badges {
          display: flex;
          justify-content: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .info-badge {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .loading-content {
            padding: var(--space-8);
          }

          .loading-title {
            font-size: var(--text-2xl);
          }

          .steps-container {
            gap: var(--space-2);
          }

          .step-item {
            padding: var(--space-2);
          }

          .step-icon-small {
            width: 28px;
            height: 28px;
          }

          .step-label {
            font-size: var(--text-xs);
            max-width: 60px;
          }

          .info-badges {
            gap: var(--space-2);
          }

          .info-badge {
            padding: var(--space-1) var(--space-3);
            font-size: var(--text-xs);
          }
        }

        @media (max-width: 480px) {
          .mascot-cooking {
            width: 100px;
            height: 100px;
          }

          .loading-title {
            font-size: var(--text-xl);
          }

          .steps-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: var(--space-3);
          }
        }
      `}</style>
    </div>
  )
}

function getFoodEmoji(index: number): string {
  const foods = ['🥑', '🥕', '🍅', '🥬', '🫐', '🍓', '🥒', '🌶️', '🧄', '🧅', '🥦', '🌽']
  return foods[index % foods.length]
}
