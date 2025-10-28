import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  className?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, onChange, error, label, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 pr-10 bg-input-bg border border-input-border rounded-lg 
              text-input-text appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-200 ${className}`}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-text-muted">
            <ChevronDown size={16} />
          </div>
        </div>
        {error && (
          <p className="text-sm text-danger mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
