/**
 * Robust Auth State Machine with timeouts, retries, and fallbacks
 */

import { User, Session } from '@supabase/supabase-js'
import { supabase, Profile } from './supabase'
import { withDeadline, withRetry, PerfTimer, TimeoutError, RetryError } from './timeout-utils'
import { authCache } from './auth-cache'

// Auth States
export type AuthState = 
  | 'BOOT'
  | 'RESOLVING_SESSION' 
  | 'SESSION_ABSENT'
  | 'SESSION_PRESENT'
  | 'PROFILE_CHECK'
  | 'ONBOARDING_REQUIRED'
  | 'ROUTE_DASHBOARD'
  | 'BOOT_ERROR'
  | 'READY'

// Route destinations
export type RouteDestination = 'Auth' | 'Onboarding' | 'Dashboard' | 'BootError'

// Boot result
export interface BootResult {
  route: RouteDestination
  user: User | null
  profile: Profile | null
  session: Session | null
  error?: Error
  metrics: {
    bootTimeMs: number
    sessionStatus: 'none' | 'ok' | 'timeout' | 'error'
    profileStatus: 'ok' | 'created' | 'timeout' | 'error' | 'skipped'
    retryCount: number
  }
}

// Telemetry data
interface TelemetryData {
  operation: string
  totalMs: number
  marks: Record<string, number>
  sessionStatus: string
  profileStatus: string
  finalRoute: string
  retryCount: number
  error?: string
}

class AuthStateMachine {
  private state: AuthState = 'BOOT'
  private listeners: Set<(state: AuthState) => void> = new Set()
  private bootPromise: Promise<BootResult> | null = null
  private authSubscription: any = null

  private isListenerReady = false

  constructor() {
    this.initializeAuthListener()
  }

  private setState(newState: AuthState): void {
    if (this.state !== newState) {
      console.log(`🔄 Auth State: ${this.state} → ${newState}`)
      this.state = newState
      this.listeners.forEach(listener => listener(newState))
    }
  }

  public getState(): AuthState {
    return this.state
  }

