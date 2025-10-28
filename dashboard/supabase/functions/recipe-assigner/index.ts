import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'
import { Pool } from 'https://deno.land/x/postgres@v0.17.2/mod.ts'

import { createLogger } from '../_shared/logger.ts'
import { createErrorResponse, createJsonResponse, handleCors } from '../_shared/cors.ts'
import { fetchHouseholdPreferences, HouseholdPreferenceAggregate } from '../_shared/preferences.ts'
import {
  MealPlanDraftItem,
  MealPlanDraftRecord,
  RecipeAssignerRequest,
  RecipeAssignmentResult,
  RecipeAssignmentRunStats,
  ResolvedRecipeAssignerRequest,
  RecipeGenerationResponse,
  SessionPreferences,
  ValidationError,
} from '../_shared/types.ts'

// Tool schemas for AI model
const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "match_existing_recipe",
      description: "Try to match this meal request to an existing recipe, respecting dietary requirements and exclusions.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Meal title to match against recipes.title" },
          meal_type: { type: "string", description: "e.g., breakfast, lunch, dinner, snack, dessert" },
          cuisine: { type: ["string", "null"], description: "Preferred cuisine or null" },
          required_dietary: {
            type: "array",
            items: { type: "string" },
            description: "Tags that MUST be present (e.g., vegan, halal, gluten-free)"
          },
          blocked_tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags that MUST NOT be present (e.g., contains:peanut)"
          },
          blocked_ingredients: {
            type: "array",
            items: { type: "string" },
            description: "Ingredient substrings to avoid (allergens/exclusions)"
          },
          user_id: { type: "string", description: "Owner/user scope for private recipes" }
        },
        required: ["title", "meal_type", "required_dietary", "blocked_tags", "blocked_ingredients", "user_id"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_recipe",
      description: "Generate a complete, family-friendly recipe that conforms to constraints and is ready to persist.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 3, maxLength: 160 },
          slug: {
            type: "string",
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            minLength: 3,
            maxLength: 180,
            description: "Lowercase URL slug; uniqueness will be ensured server-side."
          },
          summary: { type: ["string","null"], maxLength: 1000 },
          instructions: { type: ["string","null"] },
          image_url: { type: ["string","null"], format: "uri" },
          source_url: { type: ["string","null"], format: "uri" },
          prep_min: { type: ["integer","null"], minimum: 0 },
          cook_min: { type: ["integer","null"], minimum: 0 },
          servings: { type: "number", exclusiveMinimum: 0 },
          dietary_tags: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
            default: []
          },
          cuisine: { type: ["string","null"], maxLength: 120 },
          is_public: { type: "boolean", default: false },
          tags: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 60 },
            uniqueItems: true,
            default: []
          },
          ingredients: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["ingredient_name"],
              properties: {
                ingredient_id: { type: ["string","null"], format: "uuid" },
                ingredient_name: { type: "string", minLength: 1 },
                quantity: { type: ["number","null"], exclusiveMinimum: 0 },
                unit_id: { type: ["string","null"] },
                unit_name: { type: ["string","null"], minLength: 1 },
                preparation: { type: ["string","null"], maxLength: 200 },
                notes: { type: ["string","null"], maxLength: 400 },
                order_index: { type: "integer", minimum: 0, default: 0 },
                metadata: { type: "object", additionalProperties: true },
                normalized_qty_g: { type: ["number","null"] },
                normalized_qty_ml: { type: ["number","null"] }
              },
              allOf: [
                { anyOf: [ { required: ["ingredient_id"] }, { required: ["ingredient_name"] } ] }
              ]
            }
          },
          steps: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["step_number", "instruction"],
              properties: {
                step_number: { type: "integer", minimum: 1 },
                instruction: { type: "string", minLength: 3 },
                label: { type: ["string","null"] }
              }
            },
            description: "Must be sequential 1..N; server will normalize."
          },
          nutrition: {
            type: "object",
            additionalProperties: false,
            properties: {
              calories_kcal: { type: ["integer","null"], minimum: 0 },
              protein_g: { type: ["number","null"], minimum: 0 },
              carbs_g: { type: ["number","null"], minimum: 0 },
              fat_g: { type: ["number","null"], minimum: 0 },
              fiber_g: { type: ["number","null"], minimum: 0 },
              sugar_g: { type: ["number","null"], minimum: 0 },
              sodium_mg: { type: ["integer","null"], minimum: 0 },
              meta: { type: "object", additionalProperties: true, default: {} }
            }
          },
          nutrition_per_serving: {
            type: "object",
            additionalProperties: false,
            properties: {
              calories_kcal: { type: ["integer","null"], minimum: 0 },
              protein_g: { type: ["number","null"], minimum: 0 },
              carbs_g: { type: ["number","null"], minimum: 0 },
              fat_g: { type: ["number","null"], minimum: 0 },
              fiber_g: { type: ["number","null"], minimum: 0 },
              sugar_g: { type: ["number","null"], minimum: 0 },
              sodium_mg: { type: ["integer","null"], minimum: 0 }
            }
          },
          serving_notes: { type: "array", items: { type: "string" } },
          allergens: { type: "array", items: { type: "string" } },
          meta: { type: "object", additionalProperties: true }
        },
        required: ["title", "slug", "servings", "ingredients", "steps"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "revise_recipe_for_violations",
      description: "Update a previously proposed recipe to fix validation errors or allergen conflicts.",
      parameters: {
        type: "object",
        properties: {
          original_title: { type: "string" },
          violations: {
            type: "array",
            items: { type: "string" },
            description: "Human-readable errors (e.g., 'contains peanut; user allergic')."
          },
          must_remove_ingredients: {
            type: "array",
            items: { type: "string" },
            description: "Ingredients that must be removed or replaced."
          },
          constraints: {
            type: "object",
            additionalProperties: true,
            description: "Re-asserted constraints (dietary patterns, time limits, budget, etc.)"
          }
        },
        required: ["original_title", "violations"],
        additionalProperties: false
      }
    }
  }
] as const

const logger = createLogger('Recipe Assigner', '[ra]')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const databaseUrl = Deno.env.get('SUPABASE_DB_URL') ?? Deno.env.get('DATABASE_URL') ?? null

