export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type DraftStatus =
  | 'generating'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'converted'

export interface SessionPreferences {
  cuisines?: string[]
  dislikes?: string[]
  convenience_level?: string
  cooking_time?: string
  leftovers_policy?: string
  dietary_patterns?: string[]
  excluded_ingredients?: string[]
  budget_range?: number
  [key: string]: unknown
}

export interface MealPlanOrchestratorRequest {
  user_id?: string
  userId?: string
  household_id?: string
  householdId?: string
  start_date?: string
  startDate?: string
  end_date?: string
  endDate?: string
  meals_per_day?: number
  mealsPerDay?: number
  plan_title?: string
  planTitle?: string
  use_user_preferences?: boolean
  applyProfilePreferences?: boolean
  session_preferences?: SessionPreferences
  sessionPreferences?: SessionPreferences
  freeform_prompt?: string | null
  freeformPrompt?: string | null
  auto_generate_grocery_list?: boolean
  autoGenerateGroceryList?: boolean
  include_pantry_inventory?: boolean
  includePantryInventory?: boolean
}

export interface NormalizedMealPlanRequest {
  job_id?: string
  user_id: string
  household_id: string
  plan_title: string
  start_date: string
  end_date: string
  scope: 'daily' | 'weekly' | 'monthly'
  timezone: string
  meals_per_day: number
  use_user_preferences: boolean
  session_preferences: SessionPreferences
  freeform_prompt?: string | null
  auto_generate_grocery_list: boolean
  include_pantry_inventory: boolean
  payload_signature?: string
}

export interface NormalizedPayloadResult {
  normalized: NormalizedMealPlanRequest
  canonicalPayload: Record<string, unknown>
  payloadSignature: string
}

export interface AsyncJobRecord {
  id: string
  user_id: string | null
  job_type: string
  status: JobStatus
  progress: number
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  meta: Record<string, unknown>
}

export interface DraftGenerationResult {
  draft_id: string
  status: DraftStatus
  meal_plan_id?: string | null
  meta?: Record<string, unknown>
}

export class OrchestratorError extends Error {
  constructor(message: string, public status: number = 500, public details?: unknown) {
    super(message)
    this.name = 'OrchestratorError'
  }
}

export class AuthorizationError extends OrchestratorError {
  constructor(message = 'Not authorized', details?: unknown) {
    super(message, 403, details)
    this.name = 'AuthorizationError'
  }
}

export class ValidationError extends OrchestratorError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, details)
    this.name = 'ValidationError'
  }
}

export class TransientError extends OrchestratorError {
  constructor(message = 'Transient error', details?: unknown) {
    super(message, 503, details)
    this.name = 'TransientError'
  }
}

export class PermanentError extends OrchestratorError {
  constructor(message = 'Permanent error', status = 422, details?: unknown) {
    super(message, status, details)
    this.name = 'PermanentError'
  }
}

export interface MealPlanDraftItem {
  date: string
  meal_type: string
  title: string
  description: string
  servings: number
  tags: string[]
  notes?: string | null
  recipe_id?: string | null
  [key: string]: unknown
}

export interface MealPlanDraftRecord {
  id: string
  user_id: string
  household_id: string
  status: DraftStatus
  items: MealPlanDraftItem[]
  user_context?: {
    session_preferences?: SessionPreferences
    [key: string]: unknown
  } | null
}

export interface RecipeAssignerRequest {
  draft_id: string
  household_id?: string
  user_id?: string
  start_index?: number
  max_items?: number
  time_budget_ms?: number
  min_confidence?: number
  strategy?: string
}

export type ResolvedRecipeAssignerRequest = RecipeAssignerRequest & {
  household_id: string
  user_id: string
}

export type RecipeAssignmentSource = 'existing' | 'generated' | 'ai_tools'

export interface RecipeAssignmentResult {
  itemIndex: number
  recipeId: string
  confidence: number
  source: RecipeAssignmentSource
}

export interface RecipeAssignmentRunStats {
  totalItems: number
  assignedBeforeRun: number
  assignedThisRun: number
  totalAssigned: number
  remaining: number
  elapsedMs: number
  nextItemIndex: number | null
  pendingAssignments?: number
}

export interface RecipeAssignmentResumeHint {
  next_item_index: number | null
  remaining: number
}

export interface RecipeAssignerRunPayload {
  success: boolean
  draft_id: string
  status: 'partial' | 'completed'
  assignments: RecipeAssignmentResult[]
  stats: RecipeAssignmentRunStats
  has_more: boolean
  resume_hint?: RecipeAssignmentResumeHint | null
  error?: string
  message?: string
  [key: string]: unknown
}

export interface RecipeGenerationRequest {
  title: string
  description: string
  meal_type: string
  servings: number
  dietary_tags: string[]
  cuisine?: string | null
  household_preferences: Record<string, unknown>
  session_preferences?: SessionPreferences
  user_id: string
  household_id: string
  draft_id?: string
  draft_item_index?: number
}

export interface RecipeGenerationResponse {
  success: boolean
  recipe_id: string
  slug: string
  title: string
}

