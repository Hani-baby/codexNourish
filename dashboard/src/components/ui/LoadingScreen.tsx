import React from 'react'

interface LoadingScreenProps {
  title?: string
  subtitle?: string
  showMascot?: boolean
  showProgress?: boolean
}

export default function LoadingScreen({ 
  title = "Nourish", 
  subtitle = "Loading your dashboard...",
  showMascot = true,
  showProgress = false
}: LoadingScreenProps) {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        {showMascot && (
          <div className="logo-container">
            <img src="/mascot.png" alt="Nourish Mascot" className="loading-logo" />
            <div className="logo-glow" />
          </div>
        )}
        <h2 className="loading-title">{title}</h2>
        <div className="spinner-container">
          <div className="loading-spinner" />
          <div className="spinner-ring" />
        </div>
        <p className="loading-text">{subtitle}</p>
        {showProgress && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" />
            </div>
            <div className="progress-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .loading-screen {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--brand-50) 0%, var(--bg) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          position: relative;
          overflow: hidden;
        }

        .loading-screen::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(34, 197, 94, 0.1) 0%, transparent 50%);
          animation: backgroundShift 8s ease-in-out infinite;
        }

        .loading-content {
          text-align: center;
          max-width: 400px;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .logo-container {
          position: relative;
          display: inline-block;
          margin-bottom: var(--space-4);
        }

        .loading-logo {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-lg);
          animation: logoFloat 3s ease-in-out infinite;
          position: relative;
          z-index: 2;
        }

        .logo-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, var(--brand-500) 0%, transparent 70%);
          border-radius: 50%;
          opacity: 0.3;
          animation: glow 2s ease-in-out infinite alternate;
        }

        .loading-title {
          font-size: var(--text-3xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin-bottom: var(--space-6);
          background: linear-gradient(135deg, var(--text) 0%, var(--brand-600) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: titleGlow 2s ease-in-out infinite alternate;
        }

        .spinner-container {
          position: relative;
          width: 60px;
          height: 60px;
          margin: 0 auto var(--space-6);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top: 3px solid var(--brand-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .spinner-ring {
          width: 60px;
          height: 60px;
          border: 2px solid var(--brand-200);
          border-radius: 50%;
          position: absolute;
          top: 0;
          left: 0;
          animation: ringPulse 2s ease-in-out infinite;
        }

        .loading-text {
          color: var(--text-muted);
          font-size: var(--text-lg);
          font-weight: var(--font-medium);
          margin-bottom: var(--space-4);
        }

        .progress-container {
          margin-top: var(--space-6);
        }

        .progress-bar {
          width: 200px;
          height: 4px;
          background-color: var(--border);
          border-radius: 2px;
          margin: 0 auto var(--space-3);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--brand-500) 0%, var(--brand-400) 100%);
          border-radius: 2px;
          animation: progressFill 2s ease-in-out infinite;
        }

        .progress-dots {
          display: flex;
          justify-content: center;
          gap: var(--space-2);
        }

        .dot {
          width: 8px;
          height: 8px;
          background-color: var(--brand-400);
          border-radius: 50%;
          animation: dotPulse 1.5s ease-in-out infinite;
        }

        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes glow {
          0% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
        }

        @keyframes titleGlow {
          0% { filter: brightness(1); }
          100% { filter: brightness(1.2); }
        }

        @keyframes ringPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }

        @keyframes backgroundShift {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        @keyframes progressFill {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }

        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @media (max-width: 768px) {
          .loading-title {
            font-size: var(--text-2xl);
          }
          
          .loading-logo {
            width: 64px;
            height: 64px;
          }
          
          .logo-glow {
            width: 72px;
            height: 72px;
          }
        }
      `}</style>
    </div>
  )
}
