/**
 * Auth state caching to avoid unnecessary reloads during navigation
 */

import { User, Session } from '@supabase/supabase-js'
import { Profile } from './supabase'

interface CachedAuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  timestamp: number
  isValid: boolean
}

const CACHE_KEY = 'nourish-auth-cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

class AuthCache {
  private cache: CachedAuthState | null = null

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CACHE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const now = Date.now()
        
        // Check if cache is still valid
        if (parsed.timestamp && (now - parsed.timestamp) < CACHE_TTL) {
          this.cache = parsed
          console.log('📦 Auth cache loaded from storage:', {
            hasUser: !!parsed.user,
            hasProfile: !!parsed.profile,
            age: Math.round((now - parsed.timestamp) / 1000) + 's'
          })
        } else {
          console.log('📦 Auth cache expired, clearing...')
          this.clear()
        }
      }
    } catch (error) {
      console.warn('Failed to load auth cache:', error)
      this.clear()
    }
  }

  private saveToStorage(): void {
    try {
      if (this.cache) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(this.cache))
      }
    } catch (error) {
      console.warn('Failed to save auth cache:', error)
    }
  }

  public set(user: User | null, profile: Profile | null, session: Session | null): void {
    this.cache = {
      user,
      profile,
      session,
      timestamp: Date.now(),
      isValid: true
    }
    
    console.log('📦 Auth cache updated:', {
      hasUser: !!user,
      hasProfile: !!profile,
      hasSession: !!session
    })
    
    this.saveToStorage()
  }

  public get(): CachedAuthState | null {
    if (!this.cache) return null

    const now = Date.now()
    const age = now - this.cache.timestamp

    // Check if cache is still valid
    if (age > CACHE_TTL) {
      console.log('📦 Auth cache expired')
      this.clear()
      return null
    }

    // Check if session is expired
    if (this.cache.session) {
      const sessionExpiry = this.cache.session.expires_at ? new Date(this.cache.session.expires_at).getTime() : 0
      if (sessionExpiry > 0 && sessionExpiry <= now) {
        console.log('📦 Cached session expired, clearing cache')
        this.clear()
        return null
      }
    }

    console.log('📦 Auth cache hit:', {
      hasUser: !!this.cache.user,
      hasProfile: !!this.cache.profile,
      hasSession: !!this.cache.session,
      age: Math.round(age / 1000) + 's',
      sessionExpiry: this.cache.session?.expires_at
    })

    return this.cache
  }

  public clear(): void {
    this.cache = null
    try {
      localStorage.removeItem(CACHE_KEY)
      console.log('📦 Auth cache cleared')
    } catch (error) {
      console.warn('Failed to clear auth cache:', error)
    }
  }

  public isValid(): boolean {
    const cached = this.get()
    return cached ? cached.isValid : false
  }

  public invalidate(): void {
    if (this.cache) {
      this.cache.isValid = false
      this.saveToStorage()
      console.log('📦 Auth cache invalidated')
    }
  }

  public getCacheAge(): number {
    if (!this.cache) return -1
    return Date.now() - this.cache.timestamp
  }
}

export const authCache = new AuthCache()

export function useAuthCache() {
  return {
    get: () => authCache.get(),
    set: (user: User | null, profile: Profile | null, session: Session | null) => 
      authCache.set(user, profile, session),
    clear: () => authCache.clear(),
    isValid: () => authCache.isValid(),
    invalidate: () => authCache.invalidate(),
    getCacheAge: () => authCache.getCacheAge()
  }
}
