import { createClient } from '@supabase/supabase-js'

// These should be environment variables in production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.error('Please create a .env file with:')
  console.error('VITE_SUPABASE_URL=https://your-project-ref.supabase.co')
  console.error('VITE_SUPABASE_ANON_KEY=your-anon-key-here')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'nourish-auth-token',
    flowType: 'pkce'
  },
  global: { 
    headers: { 'x-client-info': 'nourish-web' } 
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Enhanced Supabase client with real-time capabilities
export const createRealtimeSubscription = (table: string, callback: (payload: any) => void) => {
  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: table 
      }, 
      callback
    )
    .subscribe()
}

// Real-time subscription for meal plans
export const subscribeToMealPlans = (userId: string, callback: (payload: any) => void) => {
  return supabase
    .channel('meal_plans_changes')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'meal_plans',
        filter: `user_id=eq.${userId}`
      }, 
      callback
    )
    .subscribe()
}

// Real-time subscription for conversations
export const subscribeToConversations = (userId: string, callback: (payload: any) => void) => {
  return supabase
    .channel('conversations_changes')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'ai_conversations',
        filter: `owner_user_id=eq.${userId}`
      }, 
      callback
    )
    .subscribe()
}

// Real-time subscription for messages
export const subscribeToMessages = (conversationId: string, callback: (payload: any) => void) => {
  return supabase
    .channel('messages_changes')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'ai_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, 
      callback
    )
    .subscribe()
}

// Real-time subscription for job status
export const subscribeToJobStatus = (jobId: string, callback: (payload: any) => void) => {
  return supabase
    .channel('job_status_changes')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'async_jobs',
        filter: `id=eq.${jobId}`
      }, 
      callback
    )
    .subscribe()
}

// Types based on the database schema
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          display_name: string | null
          avatar_url: string | null
          date_of_birth: string | null
          gender: string | null
          height_cm: number | null
          weight_kg: number | null
          onboarding_complete: boolean
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: string | null
          height_cm?: number | null
          weight_kg?: number | null
          onboarding_complete?: boolean
        }
        Update: {
          display_name?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: string | null
          height_cm?: number | null
          weight_kg?: number | null
          onboarding_complete?: boolean
        }
      }
      user_settings: {
        Row: {
          user_id: string
          timezone: string | null
          dietary_tags: string[] | null
          allergens: string[] | null
          disliked_ingredients: string[] | null
          cuisine_prefs: string[] | null
          macro_split: any | null
          calorie_target: number | null
          budget_cad: number | null
          last_updated: string
        }
        Insert: {
          user_id: string
          timezone?: string | null
          dietary_tags?: string[] | null
          allergens?: string[] | null
          disliked_ingredients?: string[] | null
          cuisine_prefs?: string[] | null
          macro_split?: any | null
          calorie_target?: number | null
          budget_cad?: number | null
        }
        Update: {
          timezone?: string | null
          dietary_tags?: string[] | null
          allergens?: string[] | null
          disliked_ingredients?: string[] | null
          cuisine_prefs?: string[] | null
          macro_split?: any | null
          calorie_target?: number | null
          budget_cad?: number | null
        }
      }
      user_body_metrics: {
        Row: {
          id: string
          user_id: string
          measured_at: string
          height_cm: number | null
          weight_kg: number | null
          body_fat_percent: number | null
          source: string | null
          note: string | null
        }
        Insert: {
          id?: string
          user_id: string
          measured_at?: string
          height_cm?: number | null
          weight_kg?: number | null
          body_fat_percent?: number | null
          source?: string | null
          note?: string | null
        }
        Update: {
          measured_at?: string
          height_cm?: number | null
          weight_kg?: number | null
          body_fat_percent?: number | null
          source?: string | null
          note?: string | null
        }
      }
      units: {
        Row: {
          id: string
          code: string
          display_name: string
          is_mass: boolean
          to_gram_factor: number | null
          to_milliliter_factor: number | null
        }
        Insert: {
          id?: string
          code: string
          display_name: string
          is_mass: boolean
          to_gram_factor?: number | null
          to_milliliter_factor?: number | null
        }
        Update: {
          code?: string
          display_name?: string
          is_mass?: boolean
          to_gram_factor?: number | null
          to_milliliter_factor?: number | null
        }
      }
      subscription_plans: {
        Row: {
          code: string
          features: any
        }
        Insert: {
          code: string
          features: any
        }
        Update: {
          code?: string
          features?: any
        }
      }
      recipes: {
        Row: {
          id: string
          created_by: string | null
          title: string
          slug: string
          summary: string | null
          instructions: string | null
          image_url: string | null
          source_url: string | null
          prep_min: number | null
          cook_min: number | null
          servings: number
          dietary_tags: string[] | null
          cuisine: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_by?: string | null
          title: string
          slug: string
          summary?: string | null
          instructions?: string | null
          image_url?: string | null
          source_url?: string | null
          prep_min?: number | null
          cook_min?: number | null
          servings?: number
          dietary_tags?: string[] | null
          cuisine?: string | null
          is_public?: boolean
        }
        Update: {
          created_by?: string | null
          title?: string
          slug?: string
          summary?: string | null
          instructions?: string | null
          image_url?: string | null
          source_url?: string | null
          prep_min?: number | null
          cook_min?: number | null
          servings?: number
          dietary_tags?: string[] | null
          cuisine?: string | null
          is_public?: boolean
        }
      }
      shopping_history: {
        Row: {
          id: string
          household_id: string
          grocery_list_id: string | null
          purchased_at: string
          vendor: string | null
          total_spent_cents: number | null
          currency: string
          items: any
        }
        Insert: {
          id?: string
          household_id: string
          grocery_list_id?: string | null
          purchased_at?: string
          vendor?: string | null
          total_spent_cents?: number | null
          currency?: string
          items?: any
        }
        Update: {
          household_id?: string
          grocery_list_id?: string | null
          purchased_at?: string
          vendor?: string | null
          total_spent_cents?: number | null
          currency?: string
          items?: any
        }
      }
      recipe_tags: {
        Row: {
          recipe_id: string
          tag: string
        }
        Insert: {
          recipe_id: string
          tag: string
        }
        Update: {
          recipe_id?: string
          tag?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type UserBodyMetrics = Database['public']['Tables']['user_body_metrics']['Row']
export type Unit = Database['public']['Tables']['units']['Row']
export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']
export type Recipe = Database['public']['Tables']['recipes']['Row']
export type ShoppingHistory = Database['public']['Tables']['shopping_history']['Row']
export type RecipeTag = Database['public']['Tables']['recipe_tags']['Row']