if (!supabaseUrl || !serviceRoleKey) {
  logger.error('Missing Supabase admin credentials', {}, '[er]')
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured')
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
const pool = databaseUrl ? new Pool(databaseUrl, 3, true) : null

// Tool execution interfaces
interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface ToolResult {
  tool_call_id: string
  content: string
}

// Tool executors
const executeMatchExistingRecipe = async (args: any): Promise<{ recipeId: string | null; confidence: number }> => {
  const { title, meal_type, cuisine, required_dietary, blocked_tags, blocked_ingredients, user_id } = args
  
  try {
    const candidates = await fetchCandidatesWithSql(
      title,
      meal_type,
      cuisine,
      required_dietary,
      blocked_tags,
      user_id,
    )

    if (candidates.length === 0) {
      return { recipeId: null, confidence: 0 }
    }

    const best = pickBestCandidate(candidates, required_dietary, blocked_tags, blocked_ingredients)
    if (!best) {
      return { recipeId: null, confidence: 0 }
    }

    return {
      recipeId: best.candidate.id,
      confidence: best.confidence,
    }
  } catch (error) {
    logger.warn('match_existing_recipe failed', { error: error instanceof Error ? error.message : String(error) })
    return { recipeId: null, confidence: 0 }
  }
}

const validateGeneratedRecipe = async (
  recipeData: any,
  preferences: HouseholdPreferenceAggregate,
  userId: string,
): Promise<{ violations: string[]; mustRemoveIngredients: string[] }> => {
  const violations: string[] = []
  const mustRemoveIngredients: string[] = []

  // Check dietary requirements
  const requiredDietary = preferences.members
    .flatMap(member => member.dietary_patterns || [])
    .filter(pattern => pattern.is_required)
    .map(pattern => pattern.name.toLowerCase())

  const recipeDietaryTags = (recipeData.dietary_tags || []).map((tag: string) => tag.toLowerCase())

  for (const required of requiredDietary) {
    if (!recipeDietaryTags.includes(required)) {
      violations.push(`Missing required dietary tag: ${required}`)
    }
  }

  // Check blocked ingredients/allergens
  const blockedIngredients = preferences.members
    .flatMap(member => member.allergies || [])
    .map(allergy => allergy.name.toLowerCase())

  const recipeIngredients = (recipeData.ingredients || []).map((ing: any) => 
    ing.ingredient_name?.toLowerCase() || ''
  )

  for (const blocked of blockedIngredients) {
    const found = recipeIngredients.some((ing: string) => 
      ing.includes(blocked) || blocked.includes(ing)
    )
    if (found) {
      violations.push(`Contains blocked ingredient: ${blocked}`)
      mustRemoveIngredients.push(blocked)
    }
  }

  // Check blocked dietary tags
  const blockedTags = preferences.members
    .flatMap(member => member.dietary_patterns || [])
    .filter(pattern => pattern.is_blocked)
    .map(pattern => pattern.name.toLowerCase())

  for (const blocked of blockedTags) {
    if (recipeDietaryTags.includes(blocked)) {
      violations.push(`Contains blocked dietary tag: ${blocked}`)
    }
  }

  // Basic validation
  if (!recipeData.title || recipeData.title.length < 3) {
    violations.push('Recipe title must be at least 3 characters')
  }

  if (!recipeData.servings || recipeData.servings <= 0) {
    violations.push('Recipe must have positive servings count')
  }

  if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
    violations.push('Recipe must have at least one ingredient')
  }

  if (!recipeData.steps || recipeData.steps.length === 0) {
    violations.push('Recipe must have at least one step')
  }

  return { violations, mustRemoveIngredients }
}

const executeGenerateRecipe = async (
  args: any,
  userId: string,
  householdId: string,
  draftId: string,
  itemIndex: number,
): Promise<string | null> => {
  // Add required user_id and household_id to args
  const enrichedArgs = {
    ...args,
    user_id: userId,
    household_id: householdId,
    draft_id: draftId,
    draft_item_index: itemIndex,
  }
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/recipes-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(enrichedArgs),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('recipes-ai generation request timed out; awaiting async callback', {
        draft_id: draftId,
        item_index: itemIndex,
      })
      return null
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 202) {
    logger.info('recipes-ai accepted generation asynchronously', {
      draft_id: draftId,
      item_index: itemIndex,
    })
    return null
  }

  const body = (await response.json()) as Partial<RecipeGenerationResponse> & {
    error?: string
  }

  if (!response.ok || !body || !body.success || !body.recipe_id) {
    throw new Error(body?.error ?? 'recipes-ai failed to generate recipe')
  }

  return body.recipe_id
}

const executeReviseRecipeForViolations = async (
  args: any,
  userId: string,
  householdId: string,
  draftId: string,
  itemIndex: number,
): Promise<string | null> => {
  // For now, we'll regenerate the recipe with the violations in mind
  // This could be enhanced to actually modify the existing recipe
  const { original_title, violations, must_remove_ingredients, constraints } = args
  
  // Create a new recipe generation request with the constraints and violations
  const revisedArgs = {
    ...constraints,
    title: original_title,
    violations_to_avoid: violations,
    ingredients_to_avoid: must_remove_ingredients,
  }

  return executeGenerateRecipe(revisedArgs, userId, householdId, draftId, itemIndex)
}

interface RecipeCandidate {
  id: string
  title: string
  cuisine: string | null
  dietary_tags: string[]
  ingredient_names: string[]
  similarity: number
  meal_type_match: number
  cuisine_match: number
}

interface AssignmentRunResult {
  assignments: RecipeAssignmentResult[]
  stats: RecipeAssignmentRunStats
  hasMore: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const ensureString = (value: unknown, field: string): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  throw new ValidationError(`${field} is required`)
}

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const normalizeLowercase = (values: Iterable<string>): string[] => {
  const bucket = new Set<string>()
  for (const value of values) {
    const trimmed = value.trim().toLowerCase()
    if (trimmed) {
      bucket.add(trimmed)
    }
  }
  return Array.from(bucket)
}

type GenerationStatusState = 'pending' | 'resolved'

