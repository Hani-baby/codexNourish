import { supabase } from './supabase'
import { 
  aggregateGroceryList, 
  AggregatedGroceryItem, 
  GroceryAggregationOptions,
  validateAggregatedItems 
} from './grocery-aggregation-service'
import { 
  createInstacartCartFromGroceryList, 
  getInstacartService 
} from './instacart-api-service'

export interface EnhancedGroceryList {
  id: string
  household_id: string
  meal_plan_id?: string
  title: string
  status: 'draft' | 'ready' | 'shopping' | 'completed'
  items: AggregatedGroceryItem[]
  instacart_cart_id?: string
  instacart_cart_url?: string
  total_estimated_cost?: number
  total_items: number
  pantry_savings_count: number
  created_at: string
  updated_at: string
  metadata: {
    aggregation_options: GroceryAggregationOptions
    validation_results: {
      isValid: boolean
      errors: string[]
      warnings: string[]
    }
    instacart_integration: {
      enabled: boolean
      last_sync?: string
      match_success_rate?: number
    }
  }
}

export interface GroceryListGenerationOptions {
  mealPlanId: string
  householdId: string
  title?: string
  includePantryCheck?: boolean
  consolidateByCategory?: boolean
  minimumQuantityThreshold?: number
  preferredUnits?: Record<string, string>
  createInstacartCart?: boolean
  autoOptimizeQuantities?: boolean
}

// Main enhanced grocery list generator
export async function generateEnhancedGroceryList(
  options: GroceryListGenerationOptions
): Promise<EnhancedGroceryList> {
  try {
    console.log('Starting enhanced grocery list generation...', options)

    // Step 1: Set up aggregation options
    const aggregationOptions: GroceryAggregationOptions = {
      mealPlanId: options.mealPlanId,
      householdId: options.householdId,
      includePantryCheck: options.includePantryCheck ?? true,
      consolidateByCategory: options.consolidateByCategory ?? true,
      minimumQuantityThreshold: options.minimumQuantityThreshold ?? 0.1,
      preferredUnits: options.preferredUnits
    }

    // Step 2: Aggregate ingredients from meal plan
    console.log('Aggregating ingredients...')
    const aggregatedItems = await aggregateGroceryList(aggregationOptions)
    
    // Step 3: Validate aggregated items
    console.log('Validating aggregated items...')
    const validationResults = validateAggregatedItems(aggregatedItems)
    
    if (!validationResults.isValid) {
      console.error('Validation errors:', validationResults.errors)
      throw new Error(`Grocery list validation failed: ${validationResults.errors.join(', ')}`)
    }

    // Step 4: Apply optimizations
    const optimizedItems = options.autoOptimizeQuantities 
      ? await optimizeQuantities(aggregatedItems)
      : aggregatedItems

    // Step 5: Create grocery list record in database
    console.log('Creating grocery list record...')
    const groceryListId = await createGroceryListRecord(
      options,
      optimizedItems,
      aggregationOptions,
      validationResults
    )

    // Step 6: Create Instacart cart if requested
    let instacartCartId: string | undefined
    let instacartCartUrl: string | undefined
    let instacartMatchRate: number | undefined

    if (options.createInstacartCart) {
      console.log('Creating Instacart cart...')
      try {
        const instacartResult = await createInstacartIntegration(optimizedItems)
        instacartCartId = instacartResult.cart.id
        instacartCartUrl = instacartResult.cart.checkout_url
        instacartMatchRate = calculateMatchSuccessRate(instacartResult.matches)
        
        // Update grocery list with Instacart info
        await updateGroceryListInstacartInfo(groceryListId, {
          instacart_cart_id: instacartCartId,
          instacart_cart_url: instacartCartUrl,
          estimated_total: instacartResult.cart.total
        })
      } catch (error) {
        console.warn('Failed to create Instacart cart:', error)
        // Continue without Instacart integration
      }
    }

    // Step 7: Calculate statistics
    const totalItems = optimizedItems.length
    const pantryItemsCount = optimizedItems.filter(item => 
      item.pantry_status === 'partial' || item.pantry_status === 'sufficient'
    ).length

    // Step 8: Build final result
    const enhancedGroceryList: EnhancedGroceryList = {
      id: groceryListId,
      household_id: options.householdId,
      meal_plan_id: options.mealPlanId,
      title: options.title || `Grocery List - ${new Date().toLocaleDateString()}`,
      status: 'ready',
      items: optimizedItems,
      instacart_cart_id: instacartCartId,
      instacart_cart_url: instacartCartUrl,
      total_estimated_cost: await estimateTotalCost(optimizedItems),
      total_items: totalItems,
      pantry_savings_count: pantryItemsCount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        aggregation_options: aggregationOptions,
        validation_results: validationResults,
        instacart_integration: {
          enabled: options.createInstacartCart || false,
          last_sync: instacartCartId ? new Date().toISOString() : undefined,
          match_success_rate: instacartMatchRate
        }
      }
    }

    console.log('Enhanced grocery list generated successfully:', {
      id: groceryListId,
      totalItems,
      pantryItemsCount,
      instacartEnabled: !!instacartCartId
    })

    return enhancedGroceryList

  } catch (error) {
    console.error('Error generating enhanced grocery list:', error)
    throw error
  }
}

