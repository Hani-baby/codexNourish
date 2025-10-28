import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'

type JsonRecord = Record<string, unknown>

interface HouseholdMemberPreference {
  user_id: string
  role: string
  display_name?: string | null
  preferences?: JsonRecord
  dietary_preferences?: JsonRecord
  cooking_preferences?: JsonRecord
}

export interface HouseholdPreferenceAggregate {
  members: HouseholdMemberPreference[]
  combined: {
    cuisines: string[]
    dislikes: string[]
    dietary_patterns: string[]
    excluded_ingredients: string[]
    allergies: string[]
    convenience_level?: string
    cooking_time?: string
    leftovers_policy?: string
  }
}

const uniqueStrings = (values: Array<unknown>) => {
  const bucket = new Set<string>()
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        bucket.add(trimmed)
      }
    }
  }
  return Array.from(bucket)
}

const collectString = (value: unknown, store: string[]) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    store.push(value.trim())
  }
}

const collectArrayValues = (source: JsonRecord | undefined, keys: string[], into: string[]) => {
  if (!source) return
  for (const key of keys) {
    const raw = source[key]
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (typeof entry === 'string' && entry.trim()) {
          into.push(entry.trim())
        }
      }
    }
  }
}

export const fetchHouseholdPreferences = async (
  client: SupabaseClient,
  householdId: string,
): Promise<HouseholdPreferenceAggregate> => {
  const { data: members, error: membersError } = await client
    .from('household_members')
    .select('user_id, role, status')
    .eq('household_id', householdId)
    .eq('status', 'active')

  if (membersError) {
    throw membersError
  }

  const memberIds = (members ?? []).map((row) => row.user_id).filter(Boolean) as string[]

  if (memberIds.length === 0) {
    return {
      members: [],
      combined: {
        cuisines: [],
        dislikes: [],
        dietary_patterns: [],
        excluded_ingredients: [],
        allergies: [],
      },
    }
  }

  const [{ data: profileRows, error: profileError }, { data: settingsRows, error: settingsError }] =
    await Promise.all([
      client
        .from('profiles')
        .select('id, display_name, preferences')
        .in('id', memberIds),
      client
        .from('user_settings')
        .select('user_id, dietary_preferences, cooking_preferences')
        .in('user_id', memberIds),
    ])

  if (profileError) {
    throw profileError
  }

  if (settingsError) {
    throw settingsError
  }

  const profilesByUser = new Map<string, { display_name?: string | null; preferences?: JsonRecord }>(
    (profileRows ?? []).map((profile) => [
      profile.id as string,
      {
        display_name: profile.display_name ?? null,
        preferences: (profile.preferences ?? {}) as JsonRecord,
      },
    ]),
  )

  const settingsByUser = new Map<
    string,
    { dietary_preferences?: JsonRecord; cooking_preferences?: JsonRecord }
  >(
    (settingsRows ?? []).map((settings) => [
      settings.user_id as string,
      {
        dietary_preferences: (settings.dietary_preferences ?? {}) as JsonRecord,
        cooking_preferences: (settings.cooking_preferences ?? {}) as JsonRecord,
      },
    ]),
  )

  const cuisines: string[] = []
  const dislikes: string[] = []
  const dietaryPatterns: string[] = []
  const excludedIngredients: string[] = []
  const allergies: string[] = []
  const convenienceLevels: string[] = []
  const cookingTimes: string[] = []
  const leftoversPolicies: string[] = []

  const aggregatedMembers: HouseholdMemberPreference[] = memberIds.map((userId) => {
    const profile = profilesByUser.get(userId)
    const settings = settingsByUser.get(userId)

    const preferenceSources: JsonRecord[] = []
    if (profile?.preferences) {
      preferenceSources.push(profile.preferences)
    }
    if (settings?.dietary_preferences) {
      preferenceSources.push(settings.dietary_preferences)
    }
    if (settings?.cooking_preferences) {
      preferenceSources.push(settings.cooking_preferences)
    }

    for (const source of preferenceSources) {
      collectArrayValues(source, ['cuisines', 'favorite_cuisines', 'preferred_cuisines'], cuisines)
      collectArrayValues(source, ['dislikes', 'disliked_ingredients'], dislikes)
      collectArrayValues(source, ['dietary_patterns', 'diets', 'eating_styles'], dietaryPatterns)
      collectArrayValues(
        source,
        ['excluded_ingredients', 'avoid', 'restrictions'],
        excludedIngredients,
      )
      collectArrayValues(source, ['allergies', 'allergens'], allergies)

      collectString(source.convenience_level, convenienceLevels)
      collectString(source.cooking_time, cookingTimes)
      collectString(source.leftovers_policy, leftoversPolicies)
    }

    const memberRecord = members?.find((row) => row.user_id === userId)

    return {
      user_id: userId,
      role: memberRecord?.role ?? 'member',
      display_name: profile?.display_name ?? null,
      preferences: profile?.preferences,
      dietary_preferences: settings?.dietary_preferences,
      cooking_preferences: settings?.cooking_preferences,
    }
  })

  const pickMostFrequent = (values: string[]): string | undefined => {
    if (values.length === 0) return undefined
    const frequency = new Map<string, number>()
    for (const value of values) {
      frequency.set(value, (frequency.get(value) ?? 0) + 1)
    }
    let max = 0
    let selected: string | undefined
    for (const [value, count] of frequency.entries()) {
      if (count > max) {
        max = count
        selected = value
      }
    }
    return selected
  }

  return {
    members: aggregatedMembers,
    combined: {
      cuisines: uniqueStrings(cuisines),
      dislikes: uniqueStrings(dislikes),
      dietary_patterns: uniqueStrings(dietaryPatterns),
      excluded_ingredients: uniqueStrings(excludedIngredients),
      allergies: uniqueStrings(allergies),
      convenience_level: pickMostFrequent(convenienceLevels),
      cooking_time: pickMostFrequent(cookingTimes),
      leftovers_policy: pickMostFrequent(leftoversPolicies),
    },
  }
}
