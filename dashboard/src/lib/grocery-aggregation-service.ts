import { supabase } from './supabase'
import { 
  normalizeQuantity, 
  canCombineIngredients, 
  combineNormalizedQuantities, 
  selectBestDisplayUnit,
  parseQuantityString,
  ConversionResult 
} from './unit-conversion-service'

export interface MealPlanIngredient {
  ingredient_id: string
  ingredient_name: string
  quantity: number
  unit: string
  recipe_id?: string
  recipe_title?: string
  meal_date?: string
  meal_type?: string
  servings?: number
  preparation_notes?: string
}

export interface PantryItem {
  ingredient_id: string
  ingredient_name: string
  on_hand_qty_g?: number
  on_hand_qty_ml?: number
  expiry_date?: string
  last_audited_at?: string
}

export interface AggregatedGroceryItem {
  ingredient_id: string
  ingredient_name: string
  total_needed_g?: number
  total_needed_ml?: number
  pantry_available_g?: number
  pantry_available_ml?: number
  deficit_g?: number
  deficit_ml?: number
  display_quantity: number
  display_unit: string
  category?: string
  priority: 'high' | 'medium' | 'low'
  used_in_recipes: Array<{
    recipe_id: string
    recipe_title: string
    meal_date: string
    meal_type: string
    quantity: number
    unit: string
  }>
  pantry_status: 'none' | 'partial' | 'sufficient'
  notes?: string
}

export interface GroceryAggregationOptions {
  mealPlanId: string
  householdId: string
  includePantryCheck: boolean
  consolidateByCategory: boolean
  minimumQuantityThreshold?: number
  preferredUnits?: Record<string, string> // ingredient_id -> preferred unit
}

// Main aggregation function
export async function aggregateGroceryList(
  options: GroceryAggregationOptions
): Promise<AggregatedGroceryItem[]> {
  try {
    // Step 1: Get all ingredients from meal plan
    const mealPlanIngredients = await getMealPlanIngredients(options.mealPlanId)
    
    // Step 2: Get pantry inventory if requested
    const pantryItems = options.includePantryCheck 
      ? await getPantryInventory(options.householdId)
      : []
    
    // Step 3: Group ingredients by ingredient_id
    const ingredientGroups = groupIngredientsByType(mealPlanIngredients)
    
    // Step 4: Aggregate each ingredient group
    const aggregatedItems: AggregatedGroceryItem[] = []
    
    for (const [ingredientId, ingredients] of ingredientGroups.entries()) {
      const aggregatedItem = await aggregateIngredientGroup(
        ingredientId,
        ingredients,
        pantryItems,
        options
      )
      
      if (aggregatedItem) {
        aggregatedItems.push(aggregatedItem)
      }
    }
    
    // Step 5: Sort by priority and category
    return sortAggregatedItems(aggregatedItems)
    
  } catch (error) {
    console.error('Error aggregating grocery list:', error)
    throw error
  }
}

// Get all ingredients needed for a meal plan
async function getMealPlanIngredients(mealPlanId: string): Promise<MealPlanIngredient[]> {
  const { data, error } = await supabase
    .from('meal_plan_items')
    .select(`
      servings,
      scheduled_date,
      meal_type,
      recipes!inner (
        id,
        title,
        recipe_ingredients!inner (
          ingredient_id,
          qty,
          note,
          ingredients!inner (
            id,
            name
          ),
          units (
            code,
            display_name
          )
        )
      )
    `)
    .eq('meal_plan_id', mealPlanId)
    .not('recipe_id', 'is', null)

  if (error) throw error

  const ingredients: MealPlanIngredient[] = []
  
  for (const mealItem of data || []) {
    const recipe = mealItem.recipes
    const servingMultiplier = mealItem.servings || 1
    
    for (const recipeIngredient of recipe.recipe_ingredients) {
      const adjustedQuantity = recipeIngredient.qty * servingMultiplier
      
      ingredients.push({
        ingredient_id: recipeIngredient.ingredient_id,
        ingredient_name: recipeIngredient.ingredients.name,
        quantity: adjustedQuantity,
        unit: recipeIngredient.units?.code || 'unit',
        recipe_id: recipe.id,
        recipe_title: recipe.title,
        meal_date: mealItem.scheduled_date,
        meal_type: mealItem.meal_type,
        servings: mealItem.servings,
        preparation_notes: recipeIngredient.note
      })
    }
  }
  
  return ingredients
}