// Create grocery list record in database
async function createGroceryListRecord(
  options: GroceryListGenerationOptions,
  items: AggregatedGroceryItem[],
  aggregationOptions: GroceryAggregationOptions,
  validationResults: any
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_lists')
    .insert({
      household_id: options.householdId,
      title: options.title || `Grocery List - ${new Date().toLocaleDateString()}`,
      status: 'draft',
      vendor: options.createInstacartCart ? 'instacart' : null,
      created_by: user.id
    })
    .select('id')
    .single()

  if (error) throw error

  // Insert grocery list items
  const groceryListItems = items.map(item => ({
    grocery_list_id: data.id,
    ingredient_id: item.ingredient_id,
    requested_qty: item.display_quantity,
    requested_unit_id: null, // Would need to look up unit ID
    normalized_requested_g: item.deficit_g || item.total_needed_g,
    normalized_requested_ml: item.deficit_ml || item.total_needed_ml,
    status: item.pantry_status === 'sufficient' ? 'in_pantry' : 'needed',
    note: item.notes
  }))

  const { error: itemsError } = await supabase
    .from('grocery_list_items')
    .insert(groceryListItems)

  if (itemsError) {
    console.error('Error inserting grocery list items:', itemsError)
    // Clean up the grocery list record
    await supabase.from('grocery_lists').delete().eq('id', data.id)
    throw itemsError
  }

  return data.id
}

// Update grocery list with Instacart information
async function updateGroceryListInstacartInfo(
  groceryListId: string,
  instacartInfo: {
    instacart_cart_id: string
    instacart_cart_url?: string
    estimated_total?: number
  }
): Promise<void> {
  const { error } = await supabase
    .from('grocery_lists')
    .update({
      status: 'ready',
      ...instacartInfo,
      updated_at: new Date().toISOString()
    })
    .eq('id', groceryListId)

  if (error) {
    console.error('Error updating grocery list with Instacart info:', error)
    throw error
  }
}

// Create Instacart integration
async function createInstacartIntegration(items: AggregatedGroceryItem[]) {
  const instacartItems = items
    .filter(item => item.pantry_status !== 'sufficient') // Only items we need to buy
    .map(item => ({
      ingredient_name: item.ingredient_name,
      quantity: item.display_quantity,
      unit: item.display_unit,
      category: item.category
    }))

  return await createInstacartCartFromGroceryList(instacartItems)
}

// Calculate Instacart match success rate
function calculateMatchSuccessRate(matches: Array<{ match: any; added_to_cart: boolean }>): number {
  if (matches.length === 0) return 0
  
  const successfulMatches = matches.filter(m => m.added_to_cart).length
  return Math.round((successfulMatches / matches.length) * 100) / 100
}

// Optimize quantities for better shopping experience
async function optimizeQuantities(items: AggregatedGroceryItem[]): Promise<AggregatedGroceryItem[]> {
  return items.map(item => {
    // Round quantities to more practical shopping amounts
    let optimizedQuantity = item.display_quantity
    
    // Round small quantities up to avoid buying tiny amounts
    if (optimizedQuantity < 1 && optimizedQuantity > 0.5) {
      optimizedQuantity = 1
    } else if (optimizedQuantity < 0.5 && optimizedQuantity > 0.25) {
      optimizedQuantity = 0.5
    }
    
    // Round larger quantities to practical amounts
    if (optimizedQuantity > 10) {
      optimizedQuantity = Math.ceil(optimizedQuantity)
    } else if (optimizedQuantity > 1) {
      optimizedQuantity = Math.ceil(optimizedQuantity * 2) / 2 // Round to nearest 0.5
    }

    return {
      ...item,
      display_quantity: optimizedQuantity,
      notes: optimizedQuantity !== item.display_quantity 
        ? `${item.notes || ''} (Optimized from ${item.display_quantity})`.trim()
        : item.notes
    }
  })
}