interface GenerationStatus {
  state: GenerationStatusState
  item_index?: number
  requested_at?: string
  resolved_at?: string
  recipe_id?: string | null
  source?: 'recipes_ai' | 'ai_tools'
}

const getGenerationStatus = (item: MealPlanDraftItem): GenerationStatus | null => {
  const rawStatus = (item as Record<string, unknown>).generation_status
  if (!isRecord(rawStatus)) {
    return null
  }
  const state = rawStatus.state
  if (state !== 'pending' && state !== 'resolved') {
    return null
  }
  return {
    state,
    item_index: typeof rawStatus.item_index === 'number' ? rawStatus.item_index : undefined,
    requested_at: typeof rawStatus.requested_at === 'string' ? rawStatus.requested_at : undefined,
    resolved_at: typeof rawStatus.resolved_at === 'string' ? rawStatus.resolved_at : undefined,
    recipe_id: typeof rawStatus.recipe_id === 'string' ? rawStatus.recipe_id : null,
    source:
      rawStatus.source === 'recipes_ai' || rawStatus.source === 'ai_tools'
        ? (rawStatus.source as 'recipes_ai' | 'ai_tools')
        : undefined,
  }
}

const markItemPendingGeneration = (
  item: MealPlanDraftItem,
  itemIndex: number,
  source: 'recipes_ai' | 'ai_tools',
): MealPlanDraftItem => {
  const next: MealPlanDraftItem & Record<string, unknown> = { ...item }
  next.generation_status = {
    state: 'pending',
    item_index: itemIndex,
    requested_at: new Date().toISOString(),
    source,
  }
  return next
}

const markItemGenerationResolved = (
  item: MealPlanDraftItem,
  recipeId: string,
  itemIndex?: number,
): MealPlanDraftItem => {
  const next: MealPlanDraftItem & Record<string, unknown> = {
    ...item,
    recipe_id: recipeId,
  }
  next.generation_status = {
    state: 'resolved',
    resolved_at: new Date().toISOString(),
    recipe_id: recipeId,
    ...(typeof itemIndex === 'number' ? { item_index: itemIndex } : {}),
  }
  return next
}

const clearGenerationStatus = (item: MealPlanDraftItem): MealPlanDraftItem => {
  const next: MealPlanDraftItem & Record<string, unknown> = { ...item }
  if ('generation_status' in next) {
    delete next.generation_status
  }
  return next
}

const parseRequest = (payload: unknown): RecipeAssignerRequest => {
  if (!isRecord(payload)) {
    throw new ValidationError('Request payload must be a JSON object')
  }

  const draftId = ensureString(payload.draft_id, 'draft_id')
  const householdId = optionalString(payload.household_id)
  const userId = optionalString(payload.user_id)

  let draftItemIndex: number | undefined
  const rawIndex = payload.draft_item_index
  if (typeof rawIndex === 'number' && Number.isInteger(rawIndex) && rawIndex >= 0) {
    draftItemIndex = rawIndex
  } else if (typeof rawIndex === 'string' && rawIndex.trim()) {
    const parsed = Number.parseInt(rawIndex.trim(), 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      draftItemIndex = parsed
    }
  }

  const isCallback =
    typeof payload.is_callback === 'boolean'
      ? payload.is_callback
      : typeof payload.is_callback === 'string'
      ? payload.is_callback.toLowerCase() === 'true'
      : false

  const callbackRecipeId = optionalString(payload.callback_recipe_id)

  const request: RecipeAssignerRequest = {
    draft_id: draftId,
    ...(householdId ? { household_id: householdId } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(isCallback ? { is_callback: true } : {}),
    ...(callbackRecipeId ? { callback_recipe_id: callbackRecipeId } : {}),
    ...(draftItemIndex !== undefined ? { draft_item_index: draftItemIndex } : {}),
  }
  
  logger.info('Recipe assigner payload received', {
    draft_id: request.draft_id,
    household_id: request.household_id,
    user_id: request.user_id,
    is_callback: request.is_callback ?? false,
    callback_recipe_id: request.callback_recipe_id,
    draft_item_index: request.draft_item_index,
  })
  
  return request
}

const resolveRequest = (
  request: RecipeAssignerRequest,
  draft: MealPlanDraftRecord,
): ResolvedRecipeAssignerRequest => {
  const householdId = request.household_id ?? draft.household_id
  const userId = request.user_id ?? draft.user_id

  if (!householdId) {
    throw new ValidationError('household_id is required')
  }
  if (!userId) {
    throw new ValidationError('user_id is required')
  }

  const resolved: ResolvedRecipeAssignerRequest = {
    ...request,
    household_id: householdId,
    user_id: userId,
  }

  logger.info('Resolved recipe assigner request', {
    draft_id: resolved.draft_id,
    household_id: resolved.household_id,
    user_id: resolved.user_id,
    is_callback: resolved.is_callback ?? false,
    callback_recipe_id: resolved.callback_recipe_id,
    draft_item_index: resolved.draft_item_index,
  })
  
  return resolved
}

const loadDraft = async (draftId: string): Promise<MealPlanDraftRecord> => {
  const { data, error } = await supabaseAdmin
    .from('meal_plan_drafts')
    .select('id, user_id, household_id, status, items, user_context')
    .eq('id', draftId)
    .maybeSingle()

  if (error) {
    throw error
  }
  if (!data) {
    throw new ValidationError('Draft not found')
  }

  const items = Array.isArray(data.items) ? (data.items as MealPlanDraftItem[]) : []

  if (items.length === 0) {
    throw new ValidationError('Draft does not contain any items')
  }

  // Validate user_id format
  const userId = data.user_id as string
  if (userId === '0' || !userId) {
    logger.warn('Draft has invalid user_id', {
      draft_id: draftId,
      user_id: userId,
      household_id: data.household_id,
    })
  }

  return {
    id: data.id as string,
    user_id: userId,
    household_id: data.household_id as string,
    status: data.status as MealPlanDraftRecord['status'],
    items,
    user_context: isRecord(data.user_context) ? data.user_context : null,
  }
}

const computeRequiredDietaryTags = (
  preferences: HouseholdPreferenceAggregate,
  draftItem: MealPlanDraftItem,
): string[] => {
  const preferenceTags = normalizeLowercase(preferences.combined.dietary_patterns ?? [])
  const itemDietaryTags = Array.isArray(draftItem.tags)
    ? normalizeLowercase(
        draftItem.tags.filter((tag) =>
          ['vegan', 'vegetarian', 'pescatarian', 'gluten-free', 'dairy-free', 'halal', 'kosher'].includes(
            tag.toLowerCase(),
          ),
        ),
      )
    : []
  return normalizeLowercase([...preferenceTags, ...itemDietaryTags])
}

const computeBlockedTokens = (preferences: HouseholdPreferenceAggregate): {
  tagTokens: string[]
  ingredientTokens: string[]
} => {
  const allergenTokens = normalizeLowercase(preferences.combined.allergies ?? [])
  const excludedTokens = normalizeLowercase(preferences.combined.excluded_ingredients ?? [])
  const tokens = normalizeLowercase([...allergenTokens, ...excludedTokens])
  const tagTokens = tokens.map((value) => `contains:${value}`)
  return {
    tagTokens,
    ingredientTokens: tokens,
  }
}

const inferCuisine = (
  draftItem: MealPlanDraftItem,
  preferences: HouseholdPreferenceAggregate,
): string | null => {
  const tags = Array.isArray(draftItem.tags) ? draftItem.tags : []
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().toLowerCase()
    if (tag.startsWith('cuisine:')) {
      const value = tag.split(':', 2)[1]
      if (value) return value
    }
  }

  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().toLowerCase()
    if (preferences.combined.cuisines.some((cuisine) => cuisine.toLowerCase() === tag)) {
      return tag
    }
  }

  return preferences.combined.cuisines[0]?.toLowerCase() ?? null
}

