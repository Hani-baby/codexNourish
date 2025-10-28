import { supabase } from './supabase'

export interface MealPlanRequest {
  user_id: string
  start_date: string
  end_date: string
  meals_per_day: number
  freeform_prompt?: string
  use_user_preferences?: boolean
  session_preferences?: {
    cuisines?: string[]
    dislikes?: string[]
    convenience_level?: string
    cooking_time?: string
    leftovers_policy?: string
    dietary_patterns?: string[]
    excluded_ingredients?: string[]
    budget_range?: number
  }
  auto_generate_grocery_list?: boolean
  include_pantry_inventory?: boolean
}

export interface MealPlanResponse {
  success: boolean
  job_id?: string
  status?: string
  message?: string
  error?: string
  reason?: string
  tier?: string
  days_until_next?: number
  last_generation?: string
  meal_plan_id?: string
  grocery_list_id?: string
  progress?: number
  tool_results?: any
}

export interface MealPlanDraft {
  id: string
  user_id: string
  household_id: string
  plan_title: string
  timezone: string
  scope: string
  start_date: string
  end_date: string
  meals_per_day: number
  slots: any[]
  freeform_prompt?: string
  status: string
  items: any[]
  daily_totals: any[]
  user_context: any
  raw_ai_response: string
  created_at: string
  updated_at: string
}

export class MealPlanService {
  /**
   * Check if user can generate a meal plan based on their subscription tier
   */
  static async checkMealPlanPermissions(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    allowed: boolean
    reason?: string
    tier?: string
    daysUntilNext?: number
    lastGeneration?: string
    household_id?: string
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        return {
          allowed: false,
          reason: 'Not authenticated'
        }
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-gate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: userId,
          feature: 'meal_plan',
          start_date: startDate,
          end_date: endDate
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Access gate call failed:', errorText)
        return {
          allowed: false,
          reason: errorText || 'Failed to verify permissions'
        }
      }

      const data = await response.json()

