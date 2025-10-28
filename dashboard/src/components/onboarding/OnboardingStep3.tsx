import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Plus, X } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import OnboardingInput from './OnboardingInput';
import { OnboardingData } from './types';

interface OnboardingStep3Props {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
}

const commonAllergies = [
  'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts',
  'Wheat/Gluten', 'Soy', 'Sesame', 'Corn'
];

const dietaryPreferences = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo', 'Low Carb',
  'Low Fat', 'Halal', 'Kosher', 'No Pork', 'No Beef', 'No Spicy Food'
];

const OnboardingStep3: React.FC<OnboardingStep3Props> = ({
  data, updateData, onNext, onPrev, canProceed
}) => {
  const [customInput, setCustomInput] = useState('');

  const handleRestrictionChoice = (hasRestrictions: boolean) => {
    updateData({ 
      hasRestrictions,
      allergies: hasRestrictions ? data.allergies : [],
      customAllergies: hasRestrictions ? data.customAllergies : []
    });
  };

  const toggleAllergy = (allergy: string) => {
    const newAllergies = data.allergies.includes(allergy)
      ? data.allergies.filter(a => a !== allergy)
      : [...data.allergies, allergy];
    updateData({ allergies: newAllergies });
  };

  const addCustomAllergy = () => {
    if (customInput.trim() && !data.customAllergies.includes(customInput.trim())) {
      updateData({ customAllergies: [...data.customAllergies, customInput.trim()] });
      setCustomInput('');
    }
  };

  const removeCustomAllergy = (allergy: string) => {
    updateData({ customAllergies: data.customAllergies.filter(a => a !== allergy) });
  };

  return (
    <div className="onboarding-card">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="onboarding-step-header">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="onboarding-step-icon"
          >
            <Shield size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">Allergies & Restrictions</h2>
          <p className="onboarding-step-subtitle">
            Help us keep you safe by telling us about any food allergies or dietary restrictions.
          </p>
        </div>

        {/* Initial Choice */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--onboarding-space-4)', justifyContent: 'center', marginBottom: 'var(--onboarding-space-8)', maxWidth: '400px', margin: '0 auto var(--onboarding-space-8)' }}>
          <OnboardingButton
            variant={data.hasRestrictions === false ? "primary" : "outline"}
            onClick={() => handleRestrictionChoice(false)}
            size="large"
          >
            No Restrictions
          </OnboardingButton>
          <OnboardingButton
            variant={data.hasRestrictions === true ? "primary" : "outline"}
            onClick={() => handleRestrictionChoice(true)}
            size="large"
          >
            I have restrictions
          </OnboardingButton>
        </div>

        {/* Restrictions Section */}
        {data.hasRestrictions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            {/* Common Allergies */}
            <div style={{ marginBottom: 'var(--onboarding-space-6)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--onboarding-space-2)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--onboarding-danger)' }} />
                Common Allergies
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--onboarding-space-3)' }}>
                {commonAllergies.map((allergy, index) => {
                  const isSelected = data.allergies.includes(allergy);
                  return (
                    <motion.button
                      key={allergy}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      onClick={() => toggleAllergy(allergy)}
                      style={{
                        padding: 'var(--onboarding-space-3)',
                        borderRadius: 'var(--onboarding-radius-md)',
                        border: `2px solid ${isSelected ? 'var(--onboarding-danger)' : 'var(--onboarding-border)'}`,
                        backgroundColor: isSelected ? 'rgba(225, 77, 77, 0.1)' : 'var(--onboarding-panel)',
                        color: isSelected ? 'var(--onboarding-danger)' : 'var(--onboarding-text)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all var(--onboarding-transition)',
                        boxShadow: 'var(--onboarding-shadow-sm)'
                      }}
                    >
                      {allergy}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div style={{ marginBottom: 'var(--onboarding-space-6)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-4)' }}>
                Add Custom Restriction
              </h3>
              <div className="onboarding-custom-input">
                <OnboardingInput
                  type="text"
                  placeholder="e.g., Mushrooms, Cilantro, etc."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAllergy())}
                />
                <OnboardingButton onClick={addCustomAllergy} disabled={!customInput.trim()}>
                  <Plus size={16} />
                </OnboardingButton>
              </div>

              {data.customAllergies.length > 0 && (
                <div className="onboarding-tags">
                  {data.customAllergies.map((allergy) => (
                    <div key={allergy} className="onboarding-tag">
                      {allergy}
                      <button onClick={() => removeCustomAllergy(allergy)} className="onboarding-tag-remove">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="onboarding-navigation">
          <OnboardingButton variant="outline" onClick={onPrev} size="large">Back</OnboardingButton>
          <OnboardingButton onClick={onNext} disabled={!canProceed} size="large">Continue</OnboardingButton>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingStep3;