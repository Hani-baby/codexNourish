import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    title: string;
    description?: string;
  }>;
  className?: string;
}

export default function StepIndicator({ 
  currentStep, 
  totalSteps, 
  steps, 
  className = '' 
}: StepIndicatorProps) {
  return (
    <div className={`step-indicator ${className}`}>
      <div className="step-indicator-track">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;
          
          return (
            <div key={stepNumber} className="step-item">
              <div className={`step-circle ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isUpcoming ? 'upcoming' : ''}`}>
                {isCompleted ? (
                  <Check size={16} />
                ) : (
                  <span className="step-number">{stepNumber}</span>
                )}
              </div>
              
              <div className="step-content">
                <div className={`step-title ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}>
                  {step.title}
                </div>
                {step.description && (
                  <div className={`step-description ${isCurrent ? 'current' : ''}`}>
                    {step.description}
                  </div>
                )}
              </div>
              
              {stepNumber < totalSteps && (
                <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .step-indicator {
          width: 100%;
          padding: var(--space-4) 0;
        }

        .step-indicator-track {
          display: flex;
          align-items: flex-start;
          position: relative;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          flex: 1;
        }

        .step-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-semibold);
          font-size: var(--text-sm);
          transition: all var(--transition-normal);
          position: relative;
          z-index: 2;
          border: 2px solid var(--border);
          background-color: var(--panel);
          color: var(--text-muted);
        }

        .step-circle.completed {
          background-color: var(--success);
          border-color: var(--success);
          color: white;
          transform: scale(1.05);
        }

        .step-circle.current {
          background-color: var(--brand-500);
          border-color: var(--brand-500);
          color: white;
          transform: scale(1.1);
          box-shadow: 0 0 0 4px rgba(0, 177, 64, 0.2);
        }

        .step-circle.upcoming {
          background-color: var(--panel-2);
          border-color: var(--border);
          color: var(--text-muted);
        }

        .step-circle:hover:not(.current) {
          transform: scale(1.05);
          border-color: var(--brand-300);
        }

        .step-number {
          font-weight: var(--font-semibold);
        }

        .step-content {
          margin-top: var(--space-3);
          text-align: center;
          max-width: 120px;
        }

        .step-title {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-muted);
          transition: color var(--transition-fast);
          line-height: 1.3;
        }

        .step-title.current {
          color: var(--text);
          font-weight: var(--font-semibold);
        }

        .step-title.completed {
          color: var(--success);
        }

        .step-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin-top: var(--space-1);
          line-height: 1.3;
          transition: color var(--transition-fast);
        }

        .step-description.current {
          color: var(--text-muted);
        }

        .step-connector {
          position: absolute;
          top: 20px;
          left: 50%;
          right: -50%;
          height: 2px;
          background-color: var(--border);
          transition: background-color var(--transition-normal);
          z-index: 1;
        }

        .step-connector.completed {
          background-color: var(--success);
        }

        /* Animation for current step */
        .step-circle.current {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 4px rgba(0, 177, 64, 0.2);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(0, 177, 64, 0.1);
          }
          100% {
            box-shadow: 0 0 0 4px rgba(0, 177, 64, 0.2);
          }
        }

        /* Responsive design */
        @media (max-width: 640px) {
          .step-content {
            max-width: 80px;
          }

          .step-title {
            font-size: var(--text-xs);
          }

          .step-description {
            display: none;
          }

          .step-circle {
            width: 32px;
            height: 32px;
            font-size: var(--text-xs);
          }

          .step-connector {
            top: 16px;
          }
        }

        /* Dark theme adjustments */
        [data-theme="dark"] .step-circle {
          background-color: var(--panel);
          border-color: var(--border);
        }

        [data-theme="dark"] .step-circle.upcoming {
          background-color: var(--panel-2);
        }

        [data-theme="dark"] .step-circle.current {
          box-shadow: 0 0 0 4px rgba(0, 177, 64, 0.3);
        }

        [data-theme="dark"] .step-connector {
          background-color: var(--border);
        }

        [data-theme="dark"] .step-connector.completed {
          background-color: var(--success);
        }
      `}</style>
    </div>
  );
}
