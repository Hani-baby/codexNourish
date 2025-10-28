import { supabase } from './supabase'

// Utility helpers
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function generateRecipeSlug(title: string): string {
  const base = slugifyTitle(title)
  return base || `recipe-${Date.now()}`
}

export async function ensureUniqueRecipeSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let attempt = 0

  while (true) {
    const { data } = await supabase
      .from('recipes')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!data) return slug

    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }
}

export async function findRecipeBySlug(slug: string) {
  return supabase
    .from('recipes')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
}

export async function findRecipeByTitle(title: string) {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) {
    return { data: null, error: null }
  }

  const slug = generateRecipeSlug(normalizedTitle)
  const bySlug = await findRecipeBySlug(slug)
  if (bySlug.data) {
    return bySlug
  }

  return supabase
    .from('recipes')
    .select('*')
    .ilike('title', `%${normalizedTitle}%`)
    .limit(1)
    .maybeSingle()
}

// Recipe Services
export async function getRecipes(options?: {
  dietaryTags?: string[]
  searchTerm?: string
  limit?: number
  offset?: number
}) {
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('recipes')
    .select(`
      id,
      title,
      slug,
      summary,
      image_url,
      prep_min,
      cook_min,
      servings,
      dietary_tags,
      cuisine,
      is_public,
      created_by,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (user) {
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`)
  } else {
    query = query.eq('is_public', true)
  }

  if (options?.searchTerm) {
    const term = `%${options.searchTerm.trim()}%`
    query = query.ilike('title', term)
  }

  if (options?.dietaryTags && options.dietaryTags.length > 0) {
    query = query.contains('dietary_tags', options.dietaryTags.map(tag => tag.toLowerCase()))
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    const limit = options.limit ?? 20
    query = query.range(options.offset, options.offset + limit - 1)
  }

  return query
}

// Get recipe category analytics
export async function getRecipeCategoryAnalytics() {
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

  if (error) return { data: null, error }

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
    data: {
      categories,
      totalRecipes: recipes?.length || 0,
      averageRating: totalRatings > 0 ? Math.round((ratingSum / totalRatings) * 10) / 10 : 0,
      topCuisines
    },
    error: null
  }
}

// Get recipe statistics
export async function getRecipeStats() {
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
  const averageRating = totalRatings > 0 && ratings
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
    data: {
      totalRecipes: totalRecipes || 0,
      userRecipes: userRecipes || 0,
      publicRecipes: publicRecipes || 0,
      averageRating,
      totalRatings,
      mostPopularCuisine,
      difficultyDistribution: difficultyCounts
    },
    error: null
  }
}

export async function getRecipeById(id: string) {
  return supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()
}

export async function getSavedRecipes(userId: string) {
  // For now, just get recipes created by the user or favorited
  // You might want to add a favorites table later
  return supabase
    .from('recipes')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
}