const computeTrigramSet = (value: string): Set<string> => {
  const normalized = `  ${value.toLowerCase()}  `
  const trigrams = new Set<string>()
  for (let i = 0; i < normalized.length - 2; i += 1) {
    trigrams.add(normalized.slice(i, i + 3))
  }
  return trigrams
}

const localSimilarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  const setA = computeTrigramSet(a)
  const setB = computeTrigramSet(b)
  const intersection = new Set([...setA].filter((value) => setB.has(value)))
  const unionSize = new Set([...setA, ...setB]).size
  if (unionSize === 0) return 0
  return intersection.size / unionSize
}

const fetchCandidatesWithSql = async (
  title: string,
  mealType: string,
  cuisine: string | null,
  requiredDietary: string[],
  blockedTags: string[],
  userId: string,
): Promise<RecipeCandidate[]> => {
  if (!pool) {
    return []
  }
  const connection = await pool.connect()
  try {
    const similarityThreshold = 0.75
    const result = await connection.queryObject<RecipeCandidate>(
      `select
          r.id,
          r.title,
          r.cuisine,
          r.dietary_tags,
          coalesce(array_agg(distinct lower(ri.ingredient_name)), '{}') as ingredient_names,
          similarity(lower(r.title), lower($1)) as similarity,
          max(case when lower(rt.tag) = lower($2) then 1 else 0 end) as meal_type_match,
          case
            when coalesce($3::text, '') = '' then 0
            when lower(r.cuisine) = lower($3::text) then 1
            else 0
          end as cuisine_match
        from public.recipes r
        left join public.recipe_tags rt on rt.recipe_id = r.id
        left join public.recipe_ingredients ri on ri.recipe_id = r.id
        where similarity(lower(r.title), lower($1)) >= $4
          and (coalesce(array_length($5::text[], 1), 0) = 0 or r.dietary_tags @> $5::text[])
          and (coalesce(array_length($6::text[], 1), 0) = 0 or not (r.dietary_tags && $6::text[]))
          and (r.is_public = true or r.created_by = $7)
        group by r.id
        order by similarity desc, meal_type_match desc, cuisine_match desc, r.updated_at desc
        limit 6`,
      title,
      mealType || '',
      cuisine,
      similarityThreshold,
      requiredDietary,
      blockedTags,
      userId,
    )
    return result.rows
  } finally {
    connection.release()
  }
}

const fetchCandidatesWithFallback = async (
  title: string,
  mealType: string,
  cuisine: string | null,
  requiredDietary: string[],
  blockedTags: string[],
  userId: string,
): Promise<RecipeCandidate[]> => {
  const { data, error } = await supabaseAdmin
    .from('recipes')
    .select('id, title, cuisine, dietary_tags, is_public, created_by, updated_at')
    .or(`created_by.eq.${userId},is_public.eq.true`)
    .like('title', `%${title}%`)
    .limit(10)
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  const recipes = Array.isArray(data) ? data : []
  const candidates: RecipeCandidate[] = []

  for (const recipe of recipes) {
    const dietaryTags = Array.isArray(recipe.dietary_tags) ? recipe.dietary_tags : []
    if (
      requiredDietary.length > 0 &&
      !requiredDietary.every((tag) => dietaryTags.map((v: string) => v.toLowerCase()).includes(tag))
    ) {
      continue
    }
    if (
      blockedTags.length > 0 &&
      dietaryTags.some((tag: string) => blockedTags.includes(tag.toLowerCase()))
    ) {
      continue
    }

    const similarity = localSimilarity(recipe.title as string, title)
    const mealTypeMatch = 0
    const cuisineMatch =
      cuisine && typeof recipe.cuisine === 'string' && recipe.cuisine.toLowerCase() === cuisine
        ? 1
        : 0

    const ingredientQuery = await supabaseAdmin
      .from('recipe_ingredients')
      .select('ingredient_name')
      .eq('recipe_id', recipe.id)

    const ingredientNames = (ingredientQuery.data ?? []).map((row) =>
      typeof row.ingredient_name === 'string' ? row.ingredient_name.toLowerCase() : '',
    )

    candidates.push({
      id: recipe.id as string,
      title: recipe.title as string,
      cuisine: typeof recipe.cuisine === 'string' ? recipe.cuisine : null,
      dietary_tags: dietaryTags as string[],
      ingredient_names: ingredientNames,
      similarity,
      meal_type_match: mealTypeMatch,
      cuisine_match: cuisineMatch,
    })
  }

  return candidates
}

