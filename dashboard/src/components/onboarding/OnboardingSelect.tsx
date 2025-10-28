import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface OnboardingSelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

const OnboardingSelect: React.FC<OnboardingSelectProps> = ({
  options,
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={`onboarding-input-container ${className}`} style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="onboarding-select"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div style={{ 
        position: 'absolute', 
        right: 'var(--onboarding-space-3)', 
        top: '50%', 
        transform: 'translateY(-50%)', 
        pointerEvents: 'none',
        color: 'var(--onboarding-text-muted)'
      }}>
        <ChevronDown size={16} />
      </div>
    </div>
  );
};

export default OnboardingSelect;
