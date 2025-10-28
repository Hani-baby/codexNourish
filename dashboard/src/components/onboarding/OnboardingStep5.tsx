import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, PiggyBank, ShoppingCart, CreditCard } from 'lucide-react';
import OnboardingButton from './OnboardingButton';
import OnboardingInput from './OnboardingInput';
import OnboardingSelect from './OnboardingSelect';
import { OnboardingData } from './types';

interface OnboardingStep6Props {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
}

const currencyOptions = [
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'CAD', label: '$ CAD' },
  { value: 'AUD', label: '$ AUD' },
  { value: 'JPY', label: '¥ JPY' }
];

const budgetRanges = [
  { range: '$0-50', min: 0, max: 50, description: 'Ultra Budget' },
  { range: '$50-100', min: 50, max: 100, description: 'Budget Friendly' },
  { range: '$100-200', min: 100, max: 200, description: 'Moderate' },
  { range: '$200-400', min: 200, max: 400, description: 'Comfortable' },
  { range: '$400+', min: 400, max: 1000, description: 'Premium' }
];

const OnboardingStep6: React.FC<OnboardingStep6Props> = ({
  data, updateData, onNext, onPrev, canProceed
}) => {
  const setBudgetRange = (min: number, max: number) => {
    const average = Math.round((min + max) / 2);
    updateData({ monthlyBudget: average });
  };

  const getBudgetRangeLabel = (budget: number) => {
    for (const range of budgetRanges) {
      if (budget >= range.min && budget <= range.max) {
        return range.description;
      }
    }
    return '';
  };

  const currencySymbol = currencyOptions.find(c => c.value === data.budgetCurrency)?.label.charAt(0) || '$';

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
            <PiggyBank size={32} />
          </motion.div>
          <h2 className="onboarding-step-title">What's your food budget?</h2>
          <p className="onboarding-step-subtitle">
            This is optional, but helps us suggest recipes that fit your budget and find the best deals.
          </p>
        </div>

        {/* Budget Options */}
        <div style={{ maxWidth: '600px', margin: '0 auto', marginBottom: 'var(--onboarding-space-6)' }}>
          {/* Currency Selection */}
          <div style={{ marginBottom: 'var(--onboarding-space-6)' }}>
            <label className="onboarding-label">Currency</label>
            <OnboardingSelect
              value={data.budgetCurrency}
              onChange={(value) => updateData({ budgetCurrency: value })}
              options={currencyOptions}
            />
          </div>

          {/* Quick Budget Ranges */}
          <div style={{ marginBottom: 'var(--onboarding-space-6)' }}>
            <label className="onboarding-label" style={{ marginBottom: 'var(--onboarding-space-4)' }}>
              Monthly Food Budget
            </label>
            <div className="onboarding-budget-grid">
              {budgetRanges.map((range, index) => {
                const isSelected = data.monthlyBudget && 
                  data.monthlyBudget >= range.min && 
                  data.monthlyBudget <= range.max;
                
                return (
                  <motion.button
                    key={range.range}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    onClick={() => setBudgetRange(range.min, range.max)}
                    className={`onboarding-budget-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="onboarding-budget-icon">
                      {index === 0 && <ShoppingCart size={20} />}
                      {index === 1 && <CreditCard size={20} />}
                      {index === 2 && <DollarSign size={20} />}
                      {index === 3 && <PiggyBank size={20} />}
                      {index === 4 && <DollarSign size={20} />}
                    </div>
                    <div className="onboarding-budget-range">
                      {range.range.replace('$', currencySymbol)}
                    </div>
                    <div className="onboarding-budget-label">
                      {range.description}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Custom Budget Input */}
          <div style={{ marginBottom: 'var(--onboarding-space-6)' }}>
            <label className="onboarding-label">Or enter a custom amount</label>
            <div style={{ position: 'relative', maxWidth: '200px' }}>
              <span style={{ 
                position: 'absolute', 
                left: 'var(--onboarding-space-3)', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--onboarding-text-muted)',
                zIndex: 2
              }}>
                {currencySymbol}
              </span>
              <OnboardingInput
                type="number"
                placeholder="200"
                value={data.monthlyBudget || ''}
                onChange={(e) => updateData({ monthlyBudget: parseInt(e.target.value) || undefined })}
                min="0"
                max="10000"
              />
            </div>
            {data.monthlyBudget && (
              <p style={{ fontSize: '0.875rem', color: 'var(--onboarding-brand)', marginTop: 'var(--onboarding-space-2)' }}>
                {currencySymbol}{data.monthlyBudget}/month • {getBudgetRangeLabel(data.monthlyBudget)}
              </p>
            )}
          </div>

          {/* Skip Option */}
          <div style={{ textAlign: 'center', paddingTop: 'var(--onboarding-space-4)' }}>
            <button
              onClick={() => updateData({ monthlyBudget: undefined })}
              style={{ 
                color: 'var(--onboarding-text-muted)', 
                background: 'none', 
                border: 'none', 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Skip this step - I'll set it later
            </button>
          </div>

          {/* Budget Benefits */}
          <div className="onboarding-info-box">
            <h3 className="onboarding-info-title">Why set a budget?</h3>
            <ul className="onboarding-info-list">
              <li>• Get recipes that match your spending habits</li>
              <li>• Receive deals and discounts on ingredients</li>
              <li>• Track your food expenses over time</li>
              <li>• Get budget-friendly meal planning suggestions</li>
            </ul>
          </div>
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

export default OnboardingStep6;