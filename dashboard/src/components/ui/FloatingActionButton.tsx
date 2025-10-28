import React, { useState } from 'react'
import { Plus } from 'lucide-react'

interface FloatingActionButtonProps {
  onClick?: () => void
  icon?: React.ReactNode
  label?: string
  className?: string
}

export default function FloatingActionButton({ 
  onClick, 
  icon = <Plus size={24} />, 
  label = "Add new",
  className = '' 
}: FloatingActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`floating-action-button ${className}`}
      title={label}
    >
      <div className="fab-icon">
        {icon}
      </div>
      
      <style jsx>{`
        .floating-action-button {
          position: fixed;
          bottom: var(--space-8);
          right: var(--space-8);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%);
          border: none;
          box-shadow: var(--shadow-lg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          z-index: var(--z-modal);
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .floating-action-button:hover {
          transform: translateY(-4px) scale(1.1);
          box-shadow: var(--shadow-xl);
        }

        .floating-action-button:active {
          transform: translateY(-2px) scale(1.05);
        }

        .fab-icon {
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          transform: ${isHovered ? 'rotate(45deg)' : 'rotate(0deg)'};
        }

        @keyframes slideInUp {
          0% {
            transform: translateY(100px) scale(0.8);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @media (max-width: 767px) {
          .floating-action-button {
            bottom: var(--space-6);
            right: var(--space-6);
            width: 48px;
            height: 48px;
          }
        }
      `}</style>
    </button>
  )
}
