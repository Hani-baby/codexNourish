export interface OnboardingData {
  // Step 1: Basic info
  username?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  
  // Step 2: Goals
  goals: string[];
  
  // Step 3: Allergies & Restrictions
  hasRestrictions: boolean;
  allergies: string[];
  customAllergies: string[];
  
  // Step 4: Preferences
  likedFoods: string[];
  dislikedFoods: string[];
  customLikes: string[];
  customDislikes: string[];
  
  // Step 5: Dietary Preferences (OnboardingStep5New)
  dietaryTags: string[];
  cuisinePrefs: string[];
  
  // Step 6: Budget
  monthlyBudget?: number;
  budgetCurrency: string;
  
  // Step 7: Subscription/Tier Selection
  subscription?: string;
  subscriptionTier?: 'free' | 'individual' | 'family';
  
  // Step 8: Review & Confirm
  completed: boolean;
}

export interface OnboardingStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
}
