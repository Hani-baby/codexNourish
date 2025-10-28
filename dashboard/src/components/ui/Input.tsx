import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
  label?: string;
  className?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error, label, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full px-3 py-2 ${icon ? 'pl-10' : ''} bg-input-bg border border-input-border rounded-lg 
              text-input-text placeholder:text-input-placeholder
              focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200 ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-danger mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
