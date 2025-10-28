import React from 'react';
import { motion } from 'framer-motion';
import { OnboardingStepProps } from './types';
import { Check, Crown, Users, Zap } from 'lucide-react';

const OnboardingStep7: React.FC<OnboardingStepProps> = ({
  data,
  updateData,
  onNext,
  onPrev,
  canProceed
}) => {
  const subscriptionOptions = [
    {
      id: 'free',
      name: 'Free',
      icon: <Zap className="w-6 h-6" />,
      description: 'Perfect for getting started',
      features: [
        'Manual meal planning',
        'Access to 21 recipes',
        'AI generation once per 60 days',
        'Max 7-day meal plans',
        'No grocery lists'
      ],
      limitations: ['Limited features', 'No Instacart integration', 'No AI Chef', 'No community'],
      price: '$0/month',
      popular: false
    },
    {
      id: 'individual',
      name: 'Individual Pro',
      icon: <Crown className="w-6 h-6" />,
      description: 'For personal nutrition optimization',
      features: [
        'Unlimited AI meal plans',
        'Full recipe library access',
        'Smart grocery lists',
        'Instacart integration',
        'AI Chef assistant',
        'Community access'
      ],
      price: '$9.99/month',
      popular: true
    },
    {
      id: 'family',
      name: 'Family Plan',
      icon: <Users className="w-6 h-6" />,
      description: 'Perfect for families and households',
      features: [
        'Everything in Individual Pro',
        'Up to 6 family members',
        'Shared meal planning',
        'Family grocery lists',
        'Member invitations',
        'Collaborative planning'
      ],
      price: '$19.99/month',
      popular: false
    }
  ];

  const handleSubscriptionSelect = (tier: 'free' | 'individual' | 'family') => {
    updateData({ 
      subscriptionTier: tier,
      subscription: tier === 'free' ? 'free' : tier === 'individual' ? 'individual' : 'family'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="onboarding-step"
    >
      <div className="onboarding-step-header">
        <h2 className="onboarding-step-title">Choose Your Plan</h2>
        <p className="onboarding-step-description">
          Select the subscription tier that best fits your needs. You can always upgrade or downgrade later.
        </p>
      </div>

      <div className="subscription-options">
        {subscriptionOptions.map((option) => (
          <motion.div
            key={option.id}
            className={`subscription-option ${data.subscriptionTier === option.id ? 'selected' : ''} ${option.popular ? 'popular' : ''}`}
            onClick={() => handleSubscriptionSelect(option.id as 'free' | 'individual' | 'family')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {option.popular && (
              <div className="subscription-popular-badge">
                <Crown className="w-4 h-4" />
                Most Popular
              </div>
            )}
            
            <div className="subscription-option-header">
              <div className="subscription-option-icon">
                {option.icon}
              </div>
              <div className="subscription-option-info">
                <h3 className="subscription-option-name">{option.name}</h3>
                <p className="subscription-option-description">{option.description}</p>
                <div className="subscription-option-price">{option.price}</div>
              </div>
            </div>

            <ul className="subscription-option-features">
              {option.features.map((feature, index) => (
                <li key={index} className="subscription-option-feature">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {data.subscriptionTier === option.id && (
              <div className="subscription-option-selected">
                <Check className="w-5 h-5" />
                Selected
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="onboarding-step-actions">
        <button
          type="button"
          onClick={onPrev}
          className="onboarding-button-secondary"
        >
          Back
        </button>
        
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="onboarding-button-primary"
        >
          Continue
        </button>
      </div>
    </motion.div>
  );
};

export default OnboardingStep7;