      return {
        allowed: Boolean(data.allowed),
        reason: data.reason ?? undefined,
        tier: data.tier ?? undefined,
        daysUntilNext: data.days_until_next ?? undefined,
        lastGeneration: data.last_generation ?? undefined,
        household_id: data.household_id ?? undefined
      }
    } catch (error) {
      console.error('Error in checkMealPlanPermissions:', error)
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'An error occurred while checking permissions',
      }
    }
  }

  /**
   * Fetch the household context from the edge function
   */
  /**
   * Generate a meal plan using the Supabase orchestrator
   */
  static async generateMealPlan(request: MealPlanRequest): Promise<MealPlanResponse> {
    try {
      console.log('Generating meal plan with ai-router action mode:', request)

      const perms = await this.checkMealPlanPermissions(request.user_id, request.start_date, request.end_date)
      if (!perms.allowed) {
        return {
          success: false,
          status: 'denied',
          error: perms.reason || 'Not allowed',
          reason: perms.reason,
          tier: perms.tier,
          days_until_next: perms.daysUntilNext,
          last_generation: perms.lastGeneration
        }
      }

      let householdId = perms.household_id
      if (!householdId) {
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', request.user_id)
          .eq('status', 'active')
          .maybeSingle()

        householdId = membership?.household_id || undefined
      }

      if (!householdId) {
        return { success: false, error: 'Household not found for user' }
      }

      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-router`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          mode: 'action',
          user_id: request.user_id,
          household_id: householdId,
          start_date: request.start_date,
          end_date: request.end_date,
          meals_per_day: request.meals_per_day,
          use_user_preferences: request.use_user_preferences ?? true,
          session_preferences: request.session_preferences || {},
          plan_title: `Meal Plan ${request.start_date} - ${request.end_date}`,
          auto_generate_grocery_list: request.auto_generate_grocery_list ?? true,
          include_pantry_inventory: request.include_pantry_inventory ?? true
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error calling ai-router action mode:', errorText)
        return { success: false, error: errorText || 'Failed to generate meal plan' }
      }

      const data = await response.json()
      console.log('MealPlanService.generateMealPlan response', data)
      const toolResults = Array.isArray(data.tool_results) ? data.tool_results : []
      const lastResult = toolResults.length > 0 ? toolResults[toolResults.length - 1] : undefined

      return {
        success: true,
        status: 'completed',
        message: lastResult?.message || data.output_text || 'Meal plan created',
        job_id: lastResult?.job_id,
        meal_plan_id: lastResult?.meal_plan_id,
        grocery_list_id: lastResult?.grocery_list_id,
        tool_results: toolResults
      }
    } catch (error) {
      console.error('Error in generateMealPlan:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Check the status of a meal plan generation job
   */
  static async checkJobStatus(jobId: string): Promise<{ status: string; progress: number; result?: any; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('async_jobs')
        .select('status, progress, result, error')
        .eq('id', jobId)
        .single()

      if (error) {
        console.error('Error checking job status:', error)
        throw error
      }

      return {
        status: data.status,
        progress: data.progress || 0,
        result: data.result,
        error: data.error
      }
    } catch (error) {
      console.error('Error in checkJobStatus:', error)
      throw error
    }
  }

  /**
   * Get meal plan drafts for a user
   */
  static async getMealPlanDrafts(userId: string): Promise<MealPlanDraft[]> {
    try {
      const { data, error } = await supabase
        .from('meal_plan_drafts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching meal plan drafts:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getMealPlanDrafts:', error)
      throw error
    }
  }

  /**
   * Get a specific meal plan draft by ID
   */
  static async getMealPlanDraft(draftId: string): Promise<MealPlanDraft | null> {
    try {
      const { data, error } = await supabase
        .from('meal_plan_drafts')
        .select('*')
        .eq('id', draftId)
        .single()

      if (error) {
        console.error('Error fetching meal plan draft:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getMealPlanDraft:', error)
      throw error
    }
  }

  /**
   * Convert a meal plan draft to a finalized meal plan
   */
  static async finalizeMealPlan(draftId: string): Promise<{ success: boolean; meal_plan_id?: string; error?: string }> {
    try {
      // Call the recipeAssigner function to process the draft
      const { data, error } = await supabase.functions.invoke('recipeAssigner', {
        body: { draft_id: draftId }
      })

      if (error) {
        console.error('Error calling recipeAssigner function:', error)
        return {
          success: false,
          error: error.message || 'Failed to finalize meal plan'
        }
      }

      return {
        success: true,
        meal_plan_id: data?.meal_plan_id
      }
    } catch (error) {
      console.error('Error in finalizeMealPlan:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Get finalized meal plans for a user
   */
  static async getMealPlans(
    userId: string,
    options: {
      householdId?: string
    } = {},
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('meal_plans')
        .select(`
          *,
          meal_plan_items (
            *,
            recipes (
              id,
              title,
              slug,
              summary,
              image_url,
              prep_min,
              cook_min,
              servings,
              dietary_tags,
              cuisine
            )
          )
        `)
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (options.householdId) {
        query = query.eq('household_id', options.householdId)
      } else {
        query = query.eq('created_by', userId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching meal plans:', error)
        throw error
      }

      return data ?? []
    } catch (error) {
      console.error('Error in getMealPlans:', error)
      throw error
    }
  }

  static async startMealPlanOrchestration(request: MealPlanRequest & {
    plan_title?: string
    generate_grocery_list?: boolean
  }): Promise<{
    success: boolean
    job_id?: string | null
    draft_id?: string | null
    status?: string | null
    message?: string | null
    progress?: number
    meal_plan_id?: string | null
    error?: string
  }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const payload = {
      planTitle: request.plan_title ?? `Meal Plan ${request.start_date} - ${request.end_date}`,
      startDate: request.start_date,
      endDate: request.end_date,
      mealsPerDay: request.meals_per_day,
      applyProfilePreferences: request.use_user_preferences ?? true,
      freeformPrompt: request.freeform_prompt ?? null,
      sessionPreferences: request.session_preferences ?? {},
      autoGenerateGroceryList: request.auto_generate_grocery_list ?? true,
      includePantryInventory: request.include_pantry_inventory ?? true,
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meal-plan-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      let errorMessage: string;
      
      // Try to extract a clean error message without double-wrapping
      if (typeof data.error === 'string' && data.error) {
        // Check if it's already JSON-wrapped
        try {
          const parsed = JSON.parse(data.error);
          if (parsed.message) {
            errorMessage = parsed.message;
          } else {
            errorMessage = data.error;
          }
        } catch {
          // Not JSON, use as-is
          errorMessage = data.error;
        }
      } else if (data.error && typeof data.error === 'object') {
        // If error is an object, try to extract message
        errorMessage = (data.error as any).message || JSON.stringify(data.error);
      } else if (typeof data.message === 'string' && data.message) {
        errorMessage = data.message;
      } else {
        errorMessage = `Failed to start meal plan generation (status ${response.status})`;
      }
      
      throw new Error(errorMessage);
    }

    return {
      success: true,
      job_id: data.job_id ?? data.jobId ?? null,
      draft_id: data.draft_id ?? data.draftId ?? null,
      status: data.status ?? null,
      message: data.message ?? null,
      progress: typeof data.progress === 'number' ? data.progress : undefined,
      meal_plan_id: data.meal_plan_id ?? data.mealPlanId ?? null,
    }
  }

  /**
   * Delete a meal plan
   */
  static async deleteMealPlan(mealPlanId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', mealPlanId)

      if (error) {
        console.error('Error deleting meal plan:', error)
        return {
          success: false,
          error: error.message || 'Failed to delete meal plan'
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Error in deleteMealPlan:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

export default MealPlanService
