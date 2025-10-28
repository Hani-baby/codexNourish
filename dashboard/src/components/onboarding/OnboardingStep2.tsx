import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Heart, Zap, Scale, Dumbbell, Calculator } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import OnboardingInput from './OnboardingInput';
import OnboardingSelect from './OnboardingSelect';
import { OnboardingData } from './types';

interface OnboardingStep2Props {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
}

const goalOptions = [
  {
    id: 'weight_loss',
    label: 'Weight Loss',
    description: 'Lose weight in a healthy, sustainable way',
    icon: <Scale size={24} />,
    color: 'from-red-400 to-red-600'
  },
  {
    id: 'muscle_gain',
    label: 'Muscle Gain',
    description: 'Build lean muscle mass and strength',
    icon: <Dumbbell size={24} />,
    color: 'from-blue-400 to-blue-600'
  },
  {
    id: 'balanced_nutrition',
    label: 'Balanced Nutrition',
    description: 'Maintain overall health and wellness',
    icon: <Heart size={24} />,
    color: 'from-brand-400 to-brand-600'
  },
  {
    id: 'energy_boost',
    label: 'More Energy',
    description: 'Increase daily energy and vitality',
    icon: <Zap size={24} />,
    color: 'from-yellow-400 to-yellow-600'
  },
  {
    id: 'better_habits',
    label: 'Better Habits',
    description: 'Develop healthier eating patterns',
    icon: <TrendingUp size={24} />,
    color: 'from-purple-400 to-purple-600'
  }
];

const strategyOptions = [
  { value: '', label: 'Select strategy' },
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'custom', label: 'Custom' }
];