  public onStateChange(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private initializeAuthListener(): void {
    // Single auth listener to avoid duplicates
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
    }

    console.log('🎧 Initializing auth state listener...')
    this.authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
      // Mark listener as ready after first event
      if (!this.isListenerReady) {
        this.isListenerReady = true
        console.log('🎧 Auth listener is now ready')
      }
      console.log(`🔐 Auth Event: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id,
        currentState: this.state,
        timestamp: new Date().toISOString()
      })
      
      // Handle auth events that should trigger re-routing
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('🔄 Auth event requires re-boot, current state:', this.state)
        
        // Only trigger re-boot if we're not already booting
        if (this.state !== 'BOOT' && this.state !== 'RESOLVING_SESSION') {
          this.bootPromise = null
          this.boot().catch(error => {
            console.error('🚨 Failed to boot after auth event:', error)
          })
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out, clearing state')
        authCache.clear()
        this.setState('SESSION_ABSENT')
        this.setState('READY')
      } else if (event === 'INITIAL_SESSION') {
        console.log('🏁 Initial session event:', {
          hasSession: !!session,
          userId: session?.user?.id,
          currentState: this.state
        })
        
        // Only handle initial session if we're not already booting
        // This prevents multiple concurrent boot processes
        if (this.state === 'BOOT' || this.state === 'RESOLVING_SESSION') {
          console.log('🔄 Initial session detected during boot, will be handled by current boot process')
        } else if (session) {
          console.log('🚀 Initial session detected after boot, triggering re-boot with session')
          this.bootPromise = null
          this.boot().catch(error => {
            console.error('🚨 Failed to boot after initial session:', error)
          })
        }
      }
    })
  }

  public async boot(): Promise<BootResult> {
    // Return existing boot promise if already running
    if (this.bootPromise) {
      return this.bootPromise
    }

    // Wait for auth listener to be ready (max 500ms)
    const listenerTimeout = Date.now() + 500
    while (!this.isListenerReady && Date.now() < listenerTimeout) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    if (!this.isListenerReady) {
      console.warn('⚠️ Auth listener not ready, proceeding anyway')
    }

    const timer = new PerfTimer('auth_boot')
    let retryCount = 0
    
    this.bootPromise = this.performBoot(timer, retryCount)
    return this.bootPromise
  }

  private async performBoot(timer: PerfTimer, retryCount: number): Promise<BootResult> {
    try {
      this.setState('BOOT')
      timer.mark('boot_start')

      // Check cache first for fast navigation
      const cached = authCache.get()
      if (cached && cached.isValid && cached.session && cached.user) {
        // Validate that the cached session is still valid
        const now = Date.now()
        const sessionExpiry = cached.session.expires_at ? new Date(cached.session.expires_at).getTime() : 0
        
        if (sessionExpiry > now) {
          console.log('🚀 Using cached auth state, skipping boot')
          timer.mark('cache_hit')
          
          const result = this.createBootResult({
            route: cached.profile?.onboarding_complete ? 'Dashboard' : 'Onboarding',
            user: cached.user,
            profile: cached.profile,
            session: cached.session,
            timer,
            sessionStatus: 'ok',
            profileStatus: 'ok',
            retryCount: 0
          })

          this.setState('READY')
          this.logTelemetry(result)
          return result
        } else {
          console.log('🗑️ Cached session expired, clearing cache')
          authCache.clear()
        }
      }
      
      if (cached) {
        console.log('📦 Cache exists but not used:', {
          hasUser: !!cached.user,
          hasProfile: !!cached.profile,
          hasSession: !!cached.session,
          isValid: cached.isValid,
          age: Math.round((Date.now() - cached.timestamp) / 1000) + 's',
          sessionExpired: cached.session ? new Date(cached.session.expires_at || 0) < new Date() : 'no session'
        })
      }

      this.setState('RESOLVING_SESSION')
      timer.mark('session_start')

      // Get session with timeout and retry
      const { session, sessionStatus } = await this.getSessionWithRetry()
      timer.mark('session_end')

      if (!session) {
        this.setState('SESSION_ABSENT')
        this.setState('READY')
        
        const result = this.createBootResult({
          route: 'Auth',
          user: null,
          profile: null,
          session: null,
          timer,
          sessionStatus,
          profileStatus: 'skipped',
          retryCount
        })

        this.logTelemetry(result)
        return result
      }

      this.setState('SESSION_PRESENT')
      this.setState('PROFILE_CHECK')
      timer.mark('profile_start')

      // Get or create profile with timeout
      const { profile, profileStatus } = await this.getOrCreateProfile(session.user.id)
      timer.mark('profile_end')

      // Determine route based on profile
      let route: RouteDestination
      if (!profile || !profile.onboarding_complete) {
        route = 'Onboarding'
        this.setState('ONBOARDING_REQUIRED')
      } else {
        route = 'Dashboard'
        this.setState('ROUTE_DASHBOARD')
      }

      this.setState('READY')

      const result = this.createBootResult({
        route,
        user: session.user,
        profile,
        session,
        timer,
        sessionStatus,
        profileStatus,
        retryCount
      })

      // Cache successful auth state for fast navigation
      if (route !== 'BootError' && session?.user && profile) {
        authCache.set(session.user, profile, session)
      }

      this.logTelemetry(result)
      return result

    } catch (error) {
      console.error('🚨 Boot failed:', error)
      this.setState('BOOT_ERROR')
      
      const result = this.createBootResult({
        route: 'BootError',
        user: null,
        profile: null,
        session: null,
        timer,
        sessionStatus: 'error',
        profileStatus: 'error',
        retryCount,
        error: error instanceof Error ? error : new Error(String(error))
      })

      this.logTelemetry(result)
      return result
    }
  }

  private async getSessionWithRetry(): Promise<{
    session: Session | null
    sessionStatus: 'none' | 'ok' | 'timeout' | 'error'
  }> {
    try {
      console.log('🔍 Getting session from Supabase...')
      
      // Wait for Supabase to fully initialize and restore session from localStorage
      // This is crucial for detecting existing sessions on page refresh
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const { data: { session }, error } = await withRetry(
        async () => {
          // Give Supabase more time to detect existing sessions
          const result = await withDeadline(supabase.auth.getSession(), 3000, 'getSession')
          
          // If no session found, wait a bit more and try once more
          // This handles cases where localStorage session needs time to be restored
          if (!result.data.session) {
            console.log('🔍 No session found, waiting for potential session restoration...')
            await new Promise(resolve => setTimeout(resolve, 500))
            return await withDeadline(supabase.auth.getSession(), 2000, 'getSession')
          }
          
          return result
        },
        {
          maxAttempts: 4,
          baseDelayMs: 300,
          operation: 'getSession',
          shouldRetry: (error) => {
            // Retry on timeouts, network errors, or if we're still initializing
            return error instanceof TimeoutError || 
                   error.message.includes('network') ||
                   error.message.includes('initializing') ||
                   error.message.includes('Failed to fetch')
          }
        }
      )

      console.log('🔍 Session result:', {
        hasSession: !!session,
        userId: session?.user?.id,
        expiresAt: session?.expires_at,
        accessToken: session?.access_token ? 'present' : 'missing',
        error: error?.message
      })

      if (error) {
        console.error('Session fetch error:', error)
        return {
          session: null,
          sessionStatus: 'error'
        }
      }

      return {
        session,
        sessionStatus: session ? 'ok' : 'none'
      }
    } catch (error) {
      console.error('Failed to get session:', error)
      return {
        session: null,
        sessionStatus: error instanceof TimeoutError ? 'timeout' : 'error'
      }
    }
  }

  private async getOrCreateProfile(userId: string): Promise<{
    profile: Profile | null
    profileStatus: 'ok' | 'created' | 'timeout' | 'error'
  }> {
    try {
      // First, try to get existing profile
      const { data: profile, error } = await withDeadline(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        700,
        'profileFetch'
      )

      if (error) {
        // Profile doesn't exist (PGRST116), create minimal profile
        if (error.code === 'PGRST116') {
          console.log('📝 Creating minimal profile for user:', userId)
          
          const { data: user } = await supabase.auth.getUser()
          const userData = user.user

          const profileData = {
            id: userId,
            display_name: userData?.user_metadata?.display_name || 
                         userData?.email?.split('@')[0] || 
                         null,
            avatar_url: null,
            date_of_birth: null,
            gender: null,
            height_cm: null,
            weight_kg: null,
            onboarding_complete: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { data: newProfile, error: createError } = await withDeadline(
            supabase
              .from('profiles')
              .insert(profileData)
              .select()
              .single(),
            1000,
            'profileCreate'
          )

          if (createError) {
            console.error('Failed to create profile:', createError)
            return { profile: null, profileStatus: 'error' }
          }

          return { profile: newProfile, profileStatus: 'created' }
        }

        // Other errors (permissions, etc.)
        console.error('Profile fetch error:', error)
        return { profile: null, profileStatus: 'error' }
      }

      return { profile, profileStatus: 'ok' }

    } catch (error) {
      console.error('Profile operation failed:', error)
      return {
        profile: null,
        profileStatus: error instanceof TimeoutError ? 'timeout' : 'error'
      }
    }
  }

  private createBootResult({
    route,
    user,
    profile,
    session,
    timer,
    sessionStatus,
    profileStatus,
    retryCount,
    error
  }: {
    route: RouteDestination
    user: User | null
    profile: Profile | null
    session: Session | null
    timer: PerfTimer
    sessionStatus: string
    profileStatus: string
    retryCount: number
    error?: Error
  }): BootResult {
    const metrics = timer.finish()

    return {
      route,
      user,
      profile,
      session,
      error,
      metrics: {
        bootTimeMs: metrics.totalMs,
        sessionStatus: sessionStatus as any,
        profileStatus: profileStatus as any,
        retryCount
      }
    }
  }

  private logTelemetry(result: BootResult): void {
    const telemetry: TelemetryData = {
      operation: 'auth_boot',
      totalMs: result.metrics.bootTimeMs,
      marks: {},
      sessionStatus: result.metrics.sessionStatus,
      profileStatus: result.metrics.profileStatus,
      finalRoute: result.route,
      retryCount: result.metrics.retryCount,
      error: result.error?.message
    }

    // Log performance metrics
    console.log('📊 Auth Boot Telemetry:', telemetry)

    // Log warnings for slow operations
    if (result.metrics.bootTimeMs > 1200) {
      console.warn('⚠️ Slow boot time:', result.metrics.bootTimeMs + 'ms')
    }

    if (result.metrics.bootTimeMs > 2500) {
      console.error('🚨 Very slow boot time:', result.metrics.bootTimeMs + 'ms')
    }
  }

  public destroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
      this.authSubscription = null
    }
    this.listeners.clear()
    this.bootPromise = null
  }
}

// Singleton instance
export const authStateMachine = new AuthStateMachine()

// Route resolver function
export async function resolveInitialRoute(): Promise<BootResult> {
  return authStateMachine.boot()
}

// Hook for components to use auth state machine
export function useAuthStateMachine() {
  return {
    boot: () => authStateMachine.boot(),
    getState: () => authStateMachine.getState(),
    onStateChange: (listener: (state: AuthState) => void) => authStateMachine.onStateChange(listener)
  }
}
