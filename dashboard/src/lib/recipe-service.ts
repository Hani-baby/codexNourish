import { supabase } from './supabase'

export interface Recipe {
  id: string
  title: string
  description?: string
  instructions?: string[]
  prep_time?: number
  cook_time?: number
  total_time?: number
  servings: number
  difficulty_level?: 'easy' | 'medium' | 'hard'
  cuisine_type?: string
  created_by?: string
  is_ai_generated?: boolean
  is_public?: boolean
  image_url?: string
  source_url?: string
  created_at: string
  updated_at: string
  recipe_ingredients?: RecipeIngredient[]
  recipe_nutrition?: RecipeNutrition[]
  recipe_tags?: RecipeTag[]
  recipe_ratings?: RecipeRating[]
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  ingredient_name: string
  quantity: string
  unit: string
  preparation_notes?: string
  order_index?: number
}

export interface RecipeNutrition {
  id: string
  recipe_id: string
  calories_per_serving?: number
  protein_grams?: number
  carbs_grams?: number
  fat_grams?: number
  fiber_grams?: number
  sodium_mg?: number
  sugar_grams?: number
}

export interface RecipeTag {
  id: string
  recipe_id: string
  tag_name: string
}

export interface RecipeRating {
  id: string
  recipe_id: string
  user_id: string
  rating: number
  review?: string
  created_at: string
}

// Get all recipes (public + user's private)
export async function getRecipes(filters?: {
  cuisine?: string
  difficulty?: string
  maxPrepTime?: number
  dietary?: string[]
  search?: string
  mealTypes?: string[]
  limit?: number
  offset?: number
}): Promise<Recipe[]> {
  const { data: { user } } = await supabase.auth.getUser()
  
  let query = supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(*),
      recipe_nutrition(*),
      recipe_tags(*),
      recipe_ratings(rating)
    `)

  // Filter by public recipes or user's own recipes
  if (user) {
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`)
  } else {
    query = query.eq('is_public', true)
  }

  // Apply filters
  if (filters?.cuisine) {
    query = query.ilike('cuisine_type', `%${filters.cuisine}%`)
  }
  
  if (filters?.difficulty) {
    query = query.eq('difficulty_level', filters.difficulty)
  }
  
  if (filters?.maxPrepTime) {
    query = query.lte('prep_time', filters.maxPrepTime)
  }
  
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  // Filter by meal types (using meal_type array column)
  if (filters?.mealTypes && filters.mealTypes.length > 0) {
    query = query.or(filters.mealTypes.map(type => `meal_type.cs.{${type.toLowerCase()}}`).join(','))
  }

  // Pagination
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }
  
  if (filters?.offset) {
    query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return data || []
}