const pickBestCandidate = (
  candidates: RecipeCandidate[],
  requiredDietary: string[],
  blockedTags: string[],
  blockedIngredients: string[],
): { candidate: RecipeCandidate; confidence: number } | null => {
  const compatible: Array<{ candidate: RecipeCandidate; confidence: number }> = []

  for (const candidate of candidates) {
    const dietaryTags = normalizeLowercase(candidate.dietary_tags ?? [])
    const ingredients = normalizeLowercase(candidate.ingredient_names ?? [])

    if (
      requiredDietary.length > 0 &&
      !requiredDietary.every((tag) => dietaryTags.includes(tag))
    ) {
      continue
    }

    if (blockedTags.some((tag) => dietaryTags.includes(tag))) {
      continue
    }

    if (
      blockedIngredients.some((token) =>
        ingredients.some((ingredient) => ingredient.includes(token)),
      )
    ) {
      continue
    }

    const confidence =
      candidate.similarity +
      (candidate.meal_type_match ? 0.08 : 0) +
      (candidate.cuisine_match ? 0.04 : 0)

    compatible.push({ candidate, confidence })
  }

  if (compatible.length === 0) {
    return null
  }

  compatible.sort((a, b) => b.confidence - a.confidence)
  const best = compatible[0]

  if (best.confidence < 0.8) {
    return null
  }

  return {
    candidate: best.candidate,
    confidence: Math.min(1, Number(best.confidence.toFixed(3))),
  }
}

const findExistingRecipe = async (
  draftItem: MealPlanDraftItem,
  preferences: HouseholdPreferenceAggregate,
  userId: string,
): Promise<{ recipeId: string; confidence: number } | null> => {
  const requiredDietary = computeRequiredDietaryTags(preferences, draftItem)
  const { tagTokens, ingredientTokens } = computeBlockedTokens(preferences)
  const cuisine = inferCuisine(draftItem, preferences)
  const mealType = typeof draftItem.meal_type === 'string' ? draftItem.meal_type.toLowerCase() : ''

  const candidatesFromSql = await fetchCandidatesWithSql(
    draftItem.title,
    mealType,
    cuisine,
    requiredDietary,
    tagTokens,
    userId,
  )

  const candidates =
    candidatesFromSql.length > 0
      ? candidatesFromSql
      : await fetchCandidatesWithFallback(
          draftItem.title,
          mealType,
          cuisine,
          requiredDietary,
          tagTokens,
          userId,
        )

  if (candidates.length === 0) {
    return null
  }

  const best = pickBestCandidate(candidates, requiredDietary, tagTokens, ingredientTokens)
  if (!best) {
    return null
  }

  return {
    recipeId: best.candidate.id,
    confidence: best.confidence,
  }
}

const extractSessionPreferences = (draft: MealPlanDraftRecord): SessionPreferences => {
  if (draft.user_context && isRecord(draft.user_context.session_preferences)) {
    return draft.user_context.session_preferences as SessionPreferences
  }
  return {}
}

const buildDietaryTagPayload = (
  draftItem: MealPlanDraftItem,
  preferences: HouseholdPreferenceAggregate,
): string[] => {
  const preferenceTags = normalizeLowercase(preferences.combined.dietary_patterns ?? [])
  const householdTags = normalizeLowercase(preferences.combined.allergies ?? []).map(
    (value) => `avoid:${value}`,
  )
  const itemTags = Array.isArray(draftItem.tags)
    ? normalizeLowercase(draftItem.tags.filter((tag) => tag.length <= 30))
    : []
  return normalizeLowercase([...preferenceTags, ...householdTags, ...itemTags])
}

