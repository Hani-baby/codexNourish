/**
 * New Auth Context using the robust auth state machine
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, Profile } from './supabase'
import { ensureUserHasHousehold } from './household-service'
import { resolveInitialRoute, BootResult, RouteDestination, AuthState, useAuthStateMachine } from './auth-state-machine'
import { makeCancellable } from './timeout-utils'
import { authCache } from './auth-cache'

interface AuthContextType {
  // Current auth state
  user: User | null
  profile: Profile | null
  session: Session | null
  
  // Boot state
  isBooting: boolean
  isReady: boolean
  bootError: Error | null
  route: RouteDestination | null
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>
  
  // Boot control
  retry: () => Promise<void>
  
  // Performance metrics
  bootMetrics: BootResult['metrics'] | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  
  // Boot state
  const [isBooting, setIsBooting] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [bootError, setBootError] = useState<Error | null>(null)
  const [route, setRoute] = useState<RouteDestination | null>(null)
  const [bootMetrics, setBootMetrics] = useState<BootResult['metrics'] | null>(null)

  // Auth state machine
  const { boot, getState, onStateChange } = useAuthStateMachine()



  // Single boot effect - only boot once on mount
  useEffect(() => {
    console.log('🔧 AuthProvider: Initial mount, starting boot...')
    
    let isMounted = true
    let bootCompleted = false
    
    const performBoot = async () => {
      if (bootCompleted) {
        console.log('🔧 AuthProvider: Boot already completed, skipping')
        return
      }
      
      try {
        const result = await boot()
        
        if (isMounted && !bootCompleted) {
          bootCompleted = true
          console.log('✅ Initial auth boot completed:', {
            route: result.route,
            hasUser: !!result.user,
            hasProfile: !!result.profile,
            bootTime: result.metrics.bootTimeMs + 'ms'
          })

          // Ensure user has a household if they're authenticated
          if (result.user) {
            await ensureUserHasHousehold(result.user.id)
          }

          setUser(result.user)
          setProfile(result.profile)
          setSession(result.session)
          setRoute(result.route)
          setBootMetrics(result.metrics)
          setBootError(result.error || null)
          setIsReady(true)
          setIsBooting(false)
        }
      } catch (error) {
        if (isMounted && !bootCompleted) {
          bootCompleted = true
          console.error('🚨 Initial auth boot failed:', error)
          const err = error instanceof Error ? error : new Error(String(error))
          setBootError(err)
          setRoute('BootError')
          setIsReady(true)
          setIsBooting(false)
        }
      }
    }

    // Helper function to ensure user has a household
    const ensureUserHasHousehold = async (userId: string, retryCount = 0): Promise<string | undefined> => {
      try {
        // Check if user is already in a household
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle()

        if (membership?.household_id) {
          console.log('✅ User already has household:', membership.household_id)
          return membership.household_id
        }

        console.log('🏠 Creating default household for user:', userId)

        // Step 1: Create a default household for the user
        const { data: household, error: householdError } = await supabase
          .from('households')
          .insert({
            name: 'My Household',
            created_by: userId
          })
          .select('id')
          .single()

        if (householdError) {
          // Check if it's a race condition (household created by another request)
          if (retryCount < 2) {
            console.warn('⚠️ Household creation conflict, retrying...', householdError)
            await new Promise(resolve => setTimeout(resolve, 500))
            return ensureUserHasHousehold(userId, retryCount + 1)
          }
          console.error('❌ Failed to create household:', householdError)
          return
        }

        const householdId = household.id

        // Step 2: Add user to household_members as owner
        const { error: memberError } = await supabase
          .from('household_members')
          .insert({
            household_id: householdId,
            user_id: userId,
            role: 'owner',
            status: 'active'
          })

        if (memberError) {
          console.error('❌ Failed to add user to household_members:', memberError)
          // Cleanup: try to delete the household
          await supabase.from('households').delete().eq('id', householdId)
          return
        }

        // Step 3: Create free tier subscription
        const { error: subscriptionError } = await supabase
          .from('household_subscriptions')
          .insert({
            household_id: householdId,
            status: 'active',
            meta: {
              tier: 'free',
              auto_created: true,
              created_at: new Date().toISOString()
            }
          })

        if (subscriptionError) {
          console.error('⚠️ Failed to create subscription (non-fatal):', subscriptionError)
          // Don't fail the whole process - subscription can be added later
        }

        console.log('✅ Created household and added user as owner:', householdId)
        return householdId
      } catch (error) {
        console.error('❌ Error ensuring user has household:', error)
        // Retry on network errors
        if (retryCount < 2 && error instanceof Error && error.message.includes('network')) {
          console.warn('⚠️ Network error, retrying...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          return ensureUserHasHousehold(userId, retryCount + 1)
        }
      }
    }

    // Listen to state changes for subsequent updates
    const unsubscribe = onStateChange((state: AuthState) => {
      console.log('🔄 Auth state changed:', state)
      
      if (state === 'READY' && isMounted && !bootCompleted) {
        // Get the current state from the state machine without triggering another boot
        boot().then(result => {
          if (isMounted && !bootCompleted) {
            bootCompleted = true
            console.log('🔄 Auth context syncing with state machine result')
            setUser(result.user)
            setProfile(result.profile)
            setSession(result.session)
            setRoute(result.route)
            setBootMetrics(result.metrics)
            setBootError(result.error || null)
            setIsReady(true)
            setIsBooting(false)
          }
        }).catch(error => {
          if (isMounted && !bootCompleted) {
            bootCompleted = true
            console.error('🚨 Failed to sync with state machine:', error)
            setBootError(error)
            setRoute('BootError')
            setIsReady(true)
            setIsBooting(false)
          }
        })
      }
    })

    // Start initial boot with a small delay to ensure Supabase is fully initialized
    setTimeout(() => {
      if (isMounted) {
        performBoot()
      }
    }, 100)
    
    return () => {
      console.log('🔧 AuthProvider: Cleanup')
      isMounted = false
      unsubscribe()
    }
  }, []) // No dependencies to prevent re-runs

  // Auth methods
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (!error) {
        // The auth state machine will handle the re-routing
        // via the onAuthStateChange listener
      }
      
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })
      
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (!error) {
        // Clear local state and cache
        setUser(null)
        setProfile(null)
        setSession(null)
        setRoute('Auth')
        authCache.clear()
      }
      
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (!error && profile) {
        const updatedProfile = { ...profile, ...updates }
        setProfile(updatedProfile)
        
        // Update cache with new profile data
        if (user && session) {
          authCache.set(user, updatedProfile, session)
        }
        
        // If onboarding was completed, trigger a re-boot to update routing
        if (updates.onboarding_complete && !profile.onboarding_complete) {
          console.log('🎉 Onboarding completed, re-routing...')
          boot().then(result => {
            setUser(result.user)
            setProfile(result.profile)
            setSession(result.session)
            setRoute(result.route)
            setBootMetrics(result.metrics)
          }).catch(console.error)
        }
      }

      return { error }
    } catch (error) {
      return { error }
    }
  }

  const retry = async () => {
    console.log('🔄 Retrying auth boot...')
    setIsBooting(true)
    setBootError(null)
    setIsReady(false)
    
    try {
      const result = await boot()
      
      setUser(result.user)
      setProfile(result.profile)
      setSession(result.session)
      setRoute(result.route)
      setBootMetrics(result.metrics)
      setBootError(result.error || null)
      setIsReady(true)
    } catch (error) {
      console.error('🚨 Retry failed:', error)
      const err = error instanceof Error ? error : new Error(String(error))
      setBootError(err)
      setRoute('BootError')
      setIsReady(true)
    } finally {
      setIsBooting(false)
    }
  }

  const value: AuthContextType = {
    // Current auth state
    user,
    profile,
    session,
    
    // Boot state
    isBooting,
    isReady,
    bootError,
    route,
    
    // Auth methods
    signIn,
    signUp,
    signOut,
    updateProfile,
    
    // Boot control
    retry,
    
    // Performance metrics
    bootMetrics
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Legacy compatibility hook (for gradual migration)
export function useAuthLegacy() {
  const context = useAuth()
  
  return {
    user: context.user,
    profile: context.profile,
    session: context.session,
    loading: context.isBooting,
    signIn: context.signIn,
    signUp: context.signUp,
    signOut: context.signOut,
    updateProfile: context.updateProfile
  }
}
