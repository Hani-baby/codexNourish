import React from 'react';
import { motion } from 'framer-motion';
import { Utensils, Leaf, Globe } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import { OnboardingData } from './types';

interface OnboardingStep5NewProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
}

const dietaryTags = [
  'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo', 'Low Carb',
  'Low Fat', 'Mediterranean', 'DASH', 'Gluten Free', 'Dairy Free',
  'Halal', 'Kosher', 'Raw Food', 'Low Sodium', 'High Protein'
];

const cuisinePreferences = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian',
  'Mediterranean', 'French', 'American', 'Korean', 'Vietnamese',
  'Greek', 'Spanish', 'Middle Eastern', 'African', 'Caribbean',
  'German', 'British', 'Brazilian', 'Moroccan', 'Ethiopian'
];

const OnboardingStep5New: React.FC<OnboardingStep5NewProps> = ({
  data, updateData, onNext, onPrev, canProceed
}) => {
  const toggleDietaryTag = (tag: string) => {
    const newTags = data.dietaryTags.includes(tag)
      ? data.dietaryTags.filter(t => t !== tag)
      : [...data.dietaryTags, tag];
    updateData({ dietaryTags: newTags });
  };

  const toggleCuisine = (cuisine: string) => {
    const newCuisines = data.cuisinePrefs.includes(cuisine)
      ? data.cuisinePrefs.filter(c => c !== cuisine)
      : [...data.cuisinePrefs, cuisine];
    updateData({ cuisinePrefs: newCuisines });
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
            <Utensils size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">Your Eating Style</h2>
          <p className="onboarding-step-subtitle">
            Tell us about your dietary preferences and favorite cuisines to get personalized recommendations.
          </p>
        </div>

        {/* Dietary Tags Section */}
        <div style={{ marginBottom: 'var(--onboarding-space-8)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--onboarding-space-2)' }}>
            <Leaf size={20} style={{ color: 'var(--onboarding-success)' }} />
            Dietary Preferences
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--onboarding-text-muted)', marginBottom: 'var(--onboarding-space-4)' }}>
            Select all that apply to your eating style
          </p>
          
          <div className="onboarding-options-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            {dietaryTags.map((tag, index) => {
              const isSelected = data.dietaryTags.includes(tag);
              
              return (
                <motion.button
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.03 }}
                  onClick={() => toggleDietaryTag(tag)}
                  className={`onboarding-option-card ${isSelected ? 'selected' : ''}`}
                  style={{ minHeight: '80px', padding: 'var(--onboarding-space-3)' }}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="onboarding-option-check"
                    >
                      ✓
                    </motion.div>
                  )}
                  
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', textAlign: 'center' }}>
                    {tag}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {data.dietaryTags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'center', paddingTop: 'var(--onboarding-space-3)' }}
            >
              <p style={{ fontSize: '0.875rem', color: 'var(--onboarding-text-muted)' }}>
                {data.dietaryTags.length} preference{data.dietaryTags.length !== 1 ? 's' : ''} selected
              </p>
            </motion.div>
          )}
        </div>

        {/* Cuisine Preferences Section */}
        <div style={{ marginBottom: 'var(--onboarding-space-6)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--onboarding-space-2)' }}>
            <Globe size={20} style={{ color: 'var(--onboarding-brand)' }} />
            Favorite Cuisines
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--onboarding-text-muted)', marginBottom: 'var(--onboarding-space-4)' }}>
            Choose the cuisines you enjoy most (optional)
          </p>
          
          <div className="onboarding-options-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            {cuisinePreferences.map((cuisine, index) => {
              const isSelected = data.cuisinePrefs.includes(cuisine);
              
              return (
                <motion.button
                  key={cuisine}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.02 }}
                  onClick={() => toggleCuisine(cuisine)}
                  className={`onboarding-option-card ${isSelected ? 'selected' : ''}`}
                  style={{ minHeight: '70px', padding: 'var(--onboarding-space-3)' }}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="onboarding-option-check"
                    >
                      ✓
                    </motion.div>
                  )}
                  
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', textAlign: 'center' }}>
                    {cuisine}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {data.cuisinePrefs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'center', paddingTop: 'var(--onboarding-space-3)' }}
            >
              <p style={{ fontSize: '0.875rem', color: 'var(--onboarding-text-muted)' }}>
                {data.cuisinePrefs.length} cuisine{data.cuisinePrefs.length !== 1 ? 's' : ''} selected
              </p>
            </motion.div>
          )}
        </div>

        {/* Info Box */}
        <div className="onboarding-info-box">
          <h3 className="onboarding-info-title">💡 Why choose these?</h3>
          <ul className="onboarding-info-list">
            <li>• Get recipes that match your dietary needs</li>
            <li>• Discover new dishes from your favorite cuisines</li>
            <li>• Receive meal suggestions tailored to your style</li>
            <li>• Filter out foods that don't match your preferences</li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="onboarding-navigation">
          <OnboardingButton variant="outline" onClick={onPrev} size="large">Back</OnboardingButton>
          <OnboardingButton onClick={onNext} size="large">Continue</OnboardingButton>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingStep5New;