// Get pantry inventory for household
async function getPantryInventory(householdId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('ingredient_inventory')
    .select(`
      ingredient_id,
      on_hand_qty_g,
      on_hand_qty_ml,
      expiry_date,
      last_audited_at,
      ingredients!inner (
        id,
        name
      )
    `)
    .eq('household_id', householdId)
    .gt('on_hand_qty_g', 0)
    .or('on_hand_qty_ml.gt.0')

  if (error) throw error

  return (data || []).map(item => ({
    ingredient_id: item.ingredient_id,
    ingredient_name: item.ingredients.name,
    on_hand_qty_g: item.on_hand_qty_g || undefined,
    on_hand_qty_ml: item.on_hand_qty_ml || undefined,
    expiry_date: item.expiry_date || undefined,
    last_audited_at: item.last_audited_at || undefined
  }))
}

// Group ingredients by ingredient_id
function groupIngredientsByType(
  ingredients: MealPlanIngredient[]
): Map<string, MealPlanIngredient[]> {
  const groups = new Map<string, MealPlanIngredient[]>()
  
  for (const ingredient of ingredients) {
    const key = ingredient.ingredient_id
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(ingredient)
  }
  
  return groups
}

// Aggregate a group of the same ingredient
async function aggregateIngredientGroup(
  ingredientId: string,
  ingredients: MealPlanIngredient[],
  pantryItems: PantryItem[],
  options: GroceryAggregationOptions
): Promise<AggregatedGroceryItem | null> {
  
  if (ingredients.length === 0) return null
  
  const firstIngredient = ingredients[0]
  const pantryItem = pantryItems.find(p => p.ingredient_id === ingredientId)
  
  // Normalize all quantities to common units
  const normalizedIngredients: Array<{
    ingredient: MealPlanIngredient
    normalized: ConversionResult
  }> = []
  
  for (const ingredient of ingredients) {
    const normalized = await normalizeQuantity(ingredient.quantity, ingredient.unit)
    normalizedIngredients.push({ ingredient, normalized })
  }
  
  // Separate combinable and non-combinable ingredients
  const combinableIngredients = normalizedIngredients.filter(ni => ni.normalized.can_combine)
  const nonCombinableIngredients = normalizedIngredients.filter(ni => !ni.normalized.can_combine)
  
  // If we have non-combinable ingredients, handle them separately
  if (nonCombinableIngredients.length > 0 && combinableIngredients.length === 0) {
    // All ingredients are non-combinable - create separate items or combine by name
    return createNonCombinableAggregatedItem(ingredientId, ingredients, pantryItem)
  }
  
  // Combine all the normalizable quantities
  const combinedQuantities = combineNormalizedQuantities(
    combinableIngredients.map(ni => ({
      normalized_g: ni.normalized.normalized_g,
      normalized_ml: ni.normalized.normalized_ml
    }))
  )
  
  // Calculate pantry availability and deficit
  let pantryAvailableG = pantryItem?.on_hand_qty_g || 0
  let pantryAvailableMl = pantryItem?.on_hand_qty_ml || 0
  
  let deficitG: number | undefined
  let deficitMl: number | undefined
  let pantryStatus: 'none' | 'partial' | 'sufficient' = 'none'
  
  if (combinedQuantities.normalized_g && pantryAvailableG > 0) {
    if (pantryAvailableG >= combinedQuantities.normalized_g) {
      pantryStatus = 'sufficient'
      deficitG = 0
    } else {
      pantryStatus = 'partial'
      deficitG = combinedQuantities.normalized_g - pantryAvailableG
    }
  } else if (combinedQuantities.normalized_g) {
    deficitG = combinedQuantities.normalized_g
  }
  
  if (combinedQuantities.normalized_ml && pantryAvailableMl > 0) {
    if (pantryAvailableMl >= combinedQuantities.normalized_ml) {
      pantryStatus = 'sufficient'
      deficitMl = 0
    } else {
      pantryStatus = 'partial'
      deficitMl = combinedQuantities.normalized_ml - pantryAvailableMl
    }
  } else if (combinedQuantities.normalized_ml) {
    deficitMl = combinedQuantities.normalized_ml
  }
  
  // Determine display quantity and unit
  const displayQuantities = deficitG || deficitMl 
    ? await selectBestDisplayUnit(deficitG, deficitMl)
    : await selectBestDisplayUnit(combinedQuantities.normalized_g, combinedQuantities.normalized_ml)
  
  // Skip if below minimum threshold
  if (options.minimumQuantityThreshold && 
      displayQuantities.quantity < options.minimumQuantityThreshold) {
    return null
  }
  
  // Build used_in_recipes array
  const usedInRecipes = ingredients.map(ing => ({
    recipe_id: ing.recipe_id || '',
    recipe_title: ing.recipe_title || '',
    meal_date: ing.meal_date || '',
    meal_type: ing.meal_type || '',
    quantity: ing.quantity,
    unit: ing.unit
  }))
  
  // Determine priority based on urgency and quantity
  const priority = determinePriority(ingredients, pantryItem, displayQuantities.quantity)
  
  // Get category (this could be enhanced with ingredient categorization)
  const category = await getIngredientCategory(ingredientId)
  
  return {
    ingredient_id: ingredientId,
    ingredient_name: firstIngredient.ingredient_name,
    total_needed_g: combinedQuantities.normalized_g,
    total_needed_ml: combinedQuantities.normalized_ml,
    pantry_available_g: pantryAvailableG > 0 ? pantryAvailableG : undefined,
    pantry_available_ml: pantryAvailableMl > 0 ? pantryAvailableMl : undefined,
    deficit_g: deficitG,
    deficit_ml: deficitMl,
    display_quantity: displayQuantities.quantity,
    display_unit: displayQuantities.unit,
    category,
    priority,
    used_in_recipes: usedInRecipes,
    pantry_status,
    notes: generateAggregationNotes(ingredients, pantryItem, pantryStatus)
  }
}

