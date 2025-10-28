import React from 'react';

interface OnboardingButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  type?: 'button' | 'submit';
  className?: string;
}

const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  type = 'button',
  className = ''
}) => {
  const getClasses = () => {
    let classes = 'onboarding-button';
    
    if (variant === 'outline') {
      classes += ' outline';
    }
    
    if (size === 'large') {
      classes += ' large';
    }
    
    if (className) {
      classes += ` ${className}`;
    }
    
    return classes;
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={getClasses()}
    >
      {children}
    </button>
  );
};

export default OnboardingButton;
