import {
  NormalizedMealPlanRequest,
  NormalizedPayloadResult,
  SessionPreferences,
  ValidationError,
} from './types.ts'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface ValidationOptions {
  userIdFromToken: string
  fallbackHouseholdId?: string
}

type PlainRecord = Record<string, unknown>

const isRecord = (value: unknown): value is PlainRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readString = (source: PlainRecord, keys: string[], required = true): string | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  if (required) {
    throw new ValidationError(`Missing required field: ${keys[0]}`)
  }
  return undefined
}

const readNumber = (source: PlainRecord, keys: string[], required = true): number | undefined => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value
    }
  }
  if (required) {
    throw new ValidationError(`Missing required field: ${keys[0]}`)
  }
  return undefined
}

const readBoolean = (source: PlainRecord, keys: string[], fallback: boolean): boolean => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return fallback
}

const readPreferences = (source: PlainRecord, keys: string[]): SessionPreferences => {
  for (const key of keys) {
    const value = source[key]
    if (isRecord(value)) {
      return value as SessionPreferences
    }
  }
  return {}
}

const validateDate = (value: string, field: string): string => {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new ValidationError(`${field} must be formatted as YYYY-MM-DD`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`)
  }
  return value
}

const determineScope = (start: string, end: string): 'daily' | 'weekly' | 'monthly' => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  if (diffDays <= 1) {
    return 'daily'
  }
  if (diffDays <= 7) {
    return 'weekly'
  }
  return 'monthly'
}

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }
  if (isRecord(value)) {
    const sortedEntries = Object.entries(value)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, val]) => [key, sortObject(val)])
    return Object.fromEntries(sortedEntries)
  }
  return value
}

const createPayloadSignature = async (payload: Record<string, unknown>): Promise<string> => {
  const encoder = new TextEncoder()
  const canonical = JSON.stringify(sortObject(payload))
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const validateAndNormalizePayload = async (
  raw: unknown,
  options: ValidationOptions,
): Promise<NormalizedPayloadResult> => {
  if (!isRecord(raw)) {
    throw new ValidationError('Request payload must be a JSON object')
  }

  const startDate = validateDate(readString(raw, ['start_date', 'startDate']) ?? '', 'start_date')
  const endDate = validateDate(readString(raw, ['end_date', 'endDate']) ?? '', 'end_date')

  if (endDate < startDate) {
    throw new ValidationError('end_date must be greater than or equal to start_date')
  }

  const mealsPerDay = readNumber(raw, ['meals_per_day', 'mealsPerDay'])
  if (mealsPerDay === undefined || mealsPerDay < 1 || mealsPerDay > 6) {
    throw new ValidationError('meals_per_day must be between 1 and 6')
  }

  const householdId =
    readString(raw, ['household_id', 'householdId'], false) ??
    (options.fallbackHouseholdId
      ? options.fallbackHouseholdId
      : (() => {
          throw new ValidationError('household_id is required')
        })())

  const planTitle =
    readString(raw, ['plan_title', 'planTitle'], false) ?? `Meal Plan ${startDate} - ${endDate}`

  const freeformPrompt =
    readString(raw, ['freeform_prompt', 'freeformPrompt'], false) ?? null

  const useUserPreferences = readBoolean(
    raw,
    ['use_user_preferences', 'applyProfilePreferences'],
    true,
  )
  const autoGenerateGroceryList = readBoolean(
    raw,
    ['auto_generate_grocery_list', 'autoGenerateGroceryList'],
    true,
  )
  const includePantryInventory = readBoolean(
    raw,
    ['include_pantry_inventory', 'includePantryInventory'],
    true,
  )

  const sessionPreferences = readPreferences(raw, [
    'session_preferences',
    'sessionPreferences',
  ])

  const normalized: NormalizedMealPlanRequest = {
    user_id: options.userIdFromToken,
    household_id: householdId,
    plan_title: planTitle,
    start_date: startDate,
    end_date: endDate,
    scope: determineScope(startDate, endDate),
    timezone: 'UTC',
    meals_per_day: mealsPerDay,
    use_user_preferences: useUserPreferences,
    session_preferences: sessionPreferences,
    freeform_prompt: freeformPrompt,
    auto_generate_grocery_list: autoGenerateGroceryList,
    include_pantry_inventory: includePantryInventory,
  }

  const canonicalPayload: Record<string, unknown> = {
    user_id: normalized.user_id,
    household_id: normalized.household_id,
    plan_title: normalized.plan_title,
    start_date: normalized.start_date,
    end_date: normalized.end_date,
    scope: normalized.scope,
    timezone: normalized.timezone,
    meals_per_day: normalized.meals_per_day,
    use_user_preferences: normalized.use_user_preferences,
    session_preferences: normalized.session_preferences,
    freeform_prompt: normalized.freeform_prompt,
    auto_generate_grocery_list: normalized.auto_generate_grocery_list,
    include_pantry_inventory: normalized.include_pantry_inventory,
  }

  const payloadSignature = await createPayloadSignature(canonicalPayload)

  normalized.payload_signature = payloadSignature

  return {
    normalized,
    canonicalPayload,
    payloadSignature,
  }
}
