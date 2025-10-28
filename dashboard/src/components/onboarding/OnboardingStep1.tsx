import React from 'react';
import { motion } from 'framer-motion';
import { User, Calendar, Ruler, Scale } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import OnboardingInput from './OnboardingInput';
import OnboardingSelect from './OnboardingSelect';
import { OnboardingData } from './types';

interface OnboardingStep1Props {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  canProceed: boolean;
}

const OnboardingStep1: React.FC<OnboardingStep1Props> = ({
  data,
  updateData,
  onNext,
  canProceed
}) => {
  const genderOptions = [
    { value: '', label: 'Select gender' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'nonbinary', label: 'Non-binary' },
    { value: 'other', label: 'Other' }
  ];

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1;
    }
    return age;
  };

  const getCurrentAge = () => {
    if (!data.dateOfBirth) return '';
    const age = calculateAge(data.dateOfBirth);
    return age ? `(${age} years old)` : '';
  };

  return (
    <div className="onboarding-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="onboarding-step-header">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="onboarding-step-icon"
          >
            <User size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">Let's get to know you!</h2>
          <p className="onboarding-step-subtitle">
            Tell us a bit about yourself so we can personalize your experience.
          </p>
        </div>

        {/* Form Fields */}
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          {/* Username (Optional) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="onboarding-form-group"
          >
            <label className="onboarding-label">
              Username (optional)
            </label>
            <OnboardingInput
              type="text"
              placeholder="Choose a username"
              value={data.username || ''}
              onChange={(e) => updateData({ username: e.target.value })}
              icon={<User size={20} />}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--onboarding-text-muted)', marginTop: 'var(--onboarding-space-1)' }}>
              This will be how others see you in the community
            </p>
          </motion.div>

          {/* Date of Birth */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="onboarding-form-group"
          >
            <label className="onboarding-label">
              Date of Birth <span className="onboarding-required">*</span>
            </label>
            <OnboardingInput
              type="date"
              value={data.dateOfBirth || ''}
              onChange={(e) => updateData({ dateOfBirth: e.target.value })}
              icon={<Calendar size={20} />}
              max={new Date().toISOString().split('T')[0]}
            />
            {data.dateOfBirth && (
              <p style={{ fontSize: '0.75rem', color: 'var(--onboarding-brand)', marginTop: 'var(--onboarding-space-1)' }}>
                {getCurrentAge()}
              </p>
            )}
          </motion.div>

          {/* Gender */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="onboarding-form-group"
          >
            <label className="onboarding-label">
              Gender <span className="onboarding-required">*</span>
            </label>
            <OnboardingSelect
              value={data.gender || ''}
              onChange={(value) => updateData({ gender: value })}
              options={genderOptions}
            />
          </motion.div>

          {/* Height */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="onboarding-form-group"
          >
            <label className="onboarding-label">
              Height <span className="onboarding-required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <OnboardingInput
                type="number"
                placeholder="170"
                value={data.height || ''}
                onChange={(e) => updateData({ height: parseInt(e.target.value) || undefined })}
                icon={<Ruler size={20} />}
                min="50"
                max="300"
              />
              <span style={{ 
                position: 'absolute', 
                right: 'var(--onboarding-space-3)', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--onboarding-text-muted)', 
                fontSize: '0.875rem' 
              }}>
                cm
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--onboarding-text-muted)', marginTop: 'var(--onboarding-space-1)' }}>
              This helps us calculate your nutritional needs
            </p>
          </motion.div>

          {/* Weight */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="onboarding-form-group"
          >
            <label className="onboarding-label">
              Weight (optional)
            </label>
            <div style={{ position: 'relative' }}>
              <OnboardingInput
                type="number"
                placeholder="70"
                value={data.weight || ''}
                onChange={(e) => updateData({ weight: parseFloat(e.target.value) || undefined })}
                icon={<Scale size={20} />}
                min="20"
                max="500"
                step="0.1"
              />
              <span style={{ 
                position: 'absolute', 
                right: 'var(--onboarding-space-3)', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--onboarding-text-muted)', 
                fontSize: '0.875rem' 
              }}>
                kg
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--onboarding-text-muted)', marginTop: 'var(--onboarding-space-1)' }}>
              Helps with more accurate calorie and nutrition calculations
            </p>
          </motion.div>
        </div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="onboarding-navigation"
          style={{ justifyContent: 'center' }}
        >
          <OnboardingButton
            onClick={onNext}
            disabled={!canProceed}
            size="large"
          >
            Continue
          </OnboardingButton>
        </motion.div>

        {/* Required Fields Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="onboarding-required-note"
        >
          <span className="onboarding-required">*</span> Required fields
        </motion.p>
      </motion.div>
    </div>
  );
};

export default OnboardingStep1;
