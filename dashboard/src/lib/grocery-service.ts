import { supabase } from './supabase'

export interface GroceryList {
  id: string
  user_id: string
  meal_plan_id?: string
  status: 'pending' | 'ready' | 'shopping' | 'completed'
  total_items: number
  categories: string[]
  instacart_cart_id?: string
  instacart_cart_url?: string
  estimated_total?: number
  instacart_status?: string
  created_at: string
  updated_at: string
  grocery_list_items?: GroceryListItem[]
}

export interface GroceryListItem {
  id: string
  grocery_list_id: string
  ingredient_name: string
  quantity: number
  unit: string
  category: string
  preparation_notes?: string
  used_in_recipes?: string[]
  is_purchased: boolean
  price_estimate?: number
  instacart_product_id?: string
  created_at: string
  updated_at: string
}

export interface IngredientInventory {
  id: string
  user_id: string
  ingredient_name: string
  quantity_available: number
  unit: string
  expiry_date?: string
  location?: string
  notes?: string
  created_at: string
  updated_at: string
}

// Get user's grocery lists
export async function getUserGroceryLists(): Promise<GroceryList[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_lists')
    .select(`
      *,
      grocery_list_items(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get specific grocery list
export async function getGroceryList(listId: string): Promise<GroceryList | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_lists')
    .select(`
      *,
      grocery_list_items(*)
    `)
    .eq('id', listId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Generate grocery list from meal plan
export async function generateGroceryListFromMealPlan(mealPlanId: string): Promise<{ grocery_list_id: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const response = await supabase.functions.invoke('grocery-list-generator', {
    body: {
      meal_plan_id: mealPlanId,
      user_id: user.id
    }
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to generate grocery list')
  }

  return response.data
}

// Update grocery list item
export async function updateGroceryListItem(itemId: string, updates: Partial<GroceryListItem>): Promise<GroceryListItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_list_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Mark item as purchased
export async function markItemAsPurchased(itemId: string, purchased: boolean = true): Promise<GroceryListItem> {
  return updateGroceryListItem(itemId, { is_purchased: purchased })
}

// Add item to grocery list
export async function addItemToGroceryList(listId: string, item: Omit<GroceryListItem, 'id' | 'grocery_list_id' | 'created_at' | 'updated_at'>): Promise<GroceryListItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_list_items')
    .insert({
      ...item,
      grocery_list_id: listId
    })
    .select()
    .single()

  if (error) throw error

  // Update total items count
  await supabase
    .from('grocery_lists')
    .update({
      total_items: supabase.sql`total_items + 1`,
      updated_at: new Date().toISOString()
    })
    .eq('id', listId)

  return data
}

// Remove item from grocery list
export async function removeItemFromGroceryList(itemId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the item to find the list ID
  const { data: item } = await supabase
    .from('grocery_list_items')
    .select('grocery_list_id')
    .eq('id', itemId)
    .single()

  const { error } = await supabase
    .from('grocery_list_items')
    .delete()
    .eq('id', itemId)

  if (error) throw error

  // Update total items count
  if (item) {
    await supabase
      .from('grocery_lists')
      .update({
        total_items: supabase.sql`total_items - 1`,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.grocery_list_id)
  }
}

// Update grocery list status
export async function updateGroceryListStatus(listId: string, status: GroceryList['status']): Promise<GroceryList> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('grocery_lists')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', listId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete grocery list
export async function deleteGroceryList(listId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('grocery_lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', user.id)

  if (error) throw error
}

// Get user's ingredient inventory
export async function getUserInventory(): Promise<IngredientInventory[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('ingredient_inventory')
    .select('*')
    .eq('user_id', user.id)
    .order('ingredient_name', { ascending: true })

  if (error) throw error
  return data || []
}

// Add ingredient to inventory
export async function addToInventory(ingredient: Omit<IngredientInventory, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<IngredientInventory> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('ingredient_inventory')
    .insert({
      ...ingredient,
      user_id: user.id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update inventory item
export async function updateInventoryItem(itemId: string, updates: Partial<IngredientInventory>): Promise<IngredientInventory> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('ingredient_inventory')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Remove from inventory
export async function removeFromInventory(itemId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('ingredient_inventory')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) throw error
}

// Create Instacart cart from grocery list
export async function createInstacartCart(listId: string): Promise<{ cart_url: string; estimated_total: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get grocery list with items
  const groceryList = await getGroceryList(listId)
  if (!groceryList) throw new Error('Grocery list not found')

  const response = await supabase.functions.invoke('instacart-integration', {
    body: {
      grocery_list_id: listId,
      user_id: user.id,
      ingredients: groceryList.grocery_list_items || []
    }
  })

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create Instacart cart')
  }

  return response.data
}

// Get grocery list statistics
export async function getGroceryListStats(): Promise<{
  totalLists: number
  completedLists: number
  totalItemsPurchased: number
  averageListSize: number
  totalSpent: number
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: lists } = await supabase
    .from('grocery_lists')
    .select('*, grocery_list_items(*)')
    .eq('user_id', user.id)

  if (!lists) {
    return {
      totalLists: 0,
      completedLists: 0,
      totalItemsPurchased: 0,
      averageListSize: 0,
      totalSpent: 0
    }
  }

  const totalLists = lists.length
  const completedLists = lists.filter(list => list.status === 'completed').length
  const totalItemsPurchased = lists.reduce((sum, list) => 
    sum + (list.grocery_list_items?.filter((item: any) => item.is_purchased).length || 0), 0
  )
  const averageListSize = totalLists > 0 ? 
    lists.reduce((sum, list) => sum + list.total_items, 0) / totalLists : 0
  const totalSpent = lists.reduce((sum, list) => sum + (list.estimated_total || 0), 0)

  return {
    totalLists,
    completedLists,
    totalItemsPurchased,
    averageListSize: Math.round(averageListSize * 10) / 10,
    totalSpent: Math.round(totalSpent * 100) / 100
  }
}

// Get items expiring soon
export async function getExpiringItems(daysAhead: number = 7): Promise<IngredientInventory[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)

  const { data, error } = await supabase
    .from('ingredient_inventory')
    .select('*')
    .eq('user_id', user.id)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', futureDate.toISOString().split('T')[0])
    .order('expiry_date', { ascending: true })

  if (error) throw error
  return data || []
}