// Handle non-combinable ingredients
async function createNonCombinableAggregatedItem(
  ingredientId: string,
  ingredients: MealPlanIngredient[],
  pantryItem: PantryItem | undefined
): Promise<AggregatedGroceryItem> {
  const firstIngredient = ingredients[0]
  
  // For non-combinable ingredients, just sum quantities assuming same unit
  const totalQuantity = ingredients.reduce((sum, ing) => sum + ing.quantity, 0)
  const commonUnit = ingredients[0].unit
  
  const usedInRecipes = ingredients.map(ing => ({
    recipe_id: ing.recipe_id || '',
    recipe_title: ing.recipe_title || '',
    meal_date: ing.meal_date || '',
    meal_type: ing.meal_type || '',
    quantity: ing.quantity,
    unit: ing.unit
  }))
  
  const priority = determinePriority(ingredients, pantryItem, totalQuantity)
  const category = await getIngredientCategory(ingredientId)
  
  return {
    ingredient_id: ingredientId,
    ingredient_name: firstIngredient.ingredient_name,
    display_quantity: totalQuantity,
    display_unit: commonUnit,
    category,
    priority,
    used_in_recipes: usedInRecipes,
    pantry_status: 'none', // Can't check pantry for non-normalized items
    notes: `Non-standard unit (${commonUnit}) - manual verification recommended`
  }
}

