/**
 * Enhanced Onboarding Wrapper using the new auth state machine
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context-v2'
import OnboardingWizard from './OnboardingWizard'
import EnhancedLoadingScreen from '../ui/EnhancedLoadingScreen'
import BootErrorFallback from '../ui/BootErrorFallback'

interface OnboardingWrapperProps {
  children: React.ReactNode
}

const OnboardingWrapperV2: React.FC<OnboardingWrapperProps> = ({ children }) => {
  const { 
    user, 
    profile, 
    isBooting, 
    isReady, 
    bootError, 
    route, 
    retry,
    bootMetrics
  } = useAuth()
  
  const navigate = useNavigate()
  const [bootStartTime] = useState(Date.now())

  // Handle routing based on auth state
  useEffect(() => {
    if (!isReady || !route) return

    console.log('🎯 OnboardingWrapper: Routing decision -', {
      route,
      hasUser: !!user,
      hasProfile: !!profile,
      onboardingComplete: profile?.onboarding_complete,
      bootTime: bootMetrics?.bootTimeMs
    })

    switch (route) {
      case 'Auth':
        console.log('🔒 Redirecting to login (no session)')
        navigate('/login', { replace: true })
        break
        
      case 'Onboarding':
        console.log('📝 Showing onboarding (session exists, onboarding incomplete)')
        // Stay on current route, will show OnboardingWizard below
        break
        
      case 'Dashboard':
        console.log('✅ Showing dashboard (session + onboarding complete)')
        // Stay on current route, will show children below
        break
        
      case 'BootError':
        console.log('🚨 Boot error occurred')
        // Will show BootErrorFallback below
        break
    }
  }, [isReady, route, user, profile, navigate, bootMetrics])

  // Show loading during boot process
  if (isBooting) {
    return (
      <EnhancedLoadingScreen
        title="Nourish"
        subtitle="Loading your dashboard..."
        showMascot={true}
        showProgress={false}
        timeoutMs={1500}
        startTime={bootStartTime}
        maxTimeMs={2500}
        onRetry={retry}
        currentStep={getCurrentLoadingStep()}
      />
    )
  }

  // Show boot error fallback
  if (route === 'BootError' || bootError) {
    return (
      <BootErrorFallback
        error={bootError}
        bootTimeMs={bootMetrics?.bootTimeMs}
        onRetry={retry}
        onContinueOffline={() => {
          console.log('🔄 Continuing offline...')
          // Could implement offline mode here
          navigate('/login', { replace: true })
        }}
      />
    )
  }

  // Show loading if not ready yet
  if (!isReady) {
    return (
      <EnhancedLoadingScreen
        title="Nourish"
        subtitle="Finalizing setup..."
        showMascot={true}
        startTime={bootStartTime}
        onRetry={retry}
      />
    )
  }

  // Route to login if no session
  if (route === 'Auth' || !user) {
    return (
      <EnhancedLoadingScreen
        title="Nourish"
        subtitle="Redirecting to login..."
        showMascot={false}
        showProgress={false}
        timeoutMs={500}
      />
    )
  }

  // Show onboarding if needed
  if (route === 'Onboarding' || (user && (!profile || !profile.onboarding_complete))) {
    console.log('📝 OnboardingWrapper: Showing onboarding wizard')
    return <OnboardingWizard />
  }

  // Show main app (user is authenticated and onboarding is complete)
  console.log('✅ OnboardingWrapper: Showing main application')
  return <>{children}</>

  function getCurrentLoadingStep(): string {
    if (!bootMetrics) return "Loading your dashboard..."
    
    switch (bootMetrics.sessionStatus) {
      case 'none':
        return "Checking authentication..."
      case 'ok':
        switch (bootMetrics.profileStatus) {
          case 'ok':
            return "Loading your profile..."
          case 'created':
            return "Setting up your account..."
          case 'timeout':
            return "Profile loading is taking longer than expected..."
          case 'error':
            return "Having trouble loading your profile..."
          default:
            return "Checking your profile..."
        }
      case 'timeout':
        return "Authentication is taking longer than expected..."
      case 'error':
        return "Having trouble with authentication..."
      default:
        return "Loading your dashboard..."
    }
  }
}

export default OnboardingWrapperV2