// Estimate total cost based on historical data or averages
async function estimateTotalCost(items: AggregatedGroceryItem[]): Promise<number> {
  // This is a simplified cost estimation
  // In a real implementation, you'd use historical pricing data or API pricing
  const costPerCategory = {
    'Produce': 3.50,
    'Protein': 8.00,
    'Dairy': 4.50,
    'Pantry': 2.75,
    'Spices': 5.00,
    'Uncategorized': 4.00
  }

  return items.reduce((total, item) => {
    const categoryKey = item.category as keyof typeof costPerCategory
    const unitCost = costPerCategory[categoryKey] || costPerCategory.Uncategorized
    return total + (item.display_quantity * unitCost)
  }, 0)
}

// Get enhanced grocery list by ID
export async function getEnhancedGroceryList(listId: string): Promise<EnhancedGroceryList | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_lists')
    .select(`
      *,
      grocery_list_items (
        *,
        ingredients (
          id,
          name
        )
      )
    `)
    .eq('id', listId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  // Convert database format to enhanced format
  const items: AggregatedGroceryItem[] = (data.grocery_list_items || []).map((dbItem: any) => ({
    ingredient_id: dbItem.ingredient_id,
    ingredient_name: dbItem.ingredients.name,
    total_needed_g: dbItem.normalized_requested_g,
    total_needed_ml: dbItem.normalized_requested_ml,
    display_quantity: dbItem.requested_qty,
    display_unit: 'unit', // Would need to resolve from unit_id
    category: 'Uncategorized', // Would need category mapping
    priority: 'medium' as const,
    used_in_recipes: [], // Would need to reconstruct
    pantry_status: dbItem.status === 'in_pantry' ? 'sufficient' as const : 'none' as const,
    notes: dbItem.note
  }))

  return {
    id: data.id,
    household_id: data.household_id,
    title: data.title,
    status: data.status,
    items,
    instacart_cart_id: data.instacart_cart_id,
    instacart_cart_url: data.instacart_cart_url,
    total_estimated_cost: data.estimated_total,
    total_items: items.length,
    pantry_savings_count: items.filter(i => i.pantry_status === 'sufficient').length,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
    metadata: {
      aggregation_options: {} as GroceryAggregationOptions, // Would reconstruct from stored data
      validation_results: { isValid: true, errors: [], warnings: [] },
      instacart_integration: {
        enabled: !!data.instacart_cart_id,
        last_sync: data.updated_at
      }
    }
  }
}

// Update grocery list item status
export async function updateGroceryListItemStatus(
  listId: string,
  ingredientId: string,
  status: 'needed' | 'in_cart' | 'purchased' | 'out_of_stock' | 'unavailable' | 'substituted'
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('grocery_list_items')
    .update({ status })
    .eq('grocery_list_id', listId)
    .eq('ingredient_id', ingredientId)

  if (error) throw error
}

// Sync grocery list with Instacart cart
export async function syncWithInstacartCart(listId: string): Promise<void> {
  const groceryList = await getEnhancedGroceryList(listId)
  if (!groceryList || !groceryList.instacart_cart_id) {
    throw new Error('No Instacart cart associated with this list')
  }

  const instacartService = getInstacartService()
  
  try {
    const cart = await instacartService.getCart(groceryList.instacart_cart_id)
    
    // Update grocery list with latest cart information
    await updateGroceryListInstacartInfo(listId, {
      instacart_cart_id: cart.id,
      instacart_cart_url: cart.checkout_url,
      estimated_total: cart.total
    })

    // Update item statuses based on cart
    for (const cartItem of cart.items) {
      // This would require mapping cart items back to grocery list items
      // Implementation depends on how product IDs are stored/mapped
    }
  } catch (error) {
    console.error('Error syncing with Instacart cart:', error)
    throw error
  }
}

// Generate grocery list summary for display
export function generateGroceryListSummary(groceryList: EnhancedGroceryList): {
  totalItems: number
  itemsByCategory: Record<string, number>
  itemsByPriority: Record<string, number>
  itemsByPantryStatus: Record<string, number>
  estimatedCost: number
  pantrySavings: number
} {
  const items = groceryList.items

  return {
    totalItems: items.length,
    itemsByCategory: items.reduce((acc, item) => {
      const category = item.category || 'Uncategorized'
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    itemsByPriority: items.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    itemsByPantryStatus: items.reduce((acc, item) => {
      acc[item.pantry_status] = (acc[item.pantry_status] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    estimatedCost: groceryList.total_estimated_cost || 0,
    pantrySavings: groceryList.pantry_savings_count
  }
}
