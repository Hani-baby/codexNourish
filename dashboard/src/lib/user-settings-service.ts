import { supabase } from './supabase'

export interface UserSettings {
  id: string
  user_id: string
  dietary_restrictions?: string[]
  allergies?: string[]
  cuisine_preferences?: string[]
  cooking_skill_level?: 'beginner' | 'intermediate' | 'advanced'
  meal_prep_time?: string
  household_size?: number
  budget_range?: string
  preferred_meal_times?: {
    breakfast?: string
    lunch?: string
    dinner?: string
  }
  notification_preferences?: {
    meal_reminders?: boolean
    grocery_reminders?: boolean
    recipe_suggestions?: boolean
  }
  instacart_store_id?: string
  delivery_address?: string
  preferred_delivery_time?: string
  created_at: string
  updated_at: string
}

export interface NutritionGoals {
  id: string
  user_id: string
  daily_calories?: number
  protein_grams?: number
  carbs_grams?: number
  fat_grams?: number
  fiber_grams?: number
  sodium_mg?: number
  sugar_grams?: number
  goal_type?: 'weight_loss' | 'weight_gain' | 'maintenance' | 'muscle_gain'
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  height_cm?: number
  weight_kg?: number
  avatar_url?: string
  timezone?: string
  created_at: string
  updated_at: string
}

// Get user settings
export async function getUserSettings(): Promise<UserSettings | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Update user settings
export async function updateUserSettings(settings: Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<UserSettings> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if settings exist
  const existing = await getUserSettings()

  if (existing) {
    // Update existing settings
    const { data, error } = await supabase
      .from('user_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Create new settings
    const { data, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        ...settings
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Get nutrition goals
export async function getNutritionGoals(): Promise<NutritionGoals | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Update nutrition goals
export async function updateNutritionGoals(goals: Partial<Omit<NutritionGoals, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<NutritionGoals> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if goals exist
  const existing = await getNutritionGoals()

  if (existing) {
    // Update existing goals
    const { data, error } = await supabase
      .from('nutrition_goals')
      .update({
        ...goals,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Create new goals
    const { data, error } = await supabase
      .from('nutrition_goals')
      .insert({
        user_id: user.id,
        ...goals
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Get user profile
export async function getUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Update user profile
export async function updateUserProfile(profile: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if profile exists
  const existing = await getUserProfile()

  if (existing) {
    // Update existing profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...profile,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Create new profile
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        ...profile
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Get complete user data (settings + goals + profile)
export async function getCompleteUserData(): Promise<{
  settings: UserSettings | null
  goals: NutritionGoals | null
  profile: UserProfile | null
}> {
  const [settings, goals, profile] = await Promise.all([
    getUserSettings(),
    getNutritionGoals(),
    getUserProfile()
  ])

  return { settings, goals, profile }
}

// Calculate recommended nutrition goals based on user profile
export async function calculateRecommendedGoals(): Promise<Partial<NutritionGoals>> {
  const profile = await getUserProfile()
  const settings = await getUserSettings()

  if (!profile || !profile.weight_kg || !profile.height_cm) {
    throw new Error('Profile information required for goal calculation')
  }

  // Basic BMR calculation (Mifflin-St Jeor Equation)
  let bmr: number
  if (profile.gender === 'male') {
    bmr = 88.362 + (13.397 * profile.weight_kg) + (4.799 * profile.height_cm) - (5.677 * getAgeFromBirthDate(profile.date_of_birth))
  } else {
    bmr = 447.593 + (9.247 * profile.weight_kg) + (3.098 * profile.height_cm) - (4.330 * getAgeFromBirthDate(profile.date_of_birth))
  }

  // Activity multiplier
  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725
  }

  const goals = await getNutritionGoals()
  const activityLevel = goals?.activity_level || 'moderately_active'
  const dailyCalories = Math.round(bmr * activityMultipliers[activityLevel])

  // Macro distribution based on goal type
  const goalType = goals?.goal_type || 'maintenance'
  let proteinRatio = 0.25
  let carbsRatio = 0.45
  let fatRatio = 0.30

  switch (goalType) {
    case 'weight_loss':
      proteinRatio = 0.30
      carbsRatio = 0.40
      fatRatio = 0.30
      break
    case 'muscle_gain':
      proteinRatio = 0.30
      carbsRatio = 0.45
      fatRatio = 0.25
      break
    case 'weight_gain':
      proteinRatio = 0.25
      carbsRatio = 0.50
      fatRatio = 0.25
      break
  }

  return {
    daily_calories: dailyCalories,
    protein_grams: Math.round((dailyCalories * proteinRatio) / 4), // 4 calories per gram
    carbs_grams: Math.round((dailyCalories * carbsRatio) / 4),
    fat_grams: Math.round((dailyCalories * fatRatio) / 9), // 9 calories per gram
    fiber_grams: Math.round(profile.weight_kg * 0.5), // 0.5g per kg body weight
    sodium_mg: 2300, // Standard recommendation
    activity_level: activityLevel,
    goal_type: goalType
  }
}

// Helper function to calculate age from birth date
function getAgeFromBirthDate(birthDate?: string): number {
  if (!birthDate) return 30 // Default age if not provided
  
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

// Reset all user data (for account deletion or reset)
export async function resetUserData(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Delete in order to respect foreign key constraints
  await Promise.all([
    supabase.from('meal_plan_items').delete().eq('meal_plan_id', 
      supabase.from('meal_plans').select('id').eq('user_id', user.id)
    ),
    supabase.from('grocery_list_items').delete().eq('grocery_list_id',
      supabase.from('grocery_lists').select('id').eq('user_id', user.id)
    ),
    supabase.from('async_jobs').delete().eq('user_id', user.id),
    supabase.from('nutrition_logs').delete().eq('user_id', user.id),
    supabase.from('ingredient_inventory').delete().eq('user_id', user.id)
  ])

  await Promise.all([
    supabase.from('meal_plans').delete().eq('user_id', user.id),
    supabase.from('grocery_lists').delete().eq('user_id', user.id),
    supabase.from('shopping_history').delete().eq('user_id', user.id)
  ])

  await Promise.all([
    supabase.from('user_settings').delete().eq('user_id', user.id),
    supabase.from('nutrition_goals').delete().eq('user_id', user.id),
    supabase.from('profiles').delete().eq('user_id', user.id)
  ])
}