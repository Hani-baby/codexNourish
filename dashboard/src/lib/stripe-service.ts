// Stripe Service
// Purpose: Handle Stripe payment processing and subscription management
// Status: STUB - Awaiting Stripe configuration

import { supabase } from './supabase'

export type PlanCode = 'try_taste' | 'plan_save' | 'automate_optimize' | 'family_table'
export type Interval = 'month' | 'year'

export interface StripeCheckoutOptions {
  userId: string
  householdId: string
  planCode: PlanCode
  interval: Interval
  seats?: number // for family_table; includes total seats (min 4)
  successUrl?: string
  cancelUrl?: string
}

export interface StripePortalOptions {
  userId: string
  householdId: string
  returnUrl?: string
}

export class StripeService {
  /**
   * Create a Stripe Checkout session for upgrading subscription
   * @returns Checkout session URL to redirect user to
   */
  static async createCheckoutSession(options: StripeCheckoutOptions): Promise<{
    success: boolean
    checkoutUrl?: string
    error?: string
  }> {
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) return { success: false, error: 'User not authenticated' }

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (globalThis as any).VITE_SUPABASE_URL
      if (!supabaseUrl) return { success: false, error: 'Supabase URL not configured' }

      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          household_id: options.householdId,
          plan_code: options.planCode,
          interval: options.interval,
          seats: options.seats,
          success_url: options.successUrl || `${window.location.origin}/settings?upgrade=success`,
          cancel_url: options.cancelUrl || `${window.location.origin}/settings?upgrade=cancelled`
        })
      })

      const data = await res.json()
      return { success: !!data.success, checkoutUrl: data.checkout_url, error: data.error }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      }
    }
  }

  /**
   * Create a Stripe Customer Portal session for managing subscription
   * @returns Portal session URL to redirect user to
   */
  static async createPortalSession(options: StripePortalOptions): Promise<{
    success: boolean
    portalUrl?: string
    error?: string
  }> {
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) return { success: false, error: 'User not authenticated' }

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || (globalThis as any).VITE_SUPABASE_URL
      if (!supabaseUrl) return { success: false, error: 'Supabase URL not configured' }

      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          household_id: options.householdId,
          return_url: options.returnUrl || `${window.location.origin}/settings`
        })
      })

      const data = await res.json()
      return { success: !!data.success, portalUrl: data.portal_url, error: data.error }
    } catch (error) {
      console.error('Error creating portal session:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create portal session'
      }
    }
  }

  /**
   * Get household's current subscription info
   */
  static async getSubscriptionInfo(householdId: string): Promise<{
    tier: string
    status: string
    features: any
    renewalDate?: string
  }> {
    try {
      // Get household subscription
      const { data: subscription, error } = await supabase
        .from('household_subscriptions')
        .select(`
          *,
          subscription_plans (
            slug,
            name,
            features
          )
        `)
        .eq('household_id', householdId)
        .eq('status', 'active')
        .maybeSingle()

      if (error) {
        console.error('Error fetching subscription:', error)
        throw error
      }

      const tier = subscription?.meta?.tier || 'free'
      const planSlug = subscription?.subscription_plans?.slug || tier

      // Get plan features
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('features')
        .eq('slug', planSlug)
        .single()

      return {
        tier,
        status: subscription?.status || 'active',
        features: plan?.features || {},
        renewalDate: subscription?.renewal_date
      }
    } catch (error) {
      console.error('Error in getSubscriptionInfo:', error)
      return {
        tier: 'free',
        status: 'active',
        features: {}
      }
    }
  }

  /**
   * Check if user can access a specific feature
   */
  static async canAccessFeature(
    householdId: string,
    feature: 'grocery_lists' | 'instacart_integration' | 'ai_chef' | 'community_access'
  ): Promise<boolean> {
    try {
      const info = await this.getSubscriptionInfo(householdId)
      return info.features[feature] === true
    } catch (error) {
      console.error('Error checking feature access:', error)
      return false
    }
  }

  /**
   * Get usage stats for the household
   */
  static async getUsageStats(householdId: string): Promise<{
    aiGenerationsThisPeriod: number
    recipeCount: number
    memberCount: number
    lastAiGeneration?: string
  }> {
    try {
      // Count AI-generated meal plans in current period
      const { count: aiCount } = await supabase
        .from('meal_plans')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('generated_by', 'ai')
        .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()) // Last 60 days

      // Get last AI generation date
      const { data: lastGeneration } = await supabase
        .from('meal_plans')
        .select('created_at')
        .eq('household_id', householdId)
        .eq('generated_by', 'ai')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Count recipes created by household members
      const { data: members } = await supabase
        .from('household_members')
        .select('user_id')
        .eq('household_id', householdId)
        .eq('status', 'active')

      const memberIds = members?.map(m => m.user_id) || []

      const { count: recipeCount } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .in('created_by', memberIds)

      return {
        aiGenerationsThisPeriod: aiCount || 0,
        recipeCount: recipeCount || 0,
        memberCount: memberIds.length,
        lastAiGeneration: lastGeneration?.created_at
      }
    } catch (error) {
      console.error('Error getting usage stats:', error)
      return {
        aiGenerationsThisPeriod: 0,
        recipeCount: 0,
        memberCount: 0
      }
    }
  }
}

export default StripeService

