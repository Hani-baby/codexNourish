import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2';
import { useTheme } from '../../lib/theme-context';
import { supabase } from '../../lib/supabase';
import { CheckCircle } from 'lucide-react';
import OnboardingStep1 from './OnboardingStep1';
import OnboardingStep2 from './OnboardingStep2';
import OnboardingStep3 from './OnboardingStep3';
import OnboardingStep4 from './OnboardingStep4';
import OnboardingStep5 from './OnboardingStep5'; // This is the budget step
import OnboardingStep5New from './OnboardingStep5New'; // This is the dietary preferences step
import OnboardingStep6 from './OnboardingStep6'; // This is the review step
import OnboardingStep7 from './OnboardingStep7'; // This is the subscription selection step
import OnboardingStep8 from './OnboardingStep8'; // This is the final review step
import { OnboardingData } from './types';
import './onboarding.css';

const TOTAL_STEPS = 8;

const OnboardingWizard: React.FC = () => {
  const { user, updateProfile, profile } = useAuth();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    goals: [],
    hasRestrictions: false,
    allergies: [],
    customAllergies: [],
    likedFoods: [],
    dislikedFoods: [],
    customLikes: [],
    customDislikes: [],
    dietaryTags: [],
    cuisinePrefs: [],
    budgetCurrency: 'CAD',
    completed: false
  });

  const updateOnboardingData = (data: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!(onboardingData.dateOfBirth && onboardingData.gender && onboardingData.height);
      case 2:
        return onboardingData.goals.length > 0;
      case 3:
        return onboardingData.hasRestrictions !== undefined;
      case 4:
        return true; // Optional step - food preferences
      case 5:
        return true; // Optional step - dietary tags and cuisines
      case 6:
        return true; // Optional step - budget
      case 7:
        return !!onboardingData.subscriptionTier; // Required step - subscription selection
      case 8:
        return true; // Review step
      default:
        return false;
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      console.log('Starting onboarding completion...');
      
      // Try to save data, but continue even if there are permission errors
      let profileSaved = false;
      let metricsSaved = false;
      let settingsSaved = false;

      // 1. Try to update/create profile
      try {
        const profileData = {
          id: user.id,
          display_name: onboardingData.username || null,
          avatar_url: null,
          date_of_birth: onboardingData.dateOfBirth ? new Date(onboardingData.dateOfBirth).toISOString().split('T')[0] : null,
          gender: onboardingData.gender,
          height_cm: onboardingData.height,
          weight_kg: onboardingData.weight || null,
          subscription: onboardingData.subscription || 'free',
          onboarding_complete: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Saving profile with data:', profileData);
        
        // Try using updateProfile first
        if (profile) {
          const { error: updateError } = await updateProfile({
            display_name: profileData.display_name,
            date_of_birth: profileData.date_of_birth,
            gender: profileData.gender,
            height_cm: profileData.height_cm,
            weight_kg: profileData.weight_kg,
            subscription: profileData.subscription,
            onboarding_complete: true
          });
          
          if (updateError) {
            console.warn('Profile update failed, trying direct insert/upsert:', updateError);
            // Try direct database upsert as fallback
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert(profileData, { onConflict: 'id' });
            
            if (upsertError) {
              console.error('Profile upsert also failed:', upsertError);
            } else {
              profileSaved = true;
              console.log('Profile saved via direct upsert');
            }
          } else {
            profileSaved = true;
            console.log('Profile updated successfully via updateProfile');
          }
        } else {
          // No existing profile, try to create one
          const { error: insertError } = await supabase
            .from('profiles')
            .insert(profileData);
          
          if (insertError) {
            console.error('Profile insert failed:', insertError);
          } else {
            profileSaved = true;
            console.log('Profile created successfully');
          }
        }
      } catch (profileError) {
        console.error('Profile operation failed:', profileError);
      }

      // 2. Try to insert user_body_metrics if weight or height is provided
      if (onboardingData.weight || onboardingData.height) {
        try {
          console.log('Inserting body metrics...');
          const { error: metricsError } = await supabase
            .from('user_body_metrics')
            .insert({
              user_id: user.id,
              height_cm: onboardingData.height,
              weight_kg: onboardingData.weight,
              source: 'onboarding'
            });
          
          if (metricsError) {
            console.error('Body metrics error:', metricsError);
          } else {
            metricsSaved = true;
            console.log('Body metrics inserted successfully');
          }
        } catch (metricsError) {
          console.error('Body metrics operation failed:', metricsError);
        }
      }

      // 3. Try to update household subscription tier based on selected plan
      try {
        console.log('Updating household subscription tier...');
        
        // Get user's household
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (membership?.household_id) {
          const selectedTier = onboardingData.subscriptionTier || onboardingData.subscription || 'free';
          
          // Update the household subscription with the selected tier
          const { error: subError } = await supabase
            .from('household_subscriptions')
            .update({
              meta: {
                tier: selectedTier,
                updated_from_onboarding: true,
                onboarding_date: new Date().toISOString()
              }
            })
            .eq('household_id', membership.household_id);

          if (subError) {
            console.error('Failed to update household subscription:', subError);
          } else {
            console.log(`Household subscription updated to ${selectedTier} tier`);
          }
        } else {
          console.warn('User has no household membership - subscription tier not updated');
        }
      } catch (subError) {
        console.error('Household subscription update failed:', subError);
      }

      // 4. Try to insert user_settings
      try {
        const settingsData = {
          user_id: user.id,
          dietary_tags: onboardingData.dietaryTags || [],
          allergens: [...(onboardingData.allergies || []), ...(onboardingData.customAllergies || [])],
          disliked_ingredients: [...(onboardingData.dislikedFoods || []), ...(onboardingData.customDislikes || [])],
          cuisine_prefs: onboardingData.cuisinePrefs || [],
          budget_cad: onboardingData.budgetCurrency === 'CAD' ? onboardingData.monthlyBudget : null,
          calorie_target: null,
          macro_split: null
        };

        console.log('Inserting user settings with data:', settingsData);
        const { error: settingsError } = await supabase
          .from('user_settings')
          .upsert(settingsData, { onConflict: 'user_id' });
        
        if (settingsError) {
          console.error('Settings error:', settingsError);
        } else {
          settingsSaved = true;
          console.log('User settings saved successfully');
        }
      } catch (settingsError) {
        console.error('Settings operation failed:', settingsError);
      }

      // 5. Try to upsert an open nutrition goal for the user
      let goalsSaved = false;
      if (onboardingData.goals && onboardingData.goals.length > 0) {
        try {
          console.log('Upserting nutrition goals...');

          const strategy =
            onboardingData.goals.includes('muscle_gain') ? 'muscle_gain' :
            onboardingData.goals.includes('weight_loss') ? 'weight_loss' :
            onboardingData.goals.includes('maintenance') ? 'maintenance' :
            'custom';

          // Close any existing open goal first (end_date is null)
          await supabase
            .from('nutrition_goals')
            .update({ end_date: new Date().toISOString().split('T')[0] })
            .eq('user_id', user.id)
            .is('end_date', null);

          const goalsData = {
            user_id: user.id,
            start_date: new Date().toISOString().split('T')[0],
            end_date: null,
            strategy,
            calories_kcal: null,
            protein_g: null,
            carbs_g: null,
            fat_g: null,
            fiber_g: null,
            sugar_g: null,
            sodium_mg: null
          };

          const { error: goalsError } = await supabase
            .from('nutrition_goals')
            .insert(goalsData);

          if (goalsError) {
            console.error('Nutrition goals error:', goalsError);
          } else {
            goalsSaved = true;
            console.log('Nutrition goals saved successfully');
          }
        } catch (goalsError) {
          console.error('Nutrition goals operation failed:', goalsError);
        }
      }

      // Log results
      console.log('Onboarding completion results:', {
        profileSaved,
        metricsSaved,
        settingsSaved,
        goalsSaved
      });

      // Log completion status
      console.log('Onboarding data save completed:', {
        profileSaved,
        metricsSaved,
        settingsSaved,
        goalsSaved
      });
      
      // Mark onboarding as complete locally (this will trigger redirect via OnboardingWrapper)
      setOnboardingData(prev => ({ ...prev, completed: true }));
      
    } catch (error) {
      console.error('Critical error completing onboarding:', error);
      // Still try to proceed to dashboard even if there are errors
      alert(`Some information couldn't be saved, but you can still proceed. You can update your profile later in settings.`);
      
      // Continue to dashboard even with errors
      console.log('Proceeding to dashboard despite errors');
      
      setOnboardingData(prev => ({ ...prev, completed: true }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    const stepProps = {
      data: onboardingData,
      updateData: updateOnboardingData,
      onNext: nextStep,
      onPrev: prevStep,
      canProceed: validateCurrentStep()
    };

    switch (currentStep) {
      case 1:
        return <OnboardingStep1 {...stepProps} />;
      case 2:
        return <OnboardingStep2 {...stepProps} />;
      case 3:
        return <OnboardingStep3 {...stepProps} />;
      case 4:
        return <OnboardingStep4 {...stepProps} />;
      case 5:
        return <OnboardingStep5New {...stepProps} />;
      case 6:
        return <OnboardingStep5 {...stepProps} />;
      case 7:
        return <OnboardingStep7 {...stepProps} />;
      case 8:
        return <OnboardingStep8 {...stepProps} onComplete={completeOnboarding} isSubmitting={isSubmitting} />;
      default:
        return null;
    }
  };

  if (onboardingData.completed) {
    return (
      <div className="onboarding-container onboarding-main" data-theme={theme}>
        <div className="onboarding-content">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="onboarding-completion"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="onboarding-completion-icon"
            >
              <CheckCircle size={48} />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="onboarding-completion-title"
            >
              Welcome to Nourish! 🌱
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="onboarding-completion-message"
            >
              Your personalized nutrition dashboard is ready. Let's start your healthy journey!
            </motion.p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-container onboarding-main" data-theme={theme}>
      <div className="onboarding-content">
        {/* Progress Header */}
        <div className="onboarding-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--onboarding-space-4)' }}>
            <h1 className="onboarding-title">Welcome to Nourish</h1>
            <span className="onboarding-step-info">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="onboarding-progress-bar">
            <motion.div
              className="onboarding-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="onboarding-indicators">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
              <div
                key={step}
                className={`onboarding-indicator ${
                  step < currentStep
                    ? 'completed'
                    : step === currentStep
                    ? 'current'
                    : 'pending'
                }`}
              >
                {step < currentStep ? <CheckCircle size={16} /> : step}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingWizard;
