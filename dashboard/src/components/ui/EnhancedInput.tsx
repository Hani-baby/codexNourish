import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
  success?: string;
  label?: string;
  hint?: string;
  className?: string;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  showPasswordToggle?: boolean;
  animated?: boolean;
}

const EnhancedInput = forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({ 
    icon, 
    error, 
    success, 
    label, 
    hint, 
    className = '', 
    variant = 'default',
    size = 'md',
    showPasswordToggle = false,
    animated = true,
    type,
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!props.value || !!props.defaultValue);

    const inputType = showPasswordToggle && type === 'password' 
      ? (showPassword ? 'text' : 'password') 
      : type;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(!!e.target.value);
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value);
      props.onChange?.(e);
    };

    const getStatusIcon = () => {
      if (error) return <AlertCircle size={16} className="text-danger" />;
      if (success) return <CheckCircle size={16} className="text-success" />;
      return null;
    };

    const getStatusColor = () => {
      if (error) return 'border-danger focus:ring-danger/20';
      if (success) return 'border-success focus:ring-success/20';
      return 'border-input-border focus:ring-brand/20';
    };

    return (
      <div className={`enhanced-input-container ${className}`}>
        {label && (
          <label className="enhanced-input-label">
            {label}
            {props.required && <span className="required-asterisk">*</span>}
          </label>
        )}
        
        <div className={`enhanced-input-wrapper ${variant} ${size} ${getStatusColor()} ${isFocused ? 'focused' : ''} ${animated ? 'animated' : ''}`}>
          {icon && (
            <div className="enhanced-input-icon">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            type={inputType}
            className="enhanced-input"
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
          
          {showPasswordToggle && type === 'password' && (
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          
          {getStatusIcon() && (
            <div className="status-icon">
              {getStatusIcon()}
            </div>
          )}
        </div>
        
        {(error || success || hint) && (
          <div className="enhanced-input-message">
            {error && <span className="error-message">{error}</span>}
            {success && <span className="success-message">{success}</span>}
            {hint && !error && !success && <span className="hint-message">{hint}</span>}
          </div>
        )}

        <style jsx>{`
          .enhanced-input-container {
            width: 100%;
            position: relative;
          }

          .enhanced-input-label {
            display: block;
            font-size: var(--text-sm);
            font-weight: var(--font-medium);
            color: var(--text);
            margin-bottom: var(--space-2);
            transition: color var(--transition-fast);
          }

          .required-asterisk {
            color: var(--danger);
            margin-left: 2px;
          }

          .enhanced-input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            border-radius: var(--radius-lg);
            transition: all var(--transition-fast);
            background-color: var(--input-bg);
            border: 2px solid var(--input-border);
            overflow: hidden;
          }

          .enhanced-input-wrapper.focused {
            border-color: var(--brand-500);
            box-shadow: 0 0 0 3px rgba(0, 177, 64, 0.1);
          }

          .enhanced-input-wrapper.animated {
            transition: all var(--transition-normal);
          }

          .enhanced-input-wrapper.animated:hover:not(.focused) {
            border-color: var(--brand-300);
            transform: translateY(-1px);
            box-shadow: var(--shadow-sm);
          }

          /* Variants */
          .enhanced-input-wrapper.filled {
            background-color: var(--panel-2);
            border-color: transparent;
          }

          .enhanced-input-wrapper.filled.focused {
            background-color: var(--input-bg);
            border-color: var(--brand-500);
          }

          .enhanced-input-wrapper.outlined {
            background-color: transparent;
            border-width: 2px;
          }

          /* Sizes */
          .enhanced-input-wrapper.sm {
            min-height: 36px;
            padding: 0 var(--space-3);
          }

          .enhanced-input-wrapper.md {
            min-height: 44px;
            padding: 0 var(--space-4);
          }

          .enhanced-input-wrapper.lg {
            min-height: 52px;
            padding: 0 var(--space-5);
          }

          .enhanced-input {
            flex: 1;
            border: none;
            outline: none;
            background: transparent;
            color: var(--input-text);
            font-size: var(--text-sm);
            font-family: inherit;
            padding: 0;
            transition: all var(--transition-fast);
          }

          /* Date input specific styling for consistent text color */
          .enhanced-input[type="date"] {
            color: var(--input-text) !important;
            -webkit-text-fill-color: var(--input-text) !important;
          }

          .enhanced-input[type="date"]::-webkit-datetime-edit {
            color: var(--input-text) !important;
          }

          .enhanced-input[type="date"]::-webkit-datetime-edit-fields-wrapper {
            color: var(--input-text) !important;
          }

          .enhanced-input[type="date"]::-webkit-datetime-edit-text {
            color: var(--input-text) !important;
          }

          .enhanced-input[type="date"]::-webkit-datetime-edit-month-field {
            color: var(--input-text) !important;
          }

          .enhanced-input[type="date"]::-webkit-datetime-edit-day-field {
            color: var(--input-text) !important;
          }

          .enhanced-input[type="date"]::-webkit-datetime-edit-year-field {
            color: var(--input-text) !important;
          }

          /* Firefox date input styling */
          .enhanced-input[type="date"]::-moz-placeholder {
            color: var(--input-text) !important;
          }

          .enhanced-input::placeholder {
            color: var(--input-placeholder);
            transition: color var(--transition-fast);
          }

          .enhanced-input:focus::placeholder {
            color: var(--text-muted);
          }

          .enhanced-input-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            margin-right: var(--space-2);
            transition: color var(--transition-fast);
          }

          .enhanced-input-wrapper.focused .enhanced-input-icon {
            color: var(--brand-500);
          }

          .password-toggle,
          .status-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            margin-left: var(--space-2);
            cursor: pointer;
            transition: color var(--transition-fast);
            background: none;
            border: none;
            padding: 0;
          }

          .password-toggle:hover {
            color: var(--text);
          }

          .enhanced-input-message {
            margin-top: var(--space-1);
            font-size: var(--text-xs);
            display: flex;
            align-items: center;
            gap: var(--space-1);
            min-height: 16px;
          }

          .error-message {
            color: var(--danger);
            font-weight: var(--font-medium);
          }

          .success-message {
            color: var(--success);
            font-weight: var(--font-medium);
          }

          .hint-message {
            color: var(--text-muted);
          }

          /* Dark theme adjustments */
          [data-theme="dark"] .enhanced-input-wrapper {
            background-color: var(--input-bg);
            border-color: var(--input-border);
          }

          [data-theme="dark"] .enhanced-input-wrapper.filled {
            background-color: var(--panel-2);
          }

          [data-theme="dark"] .enhanced-input-wrapper.focused {
            border-color: var(--brand-400);
            box-shadow: 0 0 0 3px rgba(0, 177, 64, 0.15);
          }

          [data-theme="dark"] .enhanced-input-wrapper.animated:hover:not(.focused) {
            border-color: var(--brand-400);
            box-shadow: var(--shadow-md);
          }

          /* Focus states for accessibility */
          .enhanced-input:focus-visible {
            outline: none;
          }

          .enhanced-input-wrapper:focus-within {
            border-color: var(--brand-500);
            box-shadow: 0 0 0 3px rgba(0, 177, 64, 0.1);
          }

          [data-theme="dark"] .enhanced-input-wrapper:focus-within {
            border-color: var(--brand-400);
            box-shadow: 0 0 0 3px rgba(0, 177, 64, 0.15);
          }

          /* Dark theme date input styling */
          [data-theme="dark"] .enhanced-input[type="date"] {
            color: var(--input-text) !important;
            -webkit-text-fill-color: var(--input-text) !important;
          }

          [data-theme="dark"] .enhanced-input[type="date"]::-webkit-datetime-edit {
            color: var(--input-text) !important;
          }

          [data-theme="dark"] .enhanced-input[type="date"]::-webkit-datetime-edit-fields-wrapper {
            color: var(--input-text) !important;
          }

          [data-theme="dark"] .enhanced-input[type="date"]::-webkit-datetime-edit-text {
            color: var(--input-text) !important;
          }

          [data-theme="dark"] .enhanced-input[type="date"]::-webkit-datetime-edit-month-field {
            color: var(--input-text) !important;
          }

          [data-theme="dark"] .enhanced-input[type="date"]::-webkit-datetime-edit-day-field {
            color: var(--input-text) !important;
          }

          [data-theme="dark"] .enhanced-input[type="date"]::-webkit-datetime-edit-year-field {
            color: var(--input-text) !important;
          }
        `}</style>
      </div>
    );
  }
);

EnhancedInput.displayName = 'EnhancedInput';

export default EnhancedInput;