// Get specific recipe
export async function getRecipe(recipeId: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(*),
      recipe_nutrition(*),
      recipe_tags(*),
      recipe_ratings(*)
    `)
    .eq('id', recipeId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Create new recipe
export async function createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<Recipe> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      ...recipe,
      created_by: user.id,
      total_time: (recipe.prep_time || 0) + (recipe.cook_time || 0)
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update recipe
export async function updateRecipe(recipeId: string, updates: Partial<Recipe>): Promise<Recipe> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recipes')
    .update({
      ...updates,
      total_time: updates.prep_time || updates.cook_time ? 
        (updates.prep_time || 0) + (updates.cook_time || 0) : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', recipeId)
    .eq('created_by', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete recipe with comprehensive cleanup
export async function deleteRecipe(recipeId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.rpc('delete_recipe_completely', {
    recipe_id_to_delete: recipeId
  })

  if (error) throw error
}

// Check if recipe can be safely deleted
export async function canDeleteRecipe(recipeId: string): Promise<{
  can_delete: boolean
  reason: string
  meal_plan_usage: number
  nutrition_log_usage: number
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('can_delete_recipe', {
    recipe_id_to_check: recipeId
  })

  if (error) throw error
  return data
}

// Get detailed impact of recipe deletion
export async function getRecipeDeletionImpact(recipeId: string): Promise<{
  recipe_title: string
  ingredients_to_delete: number
  tags_to_delete: number
  nutrition_records_to_delete: number
  meal_plan_usage: number
  nutrition_log_usage: number
  total_related_records: number
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('get_recipe_deletion_impact', {
    recipe_id_to_check: recipeId
  })

  if (error) throw error
  return data
}

// Add ingredients to recipe
export async function addRecipeIngredients(recipeId: string, ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[]): Promise<RecipeIngredient[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert(
      ingredients.map((ingredient, index) => ({
        ...ingredient,
        recipe_id: recipeId,
        order_index: index
      }))
    )
    .select()

  if (error) throw error
  return data || []
}

// Update recipe ingredient
export async function updateRecipeIngredient(ingredientId: string, updates: Partial<RecipeIngredient>): Promise<RecipeIngredient> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .update(updates)
    .eq('id', ingredientId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete recipe ingredient
export async function deleteRecipeIngredient(ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('id', ingredientId)

  if (error) throw error
}

// Add/update recipe nutrition
export async function updateRecipeNutrition(recipeId: string, nutrition: Omit<RecipeNutrition, 'id' | 'recipe_id'>): Promise<RecipeNutrition> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if nutrition exists
  const { data: existing } = await supabase
    .from('recipe_nutrition')
    .select('id')
    .eq('recipe_id', recipeId)
    .single()

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('recipe_nutrition')
      .update(nutrition)
      .eq('recipe_id', recipeId)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Create new
    const { data, error } = await supabase
      .from('recipe_nutrition')
      .insert({
        ...nutrition,
        recipe_id: recipeId
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Add recipe tags
export async function addRecipeTags(recipeId: string, tags: string[]): Promise<RecipeTag[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Remove existing tags first
  await supabase
    .from('recipe_tags')
    .delete()
    .eq('recipe_id', recipeId)

  // Add new tags
  const { data, error } = await supabase
    .from('recipe_tags')
    .insert(
      tags.map(tag => ({
        recipe_id: recipeId,
        tag_name: tag.toLowerCase().trim()
      }))
    )
    .select()

  if (error) throw error
  return data || []
}

// Rate recipe
export async function rateRecipe(recipeId: string, rating: number, review?: string): Promise<RecipeRating> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5')
  }

  // Check if user already rated this recipe
  const { data: existing } = await supabase
    .from('recipe_ratings')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // Update existing rating
    const { data, error } = await supabase
      .from('recipe_ratings')
      .update({ rating, review })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Create new rating
    const { data, error } = await supabase
      .from('recipe_ratings')
      .insert({
        recipe_id: recipeId,
        user_id: user.id,
        rating,
        review
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Get user's recipes
export async function getUserRecipes(): Promise<Recipe[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients(*),
      recipe_nutrition(*),
      recipe_tags(*),
      recipe_ratings(rating)
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Search recipes by ingredients
export async function searchRecipesByIngredients(ingredients: string[]): Promise<Recipe[]> {
  const { data: { user } } = await supabase.auth.getUser()
  
  let query = supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients!inner(*),
      recipe_nutrition(*),
      recipe_tags(*),
      recipe_ratings(rating)
    `)

  // Filter by public recipes or user's own recipes
  if (user) {
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`)
  } else {
    query = query.eq('is_public', true)
  }

  // Search for recipes containing any of the ingredients
  const ingredientFilters = ingredients.map(ingredient => 
    `recipe_ingredients.ingredient_name.ilike.%${ingredient}%`
  ).join(',')
  
  query = query.or(ingredientFilters)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get recipe statistics
export async function getRecipeStats(recipeId: string): Promise<{
  averageRating: number
  totalRatings: number
  ratingDistribution: { [key: number]: number }
}> {
  const { data, error } = await supabase
    .from('recipe_ratings')
    .select('rating')
    .eq('recipe_id', recipeId)

  if (error) throw error

  if (!data || data.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    }
  }

  const totalRatings = data.length
  const sum = data.reduce((acc, rating) => acc + rating.rating, 0)
  const averageRating = Math.round((sum / totalRatings) * 10) / 10

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  data.forEach(rating => {
    ratingDistribution[rating.rating as keyof typeof ratingDistribution]++
  })

  return {
    averageRating,
    totalRatings,
    ratingDistribution
  }
}

// Get recipe category analytics
export async function getRecipeCategoryAnalytics(): Promise<{
  categories: { name: string; count: number }[]
  totalRecipes: number
  averageRating: number
  topCuisines: { name: string; count: number }[]
}> {
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get all recipes (public + user's own)
  let query = supabase
    .from('recipes')
    .select('meal_type, cuisine, recipe_ratings(rating)')

  if (user) {
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`)
  } else {
    query = query.eq('is_public', true)
  }

  const { data: recipes, error } = await query

  if (error) throw error

  // Count recipes by meal types
  const categoryCounts: { [key: string]: number } = {}
  const cuisineCounts: { [key: string]: number } = {}
  let totalRatings = 0
  let ratingSum = 0

  recipes?.forEach(recipe => {
    // Count by meal types (using meal_type array)
    if (recipe.meal_type && Array.isArray(recipe.meal_type)) {
      recipe.meal_type.forEach((mealType: string) => {
        const category = mealType.charAt(0).toUpperCase() + mealType.slice(1)
        categoryCounts[category] = (categoryCounts[category] || 0) + 1
      })
    }

    // Count by cuisine
    if (recipe.cuisine) {
      cuisineCounts[recipe.cuisine] = (cuisineCounts[recipe.cuisine] || 0) + 1
    }

    // Calculate average rating
    if (recipe.recipe_ratings && Array.isArray(recipe.recipe_ratings)) {
      recipe.recipe_ratings.forEach((rating: any) => {
        totalRatings++
        ratingSum += rating.rating
      })
    }
  })

  // Convert to arrays and sort
  const categories = Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const topCuisines = Object.entries(cuisineCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    categories,
    totalRecipes: recipes?.length || 0,
    averageRating: totalRatings > 0 ? Math.round((ratingSum / totalRatings) * 10) / 10 : 0,
    topCuisines
  }
}

