/**
 * Recipe Assigner Function
 * 
 * Purpose: Map every draft meal item to the single best compatible recipe in our database,
 * or mark it as unmatched—fast, deterministic, and safe.
 * 
 * Core Principles:
 * - NO OpenAI calls or tool calling
 * - NO recipe generation
 * - Purely deterministic matching of existing recipes
 * - Returns unmatched items for planner to handle
 * 
 * Inputs:
 * - draft_id (required)
 * - household_id, user_id (scope & permissions)
 * - Optional: start_index, max_items, time_budget_ms, min_confidence, strategy
 * 
 * Outputs:
 * - assignments: [{ itemIndex, recipeId, confidence, source }]
 * - unmatched_item_indexes: number[]
 * - stats: totals, assignedBeforeRun, assignedThisRun, totalAssigned, remaining, elapsedMs, nextItemIndex
 * - has_more: true if stopped early due to time budget or chunking
 * 
 * Match Quality Rules:
 * ✅ Required dietary tags present
 * ✅ No blocked dietary tags
 * ✅ No blocked ingredients substrings
 * ✅ Confidence ≥ threshold (default 0.8)
 * 
 * Features:
 * - Idempotent: re-running doesn't duplicate or flip assignments
 * - Time-budget aware: stops cleanly with has_more = true
 * - Batch persistence: saves progress periodically
 * - RLS-aware: only matches recipes visible to user (public or owner)
 */

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
  ValidationError,
} from '../_shared/types.ts'

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
  unmatched_item_indexes: number[]
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

  let startIndex: number | undefined
  const rawStartIndex = payload.start_index
  if (typeof rawStartIndex === 'number' && Number.isInteger(rawStartIndex) && rawStartIndex >= 0) {
    startIndex = rawStartIndex
  } else if (typeof rawStartIndex === 'string' && rawStartIndex.trim()) {
    const parsed = Number.parseInt(rawStartIndex.trim(), 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      startIndex = parsed
    }
  }

  let maxItems: number | undefined
  const rawMaxItems = payload.max_items
  if (typeof rawMaxItems === 'number' && Number.isInteger(rawMaxItems) && rawMaxItems > 0) {
    maxItems = rawMaxItems
  } else if (typeof rawMaxItems === 'string' && rawMaxItems.trim()) {
    const parsed = Number.parseInt(rawMaxItems.trim(), 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      maxItems = parsed
    }
  }

  let timeBudgetMs: number | undefined
  const rawTimeBudget = payload.time_budget_ms
  if (typeof rawTimeBudget === 'number' && rawTimeBudget > 0) {
    timeBudgetMs = rawTimeBudget
  } else if (typeof rawTimeBudget === 'string' && rawTimeBudget.trim()) {
    const parsed = Number.parseInt(rawTimeBudget.trim(), 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      timeBudgetMs = parsed
    }
  }

  let minConfidence: number | undefined
  const rawMinConf = payload.min_confidence
  if (typeof rawMinConf === 'number' && rawMinConf >= 0 && rawMinConf <= 1) {
    minConfidence = rawMinConf
  } else if (typeof rawMinConf === 'string' && rawMinConf.trim()) {
    const parsed = Number.parseFloat(rawMinConf.trim())
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      minConfidence = parsed
    }
  }

  const strategy = optionalString(payload.strategy)

  const request: RecipeAssignerRequest = {
    draft_id: draftId,
    ...(householdId ? { household_id: householdId } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(startIndex !== undefined ? { start_index: startIndex } : {}),
    ...(maxItems !== undefined ? { max_items: maxItems } : {}),
    ...(timeBudgetMs !== undefined ? { time_budget_ms: timeBudgetMs } : {}),
    ...(minConfidence !== undefined ? { min_confidence: minConfidence } : {}),
    ...(strategy ? { strategy } : {}),
  }
  
  logger.info('Recipe assigner payload received', {
    draft_id: request.draft_id,
    household_id: request.household_id,
    user_id: request.user_id,
    start_index: startIndex,
    max_items: maxItems,
    time_budget_ms: timeBudgetMs,
    min_confidence: minConfidence,
    strategy,
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
  minConfidence: number = 0.8,
): { candidate: RecipeCandidate; confidence: number; rejectionReasons: string[] } | null => {
  const compatible: Array<{ candidate: RecipeCandidate; confidence: number }> = []
  const rejectionReasons: string[] = []

  for (const candidate of candidates) {
    const dietaryTags = normalizeLowercase(candidate.dietary_tags ?? [])
    const ingredients = normalizeLowercase(candidate.ingredient_names ?? [])

    // Check required dietary tags
    if (requiredDietary.length > 0) {
      const missingTags = requiredDietary.filter((tag) => !dietaryTags.includes(tag))
      if (missingTags.length > 0) {
        rejectionReasons.push(`Missing required tags: ${missingTags.join(', ')}`)
      continue
      }
    }

    // Check blocked dietary tags
    const foundBlockedTags = blockedTags.filter((tag) => dietaryTags.includes(tag))
    if (foundBlockedTags.length > 0) {
      rejectionReasons.push(`Contains blocked tags: ${foundBlockedTags.join(', ')}`)
      continue
    }

    // Check blocked ingredients
    const foundBlockedIngredients = blockedIngredients.filter((token) =>
      ingredients.some((ingredient) => ingredient.includes(token))
    )
    if (foundBlockedIngredients.length > 0) {
      rejectionReasons.push(`Contains blocked ingredients: ${foundBlockedIngredients.join(', ')}`)
      continue
    }

    // Calculate confidence score
    const confidence =
      candidate.similarity +
      (candidate.meal_type_match ? 0.08 : 0) +
      (candidate.cuisine_match ? 0.04 : 0)

    compatible.push({ candidate, confidence })
  }

  if (compatible.length === 0) {
    logger.info('No compatible candidates found', { rejection_reasons: rejectionReasons })
    return null
  }

  // Sort by confidence (descending), then by updated_at (implicit in query order)
  compatible.sort((a, b) => b.confidence - a.confidence)
  const best = compatible[0]

  if (best.confidence < minConfidence) {
    rejectionReasons.push(`Best confidence ${best.confidence.toFixed(3)} below threshold ${minConfidence}`)
    logger.info('Best candidate below confidence threshold', {
      best_confidence: best.confidence,
      min_confidence: minConfidence,
      rejection_reasons: rejectionReasons,
    })
    return null
  }

  return {
    candidate: best.candidate,
    confidence: Math.min(1, Number(best.confidence.toFixed(3))),
    rejectionReasons,
  }
}

const findExistingRecipe = async (
  draftItem: MealPlanDraftItem,
  preferences: HouseholdPreferenceAggregate,
  userId: string,
  minConfidence: number = 0.8,
): Promise<{ recipeId: string; confidence: number; rejectionReasons: string[] } | null> => {
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

  const best = pickBestCandidate(candidates, requiredDietary, tagTokens, ingredientTokens, minConfidence)
  if (!best) {
    return null
  }

  return {
    recipeId: best.candidate.id,
    confidence: best.confidence,
    rejectionReasons: best.rejectionReasons,
  }
}


const assignRecipes = async (
  draft: MealPlanDraftRecord,
  preferences: HouseholdPreferenceAggregate,
  request: ResolvedRecipeAssignerRequest,
): Promise<AssignmentRunResult> => {
  const startTime = Date.now()
  
  // Extract configuration from request
  const startIndex = request.start_index ?? 0
  const maxItems = request.max_items
  const timeBudgetMs = request.time_budget_ms ?? 50000 // Default 50s with safety buffer
  const minConfidence = request.min_confidence ?? 0.8
  const SAFETY_BUFFER_MS = 5000
  const SAVE_INTERVAL = 3

  const clonedItems = draft.items.map((item) => ({ ...item }))
  const assignments: RecipeAssignmentResult[] = []
  const unmatchedItemIndexes: number[] = []

  const totalItems = clonedItems.length
  const assignedBeforeRun = clonedItems.filter((item) => Boolean(item.recipe_id)).length

  let totalAssigned = assignedBeforeRun
  let hasMore = false
  let dirty = false
  let processedCount = 0

  logger.info('Starting recipe assignment run', {
    draft_id: draft.id,
    total_items: totalItems,
    already_assigned: assignedBeforeRun,
    start_index: startIndex,
    max_items: maxItems,
    time_budget_ms: timeBudgetMs,
    min_confidence: minConfidence,
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

  // Main assignment loop
  const endIndex = maxItems ? Math.min(clonedItems.length, startIndex + maxItems) : clonedItems.length
  
  for (let index = startIndex; index < endIndex; index += 1) {
    const item = clonedItems[index]
    const itemLogger = logger.child(`Item ${index + 1}/${totalItems}`)
    const elapsedTime = Date.now() - startTime
    const timeRemaining = timeBudgetMs - elapsedTime

    // Check time budget
    if (timeRemaining <= SAFETY_BUFFER_MS) {
      hasMore = true
      itemLogger.info('Stopping run due to time budget', {
        elapsed_ms: elapsedTime,
        time_remaining_ms: timeRemaining,
        assigned_this_run: assignments.length,
        unmatched_this_run: unmatchedItemIndexes.length,
        items_remaining: endIndex - index,
      })
      break
    }

    // Skip items that already have recipe_id (idempotent)
    if (item.recipe_id) {
      itemLogger.info('Skipping already assigned item', { recipe_id: item.recipe_id })
      continue
    }

    // Check for pending async generation status (skip if waiting for callback)
    const generationStatus = getGenerationStatus(item)
    if (generationStatus?.state === 'pending') {
      itemLogger.info('Skipping item awaiting async generation', {
        draft_id: draft.id,
        item_index: index,
        requested_at: generationStatus.requested_at,
      })
      continue
    }

    itemLogger.info('Processing item for recipe matching', {
      title: item.title,
      meal_type: item.meal_type,
      elapsed_ms: elapsedTime,
      time_remaining_ms: timeRemaining,
    })

    try {
      // Attempt to find existing recipe match
      const existingMatch = await findExistingRecipe(item, preferences, request.user_id, minConfidence)
      
      if (existingMatch) {
        // Assign recipe
        const updatedItem = clearGenerationStatus({ ...item, recipe_id: existingMatch.recipeId })
        clonedItems[index] = updatedItem
        assignments.push({
          itemIndex: index,
          recipeId: existingMatch.recipeId,
          confidence: existingMatch.confidence,
          source: 'existing',
        })
        totalAssigned += 1
        dirty = true
        
        itemLogger.info('Recipe matched and assigned', {
          recipe_id: existingMatch.recipeId,
          confidence: existingMatch.confidence,
          elapsed_ms: Date.now() - startTime,
        })
      } else {
        // No match found - add to unmatched
        unmatchedItemIndexes.push(index)
        itemLogger.info('No suitable recipe match found', {
          title: item.title,
          meal_type: item.meal_type,
          min_confidence: minConfidence,
        })
      }
    } catch (error) {
      itemLogger.warn('Recipe matching failed for item', {
        error: error instanceof Error ? error.message : String(error),
        elapsed_ms: Date.now() - startTime,
      })
      // On error, add to unmatched rather than crashing
      unmatchedItemIndexes.push(index)
    }

    processedCount += 1

    // Periodic persistence
    if (dirty && (processedCount % SAVE_INTERVAL === 0)) {
      await persistIfDirty({
        draft_id: draft.id,
        assignments_saved: assignments.length,
        elapsed_ms: Date.now() - startTime,
      })
    }
  }

  // Final persistence
  if (dirty) {
    await persistIfDirty({
      draft_id: draft.id,
      assignments_saved: assignments.length,
      unmatched_count: unmatchedItemIndexes.length,
      elapsed_ms: Date.now() - startTime,
      reason: hasMore ? 'finalize_partial' : 'finalize_run',
    })
  }

  const elapsedMs = Date.now() - startTime
  const remaining = totalItems - totalAssigned
  
  // Find next item index for resumption
  let nextItemIndex: number | null = null
  if (hasMore || endIndex < clonedItems.length) {
    for (let i = endIndex; i < clonedItems.length; i++) {
      if (!clonedItems[i].recipe_id) {
        const status = getGenerationStatus(clonedItems[i])
        if (status?.state !== 'pending') {
          nextItemIndex = i
          break
        }
      }
    }
  }

  logger.info('Recipe assignment run complete', {
    draft_id: draft.id,
    elapsed_ms: elapsedMs,
    assigned_this_run: assignments.length,
    total_assigned: totalAssigned,
    unmatched_this_run: unmatchedItemIndexes.length,
    remaining,
    has_more: hasMore || nextItemIndex !== null,
    next_item_index: nextItemIndex,
  })

  return {
    assignments,
    unmatched_item_indexes: unmatchedItemIndexes,
    hasMore: hasMore || nextItemIndex !== null,
    stats: {
      totalItems,
      assignedBeforeRun,
      assignedThisRun: assignments.length,
      totalAssigned,
      remaining,
      elapsedMs,
      nextItemIndex,
      pendingAssignments: 0, // No async generation anymore
    },
  }
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
      unmatched_this_run: runResult.unmatched_item_indexes.length,
      total_assigned: runResult.stats.totalAssigned,
      remaining: runResult.stats.remaining,
    })

    const statusCode = runResult.hasMore ? 202 : 200

    return createJsonResponse(
      {
        success: true,
        draft_id: draft.id,
        status: runResult.hasMore ? 'partial' : 'completed',
        assignments: runResult.assignments,
        unmatched_item_indexes: runResult.unmatched_item_indexes,
        stats: runResult.stats,
        has_more: runResult.hasMore,
        progress_ratio:
          runResult.stats.totalItems > 0
            ? runResult.stats.totalAssigned / runResult.stats.totalItems
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





