import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, User, Target, Shield, Heart, DollarSign, Loader2, Utensils, Calculator, Crown, Users, Zap } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import { OnboardingData } from './types';

interface OnboardingStep8Props {
  data: OnboardingData;
  onPrev: () => void;
  onComplete: () => void;
  isSubmitting: boolean;
}

const OnboardingStep8: React.FC<OnboardingStep8Props> = ({
  data, onPrev, onComplete, isSubmitting
}) => {
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

  const formatGoals = (goals: string[]) => {
    return goals.map(goal => {
      return goal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }).join(', ');
  };

  const getTotalRestrictions = () => {
    if (!data.hasRestrictions) return 0;
    return data.allergies.length + data.customAllergies.length;
  };

  const getTotalPreferences = () => {
    return data.likedFoods.length + data.dislikedFoods.length + 
           data.customLikes.length + data.customDislikes.length;
  };

  const currencySymbol = data.budgetCurrency === 'EUR' ? '€' : 
                         data.budgetCurrency === 'GBP' ? '£' : 
                         data.budgetCurrency === 'JPY' ? '¥' : '$';

  const getSubscriptionInfo = () => {
    switch (data.subscriptionTier) {
      case 'free':
        return { name: 'Free Plan', icon: <Zap className="w-4 h-4" />, price: '$0/month' };
      case 'individual':
        return { name: 'Individual Pro', icon: <Crown className="w-4 h-4" />, price: '$9.99/month' };
      case 'family':
        return { name: 'Family Plan', icon: <Users className="w-4 h-4" />, price: '$19.99/month' };
      default:
        return { name: 'Free Plan', icon: <Zap className="w-4 h-4" />, price: '$0/month' };
    }
  };

  const subscriptionInfo = getSubscriptionInfo();

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
            <CheckCircle size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">Almost done! 🎉</h2>
          <p className="onboarding-step-subtitle">
            Let's review your information before we create your personalized nutrition dashboard.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="onboarding-summary-grid" style={{ marginBottom: 'var(--onboarding-space-6)' }}>
          {/* Personal Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                <User size={16} />
              </div>
              <h3 className="onboarding-summary-title">Personal Information</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--onboarding-space-4)', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--onboarding-text-muted)' }}>Age:</span>
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  {data.dateOfBirth ? `${calculateAge(data.dateOfBirth)} years` : 'Not provided'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--onboarding-text-muted)' }}>Gender:</span>
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)', textTransform: 'capitalize' }}>
                  {data.gender || 'Not provided'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--onboarding-text-muted)' }}>Height:</span>
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  {data.height ? `${data.height} cm` : 'Not provided'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--onboarding-text-muted)' }}>Username:</span>
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  {data.username || 'Not set'}
                </div>
              </div>
              {data.weight && (
                <div>
                  <span style={{ color: 'var(--onboarding-text-muted)' }}>Weight:</span>
                  <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                    {data.weight} kg
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Subscription Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                {subscriptionInfo.icon}
              </div>
              <h3 className="onboarding-summary-title">Subscription Plan</h3>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                {subscriptionInfo.name}
              </div>
              <div className="onboarding-summary-meta">
                {subscriptionInfo.price}
              </div>
            </div>
          </motion.div>

          {/* Goals */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                <Target size={16} />
              </div>
              <h3 className="onboarding-summary-title">Your Goals</h3>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                {formatGoals(data.goals)}
              </div>
              <div className="onboarding-summary-meta">
                {data.goals.length} goal{data.goals.length !== 1 ? 's' : ''} selected
              </div>
            </div>
          </motion.div>

          {/* Restrictions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                <Shield size={16} />
              </div>
              <h3 className="onboarding-summary-title">Dietary Restrictions</h3>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {data.hasRestrictions ? (
                <>
                  <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                    {getTotalRestrictions()} restriction{getTotalRestrictions() !== 1 ? 's' : ''} noted
                  </div>
                  <div className="onboarding-summary-meta">
                    We'll make sure to avoid these in your recommendations
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  No restrictions - you're all set! 🎉
                </div>
              )}
            </div>
          </motion.div>

          {/* Preferences */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                <Heart size={16} />
              </div>
              <h3 className="onboarding-summary-title">Food Preferences</h3>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {getTotalPreferences() > 0 ? (
                <>
                  <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                    {getTotalPreferences()} preference{getTotalPreferences() !== 1 ? 's' : ''} saved
                  </div>
                  <div className="onboarding-summary-meta">
                    We'll personalize recipes based on what you love
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  No preferences set - we'll learn as we go!
                </div>
              )}
            </div>
          </motion.div>

          {/* Dietary Preferences */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                <Utensils size={16} />
              </div>
              <h3 className="onboarding-summary-title">Eating Style</h3>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {data.dietaryTags.length > 0 || data.cuisinePrefs.length > 0 ? (
                <>
                  {data.dietaryTags.length > 0 && (
                    <div style={{ fontWeight: '500', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-1)' }}>
                      {data.dietaryTags.slice(0, 3).join(', ')}{data.dietaryTags.length > 3 ? ` +${data.dietaryTags.length - 3} more` : ''}
                    </div>
                  )}
                  {data.cuisinePrefs.length > 0 && (
                    <div className="onboarding-summary-meta">
                      Enjoys: {data.cuisinePrefs.slice(0, 3).join(', ')}{data.cuisinePrefs.length > 3 ? ` +${data.cuisinePrefs.length - 3} more` : ''}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  Open to all cuisines and styles
                </div>
              )}
            </div>
          </motion.div>

          {/* Budget */}
          <motion.div
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
            className="onboarding-summary-card"
          >
            <div className="onboarding-summary-header">
              <div className="onboarding-summary-icon">
                <DollarSign size={16} />
              </div>
              <h3 className="onboarding-summary-title">Monthly Budget</h3>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {data.monthlyBudget ? (
                <>
                  <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                    {currencySymbol}{data.monthlyBudget}/month
                  </div>
                  <div className="onboarding-summary-meta">
                    We'll help you find great deals and budget-friendly recipes
                  </div>
                </>
              ) : (
                <div style={{ fontWeight: '500', color: 'var(--onboarding-text)' }}>
                  No budget set - you can always add this later
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* What's Next */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="onboarding-info-box"
        >
          <h3 className="onboarding-info-title">🚀 What happens next?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--onboarding-space-4)', fontSize: '0.875rem' }}>
            <div>
              <div style={{ fontWeight: '500', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-1)' }}>Personalized Dashboard</div>
              <div style={{ color: 'var(--onboarding-text-muted)' }}>
                View nutrition insights tailored to you
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '500', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-1)' }}>Smart Recommendations</div>
              <div style={{ color: 'var(--onboarding-text-muted)' }}>
                Get recipes that match your goals
              </div>
            </div>
            <div>
              <div style={{ fontWeight: '500', color: 'var(--onboarding-text)', marginBottom: 'var(--onboarding-space-1)' }}>AI Nutrition Coach</div>
              <div style={{ color: 'var(--onboarding-text-muted)' }}>
                Chat with Nourish AI for guidance
              </div>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="onboarding-navigation">
          <OnboardingButton variant="outline" onClick={onPrev} size="large" disabled={isSubmitting}>
            Back
          </OnboardingButton>
          
          <OnboardingButton onClick={onComplete} disabled={isSubmitting} size="large">
            {isSubmitting ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 'var(--onboarding-space-2)' }} />
                Setting up...
              </>
            ) : (
              'Complete Setup'
            )}
          </OnboardingButton>
        </div>

        {/* Privacy Note */}
        <div className="onboarding-required-note" style={{ textAlign: 'center', maxWidth: '400px', margin: 'var(--onboarding-space-4) auto 0' }}>
          🔒 Your personal information is encrypted and secure. You can update or delete this information anytime in your settings.
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingStep8;
