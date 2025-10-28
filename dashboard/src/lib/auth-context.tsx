import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, Profile } from './supabase'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session (handles page refresh/reload)
    console.log('🔄 AuthProvider: Checking for existing session...')
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔄 AuthProvider: Session check result:', session ? 'Found active session' : 'No session found')
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('🔄 AuthProvider: Loading profile for existing session user:', session.user.id)
        loadProfile(session.user.id)
      } else {
        console.log('🔄 AuthProvider: No user in session, marking auth as loaded')
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId: string) => {
    try {
      console.log('Loading profile for user:', userId)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile loading timeout')), 10000)
      );
      
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) {
        console.error('Error loading profile:', error)
        console.error('Error details:', error.message, error.code, error.details)
        
        // If no profile exists, create one
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...')
          await createProfile(userId)
        } else if (error.code === '42501' || error.code === 'PGRST301') {
          // Permission denied errors - continue without profile
          console.warn('Profile access denied due to permissions, continuing without profile')
          setProfile(null)
          setLoading(false)
        } else {
          console.error('Unknown profile loading error, continuing without profile')
          setProfile(null)
          setLoading(false)
        }
      } else {
        console.log('Profile loaded successfully:', data)
        setProfile(data)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error in loadProfile:', error)
      setProfile(null)
      setLoading(false)
    }
  }

  const createProfile = async (userId: string) => {
    try {
      const userData = user || await supabase.auth.getUser().then(({ data }) => data.user)
      
      const profileData = {
        id: userId,
        display_name: userData?.user_metadata?.display_name || userData?.email?.split('@')[0] || null,
        avatar_url: null,
        date_of_birth: null,
        gender: null,
        height_cm: null,
        weight_kg: null,
        onboarding_complete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log('Creating profile with data:', profileData)
      
      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (error) {
        console.error('Error creating profile:', error)
        console.error('Error details:', error.message, error.code, error.details)
        
        // If it's a permission error, try to continue without profile
        if (error.code === '42501' || error.code === 'PGRST301') {
          console.warn('Profile creation failed due to permissions, continuing without profile')
          setProfile(null)
          setLoading(false)
          return
        }
      } else {
        console.log('Profile created successfully:', data)
        setProfile(data)
      }
      
      // Always set loading to false after createProfile attempt
      setLoading(false)
    } catch (error) {
      console.error('Error in createProfile:', error)
      setProfile(null)
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setProfile(null)
    }
    return { error }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (!error && profile) {
      setProfile({ ...profile, ...updates })
    }

    return { error }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
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