// New AI integration with tools
const callAiWithTools = async (
  item: MealPlanDraftItem,
  preferences: HouseholdPreferenceAggregate,
  sessionPreferences: SessionPreferences,
  assignerRequest: ResolvedRecipeAssignerRequest,
  draftId: string,
  itemIndex: number,
): Promise<string | null> => {
  const requiredDietary = computeRequiredDietaryTags(preferences, item)
  const { tagTokens, ingredientTokens } = computeBlockedTokens(preferences)
  const cuisine = inferCuisine(item, preferences)
  const mealType = typeof item.meal_type === 'string' ? item.meal_type.toLowerCase() : ''
  
  const prompt = `You are a recipe assignment assistant. For this meal request, you must use the available tools to either match an existing recipe or generate a new one.

Meal Request:
- Title: ${item.title}
- Description: ${item.description || 'No description'}
- Meal Type: ${mealType}
- Servings: ${typeof item.servings === 'number' && item.servings > 0 ? item.servings : 4}
- Cuisine: ${cuisine || 'Any'}

Household Constraints:
- Required dietary tags: ${requiredDietary.join(', ') || 'None'}
- Blocked tags: ${tagTokens.join(', ') || 'None'}
- Blocked ingredients: ${ingredientTokens.join(', ') || 'None'}

You MUST:
1. First call match_existing_recipe to try finding an existing recipe
2. If no match found (recipeId is null) or confidence is below 0.7, call generate_recipe
3. If generate_recipe fails validation, call revise_recipe_for_violations

Return the final recipe_id.`

  const messages = [
    {
      role: 'system',
      content: 'You are a helpful recipe assignment assistant. You must use the provided tools to match or generate recipes.'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  // Add timeout with abort controller
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        tools: TOOL_SCHEMAS,
        tool_choice: 'required',
        temperature: 0.1,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API call timed out after 25 seconds')
    }
    throw error
  }

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const aiResponse = await response.json()
  const message = aiResponse.choices[0]?.message

  if (!message || !message.tool_calls) {
    throw new Error('AI did not make any tool calls')
  }

  // Execute tool calls
  const toolResults: ToolResult[] = []
  let finalRecipeId: string | null = null
  let needsRevision = false
  let revisionArgs: any = null
  let pendingGenerationTriggered = false

  for (const toolCall of message.tool_calls) {
    const args = JSON.parse(toolCall.function.arguments)
    let result: any

    switch (toolCall.function.name) {
      case 'match_existing_recipe':
        result = await executeMatchExistingRecipe(args)
        if (result.recipeId && result.confidence >= 0.7) {
          finalRecipeId = result.recipeId
        }
        break
      case 'generate_recipe':
        // Validate the generated recipe
        const validation = await validateGeneratedRecipe(args, preferences, assignerRequest.user_id)
        if (validation.violations.length > 0) {
          needsRevision = true
          revisionArgs = {
            original_title: args.title,
            violations: validation.violations,
            must_remove_ingredients: validation.mustRemoveIngredients,
            constraints: {
              required_dietary: computeRequiredDietaryTags(preferences, item),
              blocked_tags: computeBlockedTokens(preferences).tagTokens,
              blocked_ingredients: computeBlockedTokens(preferences).ingredientTokens,
            }
          }
          result = { needs_revision: true, violations: validation.violations }
        } else {
          result = await executeGenerateRecipe(
            args,
            assignerRequest.user_id,
            assignerRequest.household_id,
            draftId,
            itemIndex,
          )
          if (!result) {
            pendingGenerationTriggered = true
          }
          finalRecipeId = result
        }
        break
      case 'revise_recipe_for_violations':
        result = await executeReviseRecipeForViolations(
          args,
          assignerRequest.user_id,
          assignerRequest.household_id,
          draftId,
          itemIndex,
        )
        if (!result) {
          pendingGenerationTriggered = true
        }
        finalRecipeId = result
        break
      default:
        throw new Error(`Unknown tool: ${toolCall.function.name}`)
    }

    toolResults.push({
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    })
  }

  // If we need revision, make another AI call
  if (needsRevision && revisionArgs) {
    const revisionMessages = [
      ...messages,
      {
        role: 'assistant',
        content: null,
        tool_calls: message.tool_calls
      },
      ...toolResults.map(tr => ({
        role: 'tool',
        content: tr.content,
        tool_call_id: tr.tool_call_id
      })),
      {
        role: 'user',
        content: `The recipe generation failed validation. Please revise the recipe to fix these issues: ${revisionArgs.violations.join(', ')}. Use the revise_recipe_for_violations tool.`
      }
    ]

    const revisionController = new AbortController()
    const revisionTimeoutId = setTimeout(() => revisionController.abort(), 25000)
    
    let revisionResponse: Response
    try {
      revisionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: revisionMessages,
          tools: TOOL_SCHEMAS,
          tool_choice: 'required',
          temperature: 0.1,
        }),
        signal: revisionController.signal,
      })
      clearTimeout(revisionTimeoutId)
    } catch (error) {
      clearTimeout(revisionTimeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Revision API call timed out, skipping revision')
        if (!finalRecipeId) {
    if (pendingGenerationTriggered) {
      return null
    }
    throw new Error('No recipe was successfully assigned')
  }

  return finalRecipeId
      }
      throw error
    }

    if (revisionResponse.ok) {
      const revisionAiResponse = await revisionResponse.json()
      const revisionMessage = revisionAiResponse.choices[0]?.message

      if (revisionMessage && revisionMessage.tool_calls) {
        for (const toolCall of revisionMessage.tool_calls) {
          if (toolCall.function.name === 'revise_recipe_for_violations') {
            const args = JSON.parse(toolCall.function.arguments)
            finalRecipeId = await executeReviseRecipeForViolations(
              args,
              assignerRequest.user_id,
              assignerRequest.household_id,
              draftId,
              itemIndex,
            )
            if (!finalRecipeId) {
              pendingGenerationTriggered = true
            }
            break
          }
        }
      }
    }
  }

  if (!finalRecipeId) {
    if (pendingGenerationTriggered) {
      return null
    }
    throw new Error('No recipe was successfully assigned')
  }

  return finalRecipeId
}

// Legacy function for backward compatibility
const callRecipesAi = async (
  item: MealPlanDraftItem,
  preferences: HouseholdPreferenceAggregate,
  sessionPreferences: SessionPreferences,
  assignerRequest: ResolvedRecipeAssignerRequest,
  itemIndex: number,
): Promise<string | null> => {
  // Log the user_id we're about to send
  logger.info('Calling recipes-ai with user_id', {
    user_id: assignerRequest.user_id,
    household_id: assignerRequest.household_id,
    title: item.title,
    meal_type: item.meal_type,
  })

  const requestPayload = {
    title: item.title,
    description: item.description,
    meal_type: item.meal_type,
    servings: typeof item.servings === 'number' && item.servings > 0 ? item.servings : 4,
    dietary_tags: buildDietaryTagPayload(item, preferences),
    cuisine: inferCuisine(item, preferences),
    household_preferences: preferences,
    session_preferences: sessionPreferences,
    user_id: assignerRequest.user_id,
    household_id: assignerRequest.household_id,
    draft_id: assignerRequest.draft_id,
    draft_item_index: itemIndex,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/recipes-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('recipes-ai fallback generation timed out; awaiting callback', {
        draft_id: assignerRequest.draft_id,
        item_index: itemIndex,
      })
      return null
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 202) {
    logger.info('recipes-ai accepted fallback generation asynchronously', {
      draft_id: assignerRequest.draft_id,
      item_index: itemIndex,
    })
    return null
  }

  const body = (await response.json()) as Partial<RecipeGenerationResponse> & {
    error?: string
  }

  if (!response.ok || !body || !body.success || !body.recipe_id) {
    throw new Error(body?.error ?? 'recipes-ai failed to generate recipe')
  }

  return body.recipe_id
}

