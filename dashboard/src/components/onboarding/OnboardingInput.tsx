import React from 'react';

interface OnboardingInputProps {
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
}

const OnboardingInput: React.FC<OnboardingInputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  onKeyPress,
  icon,
  min,
  max,
  required = false,
  className = ''
}) => {
  return (
    <div className={`onboarding-input-container ${className}`}>
      {icon && (
        <div className="onboarding-input-icon">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyPress={onKeyPress}
        min={min}
        max={max}
        required={required}
        className="onboarding-input"
      />
    </div>
  );
};

export default OnboardingInput;
