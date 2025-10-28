import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import OnboardingWizard from './OnboardingWizard';
import LoadingScreen from '../ui/LoadingScreen';

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect unauthenticated users (must be declared before any conditional returns)
  useEffect(() => {
    if (!loading && !user) {
      console.log('🔒 OnboardingWrapper: No authenticated user, redirecting to login')
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // Debug logging for refresh scenarios
  useEffect(() => {
    console.log('🎯 OnboardingWrapper: State check -', {
      loading,
      hasUser: !!user,
      hasProfile: !!profile,
      onboardingComplete: profile?.onboarding_complete
    });
  }, [loading, user, profile]);

  // Show loading while auth is initializing
  if (loading) {
    return (
      <LoadingScreen 
        title="Nourish"
        subtitle="Loading your dashboard..."
      />
    );
  }

  if (!user) {
    return (
      <LoadingScreen 
        title="Nourish"
        subtitle="Redirecting to login..."
      />
    );
  }

  // If profile is still null, keep showing a lightweight loader (avoid hook order issues)
  if (!profile) {
    return (
      <LoadingScreen 
        title="Nourish"
        subtitle="Loading your profile..."
        showProgress={true}
      />
    );
  }

  // If onboarding is not complete, show the wizard
  if (!profile.onboarding_complete) {
    console.log('📝 OnboardingWrapper: Showing onboarding wizard (onboarding_complete = false)')
    return <OnboardingWizard />;
  }

  // User is authenticated and onboarding is complete, show main app
  console.log('✅ OnboardingWrapper: Showing dashboard (user authenticated & onboarding complete)')
  return <>{children}</>;
};

export default OnboardingWrapper;