// Determine priority based on various factors
function determinePriority(
  ingredients: MealPlanIngredient[],
  pantryItem: PantryItem | undefined,
  displayQuantity: number
): 'high' | 'medium' | 'low' {
  // High priority: needed soon, large quantity, or pantry item expiring
  const hasEarlyMeals = ingredients.some(ing => {
    if (!ing.meal_date) return false
    const mealDate = new Date(ing.meal_date)
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    return mealDate <= threeDaysFromNow
  })
  
  const isLargeQuantity = displayQuantity > 10 // Adjust threshold as needed
  
  const isPantryExpiring = pantryItem?.expiry_date && 
    new Date(pantryItem.expiry_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  
  if (hasEarlyMeals || isLargeQuantity || isPantryExpiring) {
    return 'high'
  }
  
  // Medium priority: moderate quantity or multiple recipes
  if (displayQuantity > 2 || ingredients.length > 2) {
    return 'medium'
  }
  
  return 'low'
}

// Get ingredient category (placeholder - could be enhanced with actual categorization)
async function getIngredientCategory(ingredientId: string): Promise<string> {
  // This could be enhanced by adding a categories table or using AI classification
  // For now, return a default category
  return 'Uncategorized'
}

// Generate helpful notes for the aggregated item
function generateAggregationNotes(
  ingredients: MealPlanIngredient[],
  pantryItem: PantryItem | undefined,
  pantryStatus: 'none' | 'partial' | 'sufficient'
): string {
  const notes: string[] = []
  
  if (pantryStatus === 'sufficient') {
    notes.push('✅ Sufficient quantity in pantry')
  } else if (pantryStatus === 'partial') {
    notes.push('⚠️ Partial quantity in pantry - need to buy more')
  }
  
  if (pantryItem?.expiry_date) {
    const expiryDate = new Date(pantryItem.expiry_date)
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry <= 3) {
      notes.push(`🔴 Pantry item expires in ${daysUntilExpiry} days`)
    } else if (daysUntilExpiry <= 7) {
      notes.push(`🟡 Pantry item expires in ${daysUntilExpiry} days`)
    }
  }
  
  if (ingredients.length > 3) {
    notes.push(`Used in ${ingredients.length} different recipes`)
  }
  
  const uniquePreparations = new Set(
    ingredients
      .map(ing => ing.preparation_notes)
      .filter(note => note && note.trim())
  )
  
  if (uniquePreparations.size > 0) {
    notes.push(`Prep notes: ${Array.from(uniquePreparations).join(', ')}`)
  }
  
  return notes.join(' • ')
}

// Sort aggregated items by priority and category
function sortAggregatedItems(items: AggregatedGroceryItem[]): AggregatedGroceryItem[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  
  return items.sort((a, b) => {
    // First sort by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    // Then by pantry status (items we need to buy first)
    const pantryOrder = { none: 0, partial: 1, sufficient: 2 }
    const pantryDiff = pantryOrder[a.pantry_status] - pantryOrder[b.pantry_status]
    if (pantryDiff !== 0) return pantryDiff
    
    // Then by category
    if (a.category !== b.category) {
      return (a.category || '').localeCompare(b.category || '')
    }
    
    // Finally by name
    return a.ingredient_name.localeCompare(b.ingredient_name)
  })
}

// Validate aggregation results
export function validateAggregatedItems(items: AggregatedGroceryItem[]): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  for (const item of items) {
    // Check for required fields
    if (!item.ingredient_id || !item.ingredient_name) {
      errors.push(`Invalid item: missing ingredient_id or name`)
    }
    
    if (item.display_quantity <= 0) {
      errors.push(`Invalid quantity for ${item.ingredient_name}: ${item.display_quantity}`)
    }
    
    // Check for inconsistent data
    if (item.pantry_status === 'sufficient' && (item.deficit_g || item.deficit_ml)) {
      warnings.push(`${item.ingredient_name}: marked as sufficient but has deficit`)
    }
    
    if (item.used_in_recipes.length === 0) {
      warnings.push(`${item.ingredient_name}: not used in any recipes`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