const OnboardingStep2: React.FC<OnboardingStep2Props> = ({
  data,
  updateData,
  onNext,
  onPrev,
  canProceed
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const toggleGoal = (goalId: string) => {
    const newGoals = data.goals.includes(goalId)
      ? data.goals.filter(g => g !== goalId)
      : [...data.goals, goalId];
    
    updateData({ goals: newGoals });
  };

  const calculateCaloriesFromBMR = () => {
    if (!data.weight || !data.height || !data.dateOfBirth || !data.gender) return null;
    
    const age = new Date().getFullYear() - new Date(data.dateOfBirth).getFullYear();
    let bmr = 0;
    
    if (data.gender === 'male') {
      bmr = 88.362 + (13.397 * data.weight) + (4.799 * data.height) - (5.677 * age);
    } else {
      bmr = 447.593 + (9.247 * data.weight) + (3.098 * data.height) - (4.330 * age);
    }
    
    // Apply activity multiplier (moderate activity)
    const tdee = Math.round(bmr * 1.55);
    
    switch (data.nutritionStrategy) {
      case 'weight_loss':
        return tdee - 500; // 500 calorie deficit
      case 'muscle_gain':
        return tdee + 300; // 300 calorie surplus
      case 'maintenance':
      default:
        return tdee;
    }
  };

  const suggestMacros = () => {
    const calories = data.calorieTarget || calculateCaloriesFromBMR() || 2000;
    
    switch (data.nutritionStrategy) {
      case 'weight_loss':
        return {
          protein: Math.round((calories * 0.30) / 4),
          carbs: Math.round((calories * 0.40) / 4),
          fat: Math.round((calories * 0.30) / 9)
        };
      case 'muscle_gain':
        return {
          protein: Math.round((calories * 0.25) / 4),
          carbs: Math.round((calories * 0.50) / 4),
          fat: Math.round((calories * 0.25) / 9)
        };
      case 'maintenance':
      default:
        return {
          protein: Math.round((calories * 0.20) / 4),
          carbs: Math.round((calories * 0.50) / 4),
          fat: Math.round((calories * 0.30) / 9)
        };
    }
  };

  const applySuggestedMacros = () => {
    const suggested = suggestMacros();
    updateData({
      proteinTarget: suggested.protein,
      carbsTarget: suggested.carbs,
      fatTarget: suggested.fat
    });
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
            <Target size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">What are your goals?</h2>
          <p className="onboarding-step-subtitle">
            Select all that apply. We'll tailor your experience to help you achieve them.
          </p>
        </div>

        {/* Goal Options */}
        <div className="onboarding-options-grid">
          {goalOptions.map((goal, index) => {
            const isSelected = data.goals.includes(goal.id);
            
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
              >
                <div
                  onClick={() => toggleGoal(goal.id)}
                  className={`onboarding-option-card ${isSelected ? 'selected' : ''}`}
                >
                  {/* Selection Indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="onboarding-option-check"
                    >
                      ✓
                    </motion.div>
                  )}

                  {/* Icon */}
                  <div className={`onboarding-option-icon bg-gradient-to-br ${goal.color}`}>
                    {goal.icon}
                  </div>

                  {/* Content */}
                  <h3 className="onboarding-option-title">
                    {goal.label}
                  </h3>
                  <p className="onboarding-option-description">
                    {goal.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selected Goals Summary */}
        {data.goals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', paddingTop: 'var(--onboarding-space-4)' }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--onboarding-text-muted)' }}>
              You've selected {data.goals.length} goal{data.goals.length !== 1 ? 's' : ''}
            </p>
          </motion.div>
        )}

        {/* Nutrition Strategy Section */}
        {data.goals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            style={{ marginTop: 'var(--onboarding-space-8)', maxWidth: '500px', margin: 'var(--onboarding-space-8) auto 0' }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-4)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--onboarding-space-2)' }}>
              <Calculator size={20} />
              Nutrition Strategy
            </h3>
            
            <div className="onboarding-form-group">
              <label className="onboarding-label">
                What's your primary nutrition approach?
              </label>
              <OnboardingSelect
                value={data.nutritionStrategy || ''}
                onChange={(value) => updateData({ nutritionStrategy: value as any })}
                options={strategyOptions}
              />
            </div>

            {/* Calorie Target */}
            <div className="onboarding-form-group">
              <label className="onboarding-label">
                Daily Calorie Target (optional)
              </label>
              <div style={{ display: 'flex', gap: 'var(--onboarding-space-3)', alignItems: 'center' }}>
                <OnboardingInput
                  type="number"
                  placeholder="2000"
                  value={data.calorieTarget || ''}
                  onChange={(e) => updateData({ calorieTarget: parseInt(e.target.value) || undefined })}
                  min="1000"
                  max="5000"
                />
                {data.weight && data.height && data.dateOfBirth && (
                  <OnboardingButton
                    variant="outline"
                    onClick={() => updateData({ calorieTarget: calculateCaloriesFromBMR() })}
                    size="small"
                  >
                    Auto Calculate
                  </OnboardingButton>
                )}
              </div>
              {calculateCaloriesFromBMR() && (
                <p style={{ fontSize: '0.75rem', color: 'var(--onboarding-brand)', marginTop: 'var(--onboarding-space-1)' }}>
                  Suggested: {calculateCaloriesFromBMR()} calories/day based on your info
                </p>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <div style={{ textAlign: 'center', margin: 'var(--onboarding-space-4) 0' }}>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--onboarding-brand)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {showAdvanced ? 'Hide' : 'Show'} Macro Targets
              </button>
            </div>

            {/* Macro Targets */}
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--onboarding-space-4)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--onboarding-text)' }}>
                    Macro Targets (grams/day)
                  </h4>
                  <OnboardingButton
                    variant="outline"
                    onClick={applySuggestedMacros}
                    size="small"
                  >
                    Use Suggested
                  </OnboardingButton>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--onboarding-space-3)' }}>
                  <div>
                    <label className="onboarding-label" style={{ fontSize: '0.875rem' }}>Protein</label>
                    <OnboardingInput
                      type="number"
                      placeholder="150"
                      value={data.proteinTarget || ''}
                      onChange={(e) => updateData({ proteinTarget: parseInt(e.target.value) || undefined })}
                      min="0"
                      max="500"
                    />
                  </div>
                  <div>
                    <label className="onboarding-label" style={{ fontSize: '0.875rem' }}>Carbs</label>
                    <OnboardingInput
                      type="number"
                      placeholder="200"
                      value={data.carbsTarget || ''}
                      onChange={(e) => updateData({ carbsTarget: parseInt(e.target.value) || undefined })}
                      min="0"
                      max="800"
                    />
                  </div>
                  <div>
                    <label className="onboarding-label" style={{ fontSize: '0.875rem' }}>Fat</label>
                    <OnboardingInput
                      type="number"
                      placeholder="67"
                      value={data.fatTarget || ''}
                      onChange={(e) => updateData({ fatTarget: parseInt(e.target.value) || undefined })}
                      min="0"
                      max="300"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="onboarding-navigation"
        >
          <OnboardingButton
            variant="outline"
            onClick={onPrev}
            size="large"
          >
            Back
          </OnboardingButton>
          
          <OnboardingButton
            onClick={onNext}
            disabled={!canProceed}
            size="large"
          >
            Continue
          </OnboardingButton>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingStep2;
