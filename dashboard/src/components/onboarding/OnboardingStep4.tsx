import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ThumbsUp, ThumbsDown, Plus, X } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import OnboardingInput from './OnboardingInput';
import { OnboardingData } from './types';

interface OnboardingStep4Props {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
}

const foodOptions = [
  'Chicken', 'Beef', 'Pork', 'Fish', 'Salmon', 'Tuna', 'Eggs', 'Tofu', 'Beans', 'Lentils',
  'Broccoli', 'Spinach', 'Carrots', 'Bell Peppers', 'Tomatoes', 'Onions', 'Garlic', 'Mushrooms',
  'Apples', 'Bananas', 'Berries', 'Oranges', 'Avocado', 'Mango', 'Grapes',
  'Rice', 'Pasta', 'Bread', 'Quinoa', 'Oats', 'Potatoes', 'Sweet Potatoes',
  'Milk', 'Cheese', 'Yogurt', 'Almond Milk', 'Coconut Milk',
  'Almonds', 'Walnuts', 'Peanuts', 'Sunflower Seeds', 'Chia Seeds',
  'Basil', 'Cilantro', 'Ginger', 'Cinnamon', 'Turmeric'
];

const OnboardingStep4: React.FC<OnboardingStep4Props> = ({
  data, updateData, onNext, onPrev, canProceed
}) => {
  const [customLikeInput, setCustomLikeInput] = useState('');
  const [customDislikeInput, setCustomDislikeInput] = useState('');

  const toggleLikedFood = (food: string) => {
    const newLikedFoods = data.likedFoods.includes(food)
      ? data.likedFoods.filter(f => f !== food)
      : [...data.likedFoods, food];
    const newDislikedFoods = data.dislikedFoods.filter(f => f !== food);
    updateData({ likedFoods: newLikedFoods, dislikedFoods: newDislikedFoods });
  };

  const toggleDislikedFood = (food: string) => {
    const newDislikedFoods = data.dislikedFoods.includes(food)
      ? data.dislikedFoods.filter(f => f !== food)
      : [...data.dislikedFoods, food];
    const newLikedFoods = data.likedFoods.filter(f => f !== food);
    updateData({ likedFoods: newLikedFoods, dislikedFoods: newDislikedFoods });
  };

  const addCustomLike = () => {
    if (customLikeInput.trim() && !data.customLikes.includes(customLikeInput.trim())) {
      updateData({ customLikes: [...data.customLikes, customLikeInput.trim()] });
      setCustomLikeInput('');
    }
  };

  const addCustomDislike = () => {
    if (customDislikeInput.trim() && !data.customDislikes.includes(customDislikeInput.trim())) {
      updateData({ customDislikes: [...data.customDislikes, customDislikeInput.trim()] });
      setCustomDislikeInput('');
    }
  };

  const removeCustomLike = (food: string) => {
    updateData({ customLikes: data.customLikes.filter(f => f !== food) });
  };

  const removeCustomDislike = (food: string) => {
    updateData({ customDislikes: data.customDislikes.filter(f => f !== food) });
  };

  const getFoodState = (food: string) => {
    if (data.likedFoods.includes(food)) return 'liked';
    if (data.dislikedFoods.includes(food)) return 'disliked';
    return 'neutral';
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
            <Heart size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">What do you like to eat?</h2>
          <p className="onboarding-step-subtitle">
            This is optional but helps us recommend recipes you'll love. Tap once for ❤️, twice for 👎.
          </p>
        </div>

        {/* Food Grid */}
        <div className="onboarding-food-grid" style={{ marginBottom: 'var(--onboarding-space-8)' }}>
          {foodOptions.map((food, index) => {
            const state = getFoodState(food);
            
            return (
              <motion.div
                key={food}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.02 }}
                className="onboarding-food-item-container"
                style={{ position: 'relative' }}
              >
                <button
                  onClick={() => toggleLikedFood(food)}
                  onDoubleClick={() => toggleDislikedFood(food)}
                  className={`onboarding-food-item ${state}`}
                >
                  {food}
                  {state === 'liked' && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="onboarding-food-emoji liked"
                    >
                      ❤️
                    </motion.div>
                  )}
                  {state === 'disliked' && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="onboarding-food-emoji disliked"
                    >
                      👎
                    </motion.div>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Custom Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--onboarding-space-6)', marginBottom: 'var(--onboarding-space-6)' }}>
          {/* Custom Likes */}
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--onboarding-space-2)' }}>
              <ThumbsUp size={20} style={{ color: 'var(--onboarding-success)' }} />
              Foods I Love
            </h3>
            <div className="onboarding-custom-input">
              <OnboardingInput
                type="text"
                placeholder="Add something you love..."
                value={customLikeInput}
                onChange={(e) => setCustomLikeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomLike())}
              />
              <OnboardingButton onClick={addCustomLike} disabled={!customLikeInput.trim()}>
                <Plus size={16} />
              </OnboardingButton>
            </div>
            {data.customLikes.length > 0 && (
              <div className="onboarding-tags">
                {data.customLikes.map((food) => (
                  <div key={food} className="onboarding-tag" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--onboarding-success)' }}>
                    ❤️ {food}
                    <button onClick={() => removeCustomLike(food)} className="onboarding-tag-remove">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Dislikes */}
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--onboarding-space-2)' }}>
              <ThumbsDown size={20} style={{ color: 'var(--onboarding-danger)' }} />
              Foods I Avoid
            </h3>
            <div className="onboarding-custom-input">
              <OnboardingInput
                type="text"
                placeholder="Add something you avoid..."
                value={customDislikeInput}
                onChange={(e) => setCustomDislikeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomDislike())}
              />
              <OnboardingButton onClick={addCustomDislike} disabled={!customDislikeInput.trim()}>
                <Plus size={16} />
              </OnboardingButton>
            </div>
            {data.customDislikes.length > 0 && (
              <div className="onboarding-tags">
                {data.customDislikes.map((food) => (
                  <div key={food} className="onboarding-tag" style={{ backgroundColor: 'rgba(225, 77, 77, 0.1)', color: 'var(--onboarding-danger)' }}>
                    👎 {food}
                    <button onClick={() => removeCustomDislike(food)} className="onboarding-tag-remove">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {(data.likedFoods.length > 0 || data.dislikedFoods.length > 0 || data.customLikes.length > 0 || data.customDislikes.length > 0) && (
          <div style={{ textAlign: 'center', paddingTop: 'var(--onboarding-space-4)', fontSize: '0.875rem', color: 'var(--onboarding-text-muted)' }}>
            You've selected {data.likedFoods.length + data.customLikes.length} likes and {data.dislikedFoods.length + data.customDislikes.length} dislikes
          </div>
        )}

        {/* Navigation */}
        <div className="onboarding-navigation">
          <OnboardingButton variant="outline" onClick={onPrev} size="large">Back</OnboardingButton>
          <OnboardingButton onClick={onNext} size="large">Continue</OnboardingButton>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingStep4;