// Get recipe statistics for dashboard
export async function getRecipeStats(): Promise<{
  totalRecipes: number
  userRecipes: number
  publicRecipes: number
  averageRating: number
  totalRatings: number
  mostPopularCuisine: string
  difficultyDistribution: { [key: string]: number }
}> {
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get total recipes
  const { count: totalRecipes } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })

  // Get user's recipes
  const { count: userRecipes } = user ? await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user.id) : { count: 0 }

  // Get public recipes
  const { count: publicRecipes } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('is_public', true)

  // Get rating statistics
  const { data: ratings } = await supabase
    .from('recipe_ratings')
    .select('rating')

  const totalRatings = ratings?.length || 0
  const averageRating = totalRatings > 0 
    ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings) * 10) / 10 
    : 0

  // Get cuisine and difficulty distribution
  const { data: recipes } = await supabase
    .from('recipes')
    .select('cuisine_type, difficulty_level')

  const cuisineCounts: { [key: string]: number } = {}
  const difficultyCounts: { [key: string]: number } = {}

  recipes?.forEach(recipe => {
    if (recipe.cuisine_type) {
      cuisineCounts[recipe.cuisine_type] = (cuisineCounts[recipe.cuisine_type] || 0) + 1
    }
    if (recipe.difficulty_level) {
      difficultyCounts[recipe.difficulty_level] = (difficultyCounts[recipe.difficulty_level] || 0) + 1
    }
  })

  const mostPopularCuisine = Object.entries(cuisineCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown'

  return {
    totalRecipes: totalRecipes || 0,
    userRecipes: userRecipes || 0,
    publicRecipes: publicRecipes || 0,
    averageRating,
    totalRatings,
    mostPopularCuisine,
    difficultyDistribution: difficultyCounts
  }
}

// Generate AI recipe
export async function generateAIRecipe(meal: {
  title: string
  description: string
  meal_type: string
  nutritional_highlights?: string[]
}): Promise<Recipe> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user preferences for AI generation
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: goals } = await supabase
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const response = await supabase.functions.invoke('ai-recipe-generator', {
    body: {
      meal,
      preferences: {
        user_settings: settings,
        nutrition_goals: goals
      }
    }
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to generate AI recipe')
  }

  // Save the generated recipe to database
  const recipeData = response.data
  const recipe = await createRecipe({
    title: recipeData.title,
    description: recipeData.description,
    instructions: recipeData.instructions,
    prep_time: recipeData.prep_time,
    cook_time: recipeData.cook_time,
    servings: recipeData.servings,
    difficulty_level: recipeData.difficulty_level,
    cuisine_type: recipeData.cuisine_type,
    is_ai_generated: true,
    is_public: false
  })

  // Add ingredients
  if (recipeData.ingredients) {
    await addRecipeIngredients(recipe.id, recipeData.ingredients)
  }

  // Add nutrition
  if (recipeData.nutrition) {
    await updateRecipeNutrition(recipe.id, recipeData.nutrition)
  }

  // Add tags
  if (recipeData.tags) {
    await addRecipeTags(recipe.id, recipeData.tags)
  }

  return recipe
}