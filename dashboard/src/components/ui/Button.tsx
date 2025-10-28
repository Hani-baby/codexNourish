import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export default function Button({
  variant = 'solid',
  size = 'md',
  children,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`}
      disabled={disabled}
      {...props}
    >
      {leftIcon && <span className="button-icon">{leftIcon}</span>}
      <span className="button-text">{children}</span>
      {rightIcon && <span className="button-icon">{rightIcon}</span>}

      <style jsx>{`
        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          font-weight: var(--font-medium);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
          cursor: pointer;
          border: 1px solid transparent;
          text-decoration: none;
          position: relative;
          overflow: hidden;
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        /* Sizes */
        .button-sm {
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-sm);
          min-height: 32px;
        }

        .button-md {
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          min-height: 40px;
        }

        .button-lg {
          padding: var(--space-4) var(--space-6);
          font-size: var(--text-base);
          min-height: 48px;
        }

        /* Variants */
        .button-solid {
          background-color: var(--brand-500);
          color: white;
        }

        .button-solid:hover:not(:disabled) {
          background-color: var(--brand-600);
        }

        .button-solid:active:not(:disabled) {
          background-color: var(--brand-700);
        }

        .button-outline {
          background-color: transparent;
          color: var(--text);
          border-color: var(--border);
        }

        .button-outline:hover:not(:disabled) {
          background-color: var(--hover-bg);
          border-color: var(--brand-500);
        }

        .button-ghost {
          background-color: transparent;
          color: var(--text);
        }

        .button-ghost:hover:not(:disabled) {
          background-color: var(--hover-bg);
        }

        .button-danger {
          background-color: var(--danger);
          color: white;
        }

        .button-danger:hover:not(:disabled) {
          background-color: #dc2626;
        }

        .button-subtle {
          background-color: var(--panel-2);
          color: var(--text-muted);
        }

        .button-subtle:hover:not(:disabled) {
          background-color: var(--hover-bg);
          color: var(--text);
        }

        .button-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .button-text {
          line-height: 1;
        }

        .button:focus-visible {
          outline: 2px solid var(--focus-ring);
          outline-offset: 2px;
        }
      `}</style>
    </button>
  )
}