// Meal Plan Services
export async function getOccupiedDates(userId: string) {
  try {
    // Get user's household using master-child logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('child')
      .eq('id', userId)
      .single()

    let householdId = profile?.child || userId

    // Get all meal plans for the household with their date ranges
    const { data: mealPlans, error } = await supabase
      .from('meal_plans')
      .select('start_date, end_date, title')
      .eq('household_id', householdId)
      .order('start_date', { ascending: true })

    if (error) {
      console.error('Error fetching occupied dates:', error)
      return { data: [], error }
    }

    // Generate array of all occupied dates
    const occupiedDates: string[] = []
    const occupiedRanges: Array<{ start: string; end: string; title: string }> = []

    mealPlans?.forEach(plan => {
      occupiedRanges.push({
        start: plan.start_date,
        end: plan.end_date,
        title: plan.title
      })

      // Add all dates in the range to occupied dates
      const startDate = new Date(plan.start_date)
      const endDate = new Date(plan.end_date)
      const current = new Date(startDate)
      
      while (current <= endDate) {
        occupiedDates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
    })

    return { 
      data: { 
        occupiedDates, 
        occupiedRanges 
      }, 
      error: null 
    }
  } catch (error) {
    console.error('Error in getOccupiedDates:', error)
    return { data: { occupiedDates: [], occupiedRanges: [] }, error }
  }
}

export async function getMealPlans(userId: string) {
  try {
    // Get user's household using master-child logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('child')
      .eq('id', userId)
      .single()

    let householdId = profile?.child || userId

    // For individual users, ensure a household record exists
    if (!profile?.child) {
      // Check if household exists for this user
      const { data: existingHousehold } = await supabase
        .from('households')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (!existingHousehold) {
        // Create a household record for the individual user
        const { data: newHousehold, error: createError } = await supabase
          .from('households')
          .insert({
            id: userId,
            name: 'Individual Plan',
            created_by: userId
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Failed to create household:', createError)
          return { data: [], error: createError }
        }
        
        householdId = newHousehold.id
      }
    }

    // Get meal plans for the household
    const { data: mealPlans, error } = await supabase
      .from('meal_plans')
      .select(`
        *,
        meal_plan_items (
          id,
          scheduled_date,
          meal_type,
          servings,
          notes,
          recipe_id,
          external_item_name,
          recipes (
            id,
            title,
            image_url,
            prep_min,
            cook_min
          )
        )
      `)
      .eq('household_id', householdId)
      .order('start_date', { ascending: false })

    if (error) {
      return { data: [], error }
    }

    // Transform data to match expected format
    const transformedPlans = mealPlans?.map(plan => {
      // Group meal plan items by date
      const dayMap = new Map()
      
      plan.meal_plan_items?.forEach((item: any) => {
        if (!dayMap.has(item.scheduled_date)) {
          dayMap.set(item.scheduled_date, [])
        }
        
        const meal = {
          id: item.id,
          type: item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1),
          name: item.recipes?.title || item.external_item_name || 'Unknown Meal',
          calories: 0, // Would need nutrition data
          time: '', // Would need to calculate from recipe
          protein: 0,
          carbs: 0,
          fat: 0,
          image: item.recipes?.image_url || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop',
          servings: item.servings,
          notes: item.notes
        }
        
        dayMap.get(item.scheduled_date).push(meal)
      })

      // Create days array
      const days = Array.from(dayMap.entries()).map(([date, meals]) => ({
        date,
        dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
        meals: meals.sort((a: any, b: any) => {
          const order: { [key: string]: number } = { 'Breakfast': 1, 'Snack': 2, 'Lunch': 3, 'Dinner': 4, 'Dessert': 5 }
          return (order[a.type] || 6) - (order[b.type] || 6)
        })
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      const totalMeals = days.reduce((sum, day) => sum + day.meals.length, 0)
      const totalCalories = 0 // Would need to calculate from nutrition data
      
      return {
        id: plan.id,
        title: plan.title,
        dateRange: { 
          start: plan.start_date, 
          end: plan.end_date 
        },
        status: new Date(plan.end_date) < new Date() ? 'completed' : 
                new Date(plan.start_date) <= new Date() ? 'active' : 'scheduled',
        totalMeals,
        totalCalories,
        avgCaloriesPerDay: days.length > 0 ? Math.round(totalCalories / days.length) : 0,
        macros: { protein: 0, carbs: 0, fat: 0 }, // Would need nutrition calculation
        tags: [], // Could be derived from recipe tags
        createdAt: plan.created_at,
        days
      }
    }) || []

    return { data: transformedPlans, error: null }
  } catch (err) {
    return { data: [], error: err }
  }
}

export async function getCurrentMealPlan(userId: string) {
  try {
    // Get user's household using master-child logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('child')
      .eq('id', userId)
      .single()

    let householdId = profile?.child || userId

    // Get the current active meal plan (today's date falls within the plan's date range)
    const today = new Date().toISOString().split('T')[0]
    
    const { data: currentPlan, error } = await supabase
      .from('meal_plans')
      .select(`
        *,
        meal_plan_items (
          id,
          scheduled_date,
          meal_type,
          servings,
          notes,
          recipe_id,
          external_item_name,
          recipes (
            id,
            title,
            image_url,
            prep_min,
            cook_min
          )
        )
      `)
      .eq('household_id', householdId)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return { data: null, error }
    }

    if (!currentPlan) {
      return { data: null, error: null }
    }

    // Transform the data to match the expected interface
    const transformedPlan = {
      id: currentPlan.id,
      title: currentPlan.title,
      dateRange: {
        start: currentPlan.start_date,
        end: currentPlan.end_date
      },
      status: currentPlan.status || 'active',
      totalMeals: currentPlan.meal_plan_items?.length || 0,
      totalCalories: 0, // Calculate from meal plan items
      avgCaloriesPerDay: 0, // Calculate from meal plan items
      macros: { protein: 0, carbs: 0, fat: 0 }, // Calculate from meal plan items
      tags: [], // Extract from plan data
      createdAt: currentPlan.created_at,
      days: [], // Transform meal_plan_items into days structure
      completedMeals: 0,
      completionRate: 0
    }

    return { data: transformedPlan, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function createMealPlan(userId: string, planData: {
  title: string
  startDate: string
  endDate: string
  scope: 'daily' | 'weekly' | 'monthly'
  generatedBy: 'ai' | 'template' | 'manual'
}) {
  try {
    // Get user's household using master-child logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('child')
      .eq('id', userId)
      .single()

    let householdId = profile?.child || userId

    // For individual users, ensure a household record exists
    if (!profile?.child) {
      // Check if household exists for this user
      const { data: existingHousehold } = await supabase
        .from('households')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (!existingHousehold) {
        // Create a household record for the individual user
        const { data: newHousehold, error: createError } = await supabase
          .from('households')
          .insert({
            id: userId,
            name: 'Individual Plan',
            created_by: userId
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Failed to create household:', createError)
          return { data: null, error: createError }
        }
        
        householdId = newHousehold.id
      }
    }

    const { data: mealPlan, error } = await supabase
      .from('meal_plans')
      .insert({
        household_id: householdId,
        title: planData.title,
        start_date: planData.startDate,
        end_date: planData.endDate,
        scope: planData.scope,
        generated_by: planData.generatedBy,
        created_by: userId
      })
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data: mealPlan, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function addMealPlanItem(mealPlanId: string, itemData: {
  scheduled_date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'
  recipeId?: string
  externalItemName?: string
  servings: number
  notes?: string
}) {
  try {
    // Validate that scheduled_date is provided and not null/undefined
    if (!itemData.scheduled_date) {
      return { data: null, error: new Error('Scheduled date is required for meal plan item') }
    }

    const { data: item, error } = await supabase
      .from('meal_plan_items')
      .insert({
        meal_plan_id: mealPlanId,
        scheduled_date: itemData.scheduled_date,  // Use scheduled_date column
        meal_type: itemData.mealType,
        recipe_id: itemData.recipeId || null,
        external_item_name: itemData.externalItemName || null,
        servings: itemData.servings,
        notes: itemData.notes || null
      })
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data: item, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

// Dashboard Stats Services
export async function getDashboardStats(userId: string) {
  // Get total saved recipes
  const { count: savedRecipesCount } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)

  return {
    dailyCalories: {
      current: 0, // Would need to implement calorie tracking
      target: 2200,
      percentage: 0,
      delta: 0
    },
    mealsPlanned: {
      current: 0, // Would need meal planning implementation
      target: 21,
      percentage: 0,
      delta: 0
    },
    recipesSaved: {
      current: savedRecipesCount || 0,
      delta: 0 // Would need historical data to calculate delta
    },
    groceryItems: {
      current: 0, // Would need to implement grocery list services
      delta: 0
    }
  }
}

// Suggested Meals (can be recipes or AI-generated suggestions)
export async function getSuggestedMeals(_userId: string, options?: {
  mealType?: string
  excludeRecipeIds?: string[]
  limit?: number
}) {
  let query = supabase
    .from('recipes')
    .select('*')
    .limit(options?.limit || 4)
    .order('created_at', { ascending: false })

  if (options?.mealType) {
    query = query.contains('meal_type', [options.mealType])
  }

  if (options?.excludeRecipeIds && options.excludeRecipeIds.length > 0) {
    query = query.not('id', 'in', `(${options.excludeRecipeIds.join(',')})`)
  }

  const { data, error } = await query

  if (error) return { data: [], error }

  // Transform to match the expected format
  const suggestedMeals = data?.map(recipe => ({
    id: recipe.id,
    name: recipe.title,
    calories: 0, // No calorie field in new schema
    time: `${(recipe.prep_min || 0) + (recipe.cook_min || 0)} min`,
    difficulty: recipe.prep_min && recipe.prep_min <= 15 ? 'Easy' : 
               recipe.prep_min && recipe.prep_min <= 30 ? 'Medium' : 'Hard',
    image: recipe.image_url || 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop',
    tags: recipe.dietary_tags || []
  })) || []

  return { data: suggestedMeals, error: null }
}