const assignRecipes = async (
  draft: MealPlanDraftRecord,
  preferences: HouseholdPreferenceAggregate,
  request: ResolvedRecipeAssignerRequest,
): Promise<AssignmentRunResult> => {
  const sessionPreferences = extractSessionPreferences(draft)
  const startTime = Date.now()
  const MAX_EXECUTION_TIME_MS = 50000 // 50 seconds max (leave 10s buffer for edge function)
  const SAFETY_BUFFER_MS = 5000
  const SAVE_INTERVAL = 3

  const clonedItems = draft.items.map((item) => ({ ...item }))
  const assignments: RecipeAssignmentResult[] = []

  const totalItems = clonedItems.length
  const assignedBeforeRun = clonedItems.filter((item) => Boolean(item.recipe_id)).length

  let totalAssigned = assignedBeforeRun
  let pendingAssignments = 0
  let hasMore = false
  let dirty = false

  logger.info('Starting recipe assignment run', {
    draft_id: draft.id,
    total_items: totalItems,
    already_assigned: assignedBeforeRun,
  })

  const persistIfDirty = async (context: Record<string, unknown>) => {
    if (!dirty) {
      return
    }

    try {
      await persistAssignments(draft.id, clonedItems)
      logger.info('Persisted recipe assignments', context)
      dirty = false
    } catch (saveError) {
      logger.warn('Failed to persist assignments', {
        context,
        error: saveError instanceof Error ? saveError.message : String(saveError),
      })
      throw saveError
    }
  }

  for (let index = 0; index < clonedItems.length; index += 1) {
    const item = clonedItems[index]
    const itemLogger = logger.child(`Item ${index + 1}/${clonedItems.length}`)
    const elapsedTime = Date.now() - startTime
    const timeRemaining = MAX_EXECUTION_TIME_MS - elapsedTime
    const generationStatus = getGenerationStatus(item)

    if (generationStatus?.state === 'resolved' && item.recipe_id) {
      const resolvedItem = markItemGenerationResolved(item, item.recipe_id, index)
      if (resolvedItem !== item) {
        clonedItems[index] = resolvedItem
        dirty = true
      }
      continue
    }

    if (generationStatus?.state === 'pending') {
      pendingAssignments += 1
      itemLogger.info('Item awaiting async recipe generation callback', {
        draft_id: draft.id,
        item_index: index,
        requested_at: generationStatus.requested_at,
      })
      continue
    }

    if (item.recipe_id) {
      const cleaned = clearGenerationStatus(item)
      if (cleaned !== item) {
        clonedItems[index] = cleaned
        dirty = true
      }
      itemLogger.info('Skipping already assigned item', { recipe_id: item.recipe_id })
      continue
    }

    if (timeRemaining <= SAFETY_BUFFER_MS) {
      hasMore = true
      itemLogger.info('Stopping run before timeout', {
        elapsed_ms: elapsedTime,
        time_remaining_ms: timeRemaining,
        assigned_this_run: assignments.length,
        items_remaining: clonedItems.length - index,
      })
      break
    }

    itemLogger.info('Processing item', {
      title: item.title,
      meal_type: item.meal_type,
      elapsed_ms: elapsedTime,
      time_remaining_ms: timeRemaining,
    })

    try {
      itemLogger.info('Using AI tools for recipe assignment')
      const recipeId = await callAiWithTools(
        item,
        preferences,
        sessionPreferences,
        request,
        draft.id,
        index,
      )

      if (recipeId) {
        const updatedItem = markItemGenerationResolved(item, recipeId, index)
        clonedItems[index] = updatedItem
        assignments.push({
          itemIndex: index,
          recipeId,
          confidence: 0.85,
          source: 'ai_tools',
        })
        totalAssigned += 1
        dirty = true
        itemLogger.info('Recipe assigned via AI tools', {
          recipe_id: recipeId,
          elapsed_ms: Date.now() - startTime,
        })
      } else {
        pendingAssignments += 1
        clonedItems[index] = markItemPendingGeneration(item, index, 'ai_tools')
        dirty = true
        itemLogger.info('Recipe generation deferred pending callback', {
          draft_id: draft.id,
          item_index: index,
          source: 'ai_tools',
        })
        await persistIfDirty({
          draft_id: draft.id,
          pending_item_index: index,
          reason: 'pending_generation_ai_tools',
        })
        continue
      }
    } catch (error) {
      itemLogger.warn('AI tools failed, attempting deterministic fallback', {
        error: error instanceof Error ? error.message : String(error),
        elapsed_ms: Date.now() - startTime,
      })

      try {
        const existing = await findExistingRecipe(item, preferences, request.user_id)
        if (existing) {
          const updatedItem = markItemGenerationResolved(item, existing.recipeId, index)
          clonedItems[index] = updatedItem
          assignments.push({
            itemIndex: index,
            recipeId: existing.recipeId,
            confidence: existing.confidence,
            source: 'existing',
          })
          totalAssigned += 1
          dirty = true
          itemLogger.info('Matched existing recipe (fallback)', {
            recipe_id: existing.recipeId,
            confidence: existing.confidence,
            elapsed_ms: Date.now() - startTime,
          })
          continue
        }
      } catch (fallbackError) {
        itemLogger.warn('Existing recipe lookup failed (fallback)', {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        })
      }

      itemLogger.info('Falling back to recipes-ai')
      const recipeId = await callRecipesAi(item, preferences, sessionPreferences, request, index)

      if (recipeId) {
        const updatedItem = markItemGenerationResolved(item, recipeId, index)
        clonedItems[index] = updatedItem
        assignments.push({
          itemIndex: index,
          recipeId,
          confidence: 0.75,
          source: 'generated',
        })
        totalAssigned += 1
        dirty = true
        itemLogger.info('Generated new recipe (fallback)', {
          recipe_id: recipeId,
          elapsed_ms: Date.now() - startTime,
        })
      } else {
        pendingAssignments += 1
        clonedItems[index] = markItemPendingGeneration(item, index, 'recipes_ai')
        dirty = true
        itemLogger.info('recipes-ai accepted generation asynchronously', {
          draft_id: draft.id,
          item_index: index,
        })
        await persistIfDirty({
          draft_id: draft.id,
          pending_item_index: index,
          reason: 'pending_generation_recipes_ai',
        })
      }
    }

    if (assignments.length > 0 && assignments.length % SAVE_INTERVAL === 0) {
      await persistIfDirty({
        draft_id: draft.id,
        assignments_saved: assignments.length,
        elapsed_ms: Date.now() - startTime,
      })
    }
  }

  if (dirty) {
    await persistIfDirty({
      draft_id: draft.id,
      assignments_saved: assignments.length,
      elapsed_ms: Date.now() - startTime,
      reason: hasMore ? 'finalize_partial' : 'finalize_run',
    })
  }

  const elapsedMs = Date.now() - startTime
  const remaining = totalItems - totalAssigned
  const nextItemIndex = clonedItems.findIndex((entry) => {
    if (entry.recipe_id) {
      return false
    }
    const status = getGenerationStatus(entry)
    return status?.state !== 'pending'
  })

  logger.info('Recipe assignment run complete', {
    draft_id: draft.id,
    elapsed_ms: elapsedMs,
    assigned_this_run: assignments.length,
    total_assigned: totalAssigned,
    pending_assignments: pendingAssignments,
    remaining,
    has_more: hasMore || pendingAssignments > 0,
  })

  return {
    assignments,
    hasMore: hasMore || pendingAssignments > 0,
    stats: {
      totalItems,
      assignedBeforeRun,
      assignedThisRun: assignments.length,
      totalAssigned,
      remaining,
      elapsedMs,
      nextItemIndex: nextItemIndex === -1 ? null : nextItemIndex,
      pendingAssignments,
    },
  }
}
const handleGenerationCallback = async (
  draft: MealPlanDraftRecord,
  request: RecipeAssignerRequest,
): Promise<Response> => {
  const recipeId = request.callback_recipe_id
  if (!recipeId) {
    logger.warn('Callback missing recipe identifier', {
      draft_id: draft.id,
      request_payload: request,
    })
    return createErrorResponse('callback_recipe_id is required for callbacks', 400)
  }

  let targetIndex =
    typeof request.draft_item_index === 'number' ? request.draft_item_index : undefined

  if (targetIndex === undefined || targetIndex < 0 || targetIndex >= draft.items.length) {
    targetIndex = draft.items.findIndex((item) => {
      const status = getGenerationStatus(item)
      return status?.state === 'pending' && (!status.item_index || status.item_index >= 0)
    })
  }

  if (targetIndex === -1) {
    const alreadyAssigned = draft.items.some((item) => item.recipe_id === recipeId)
    if (alreadyAssigned) {
      logger.info('Callback ignored - recipe already assigned elsewhere', {
        draft_id: draft.id,
        recipe_id: recipeId,
      })
      return createJsonResponse({ success: true, message: 'Recipe already assigned' }, 200)
    }

    logger.warn('Callback without matching draft item', {
      draft_id: draft.id,
      recipe_id: recipeId,
      provided_index: request.draft_item_index,
    })
    return createJsonResponse(
      {
        success: false,
        message: 'No matching draft item found for callback',
      },
      202,
    )
  }

  const targetItem = draft.items[targetIndex]

  if (targetItem.recipe_id === recipeId) {
    logger.info('Callback ignored - item already assigned to recipe', {
      draft_id: draft.id,
      recipe_id: recipeId,
      item_index: targetIndex,
    })
    return createJsonResponse({ success: true, message: 'Recipe already assigned' }, 200)
  }

  if (targetItem.recipe_id && targetItem.recipe_id !== recipeId) {
    logger.info('Callback received but item already bound to other recipe', {
      draft_id: draft.id,
      existing_recipe_id: targetItem.recipe_id,
      received_recipe_id: recipeId,
      item_index: targetIndex,
    })
    return createJsonResponse(
      {
        success: true,
        message: 'Item already assigned to a different recipe',
      },
      200,
    )
  }

  const updatedItems = [...draft.items]
  const updatedItem = markItemGenerationResolved(targetItem, recipeId, targetIndex)
  updatedItems[targetIndex] = updatedItem

  await persistAssignments(draft.id, updatedItems)
  draft.items = updatedItems

  logger.info('Applied recipe generation callback', {
    draft_id: draft.id,
    recipe_id: recipeId,
    item_index: targetIndex,
  })

  return createJsonResponse(
    {
      success: true,
      draft_id: draft.id,
      recipe_id: recipeId,
      item_index: targetIndex,
    },
    200,
  )
}
const persistAssignments = async (draftId: string, items: MealPlanDraftItem[]) => {
  const { error } = await supabaseAdmin
    .from('meal_plan_drafts')
    .update({
      items,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (error) {
    throw error
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) {
    return corsResponse
  }

  if (req.method !== 'POST') {
    return createErrorResponse('Method not allowed', 405)
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'Invalid JSON body',
      400,
    )
  }

  try {
    const request = parseRequest(payload)
    const draft = await loadDraft(request.draft_id)

    if (request.is_callback) {
      return await handleGenerationCallback(draft, request)
    }

    const resolvedRequest = resolveRequest(request, draft)

    const householdPreferences = await fetchHouseholdPreferences(
      supabaseAdmin,
      resolvedRequest.household_id,
    )
    logger.info('Fetched household preferences', {
      household_id: resolvedRequest.household_id,
      members: householdPreferences.members.length,
    })

    const runResult = await assignRecipes(draft, householdPreferences, resolvedRequest)

    logger.info('Recipe assignment response prepared', {
      draft_id: draft.id,
      has_more: runResult.hasMore,
      assigned_this_run: runResult.stats.assignedThisRun,
      total_assigned: runResult.stats.totalAssigned,
      remaining: runResult.stats.remaining,
      pending_assignments: runResult.stats.pendingAssignments ?? 0,
    })

    const statusCode = runResult.hasMore ? 202 : 200
    const pendingCount = runResult.stats.pendingAssignments ?? 0

    return createJsonResponse(
      {
        success: true,
        draft_id: draft.id,
        status: runResult.hasMore ? 'partial' : 'completed',
        assignments: runResult.assignments,
        stats: runResult.stats,
        has_more: runResult.hasMore,
        pending_assignments: pendingCount,
        progress_ratio:
          runResult.stats.totalItems > 0
            ? Math.min(
                1,
                (runResult.stats.totalAssigned + pendingCount) / runResult.stats.totalItems,
              )
            : 1,
        resume_hint: runResult.hasMore
          ? {
              next_item_index: runResult.stats.nextItemIndex,
              remaining: runResult.stats.remaining,
            }
          : null,
      },
      statusCode,
    )
  } catch (error) {
    const status = error instanceof ValidationError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unexpected error'
    logger.error('Recipe assignment failed', {
      message,
      error: error instanceof Error ? error.stack : error,
    })
    return createErrorResponse(message, status)
  }
})





