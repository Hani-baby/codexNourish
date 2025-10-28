import { useState, useEffect } from 'react'
import { useAuthLegacy as useAuth } from './auth-context-v2'
import * as dataServices from './data-services'

// Generic data fetching hook
function useAsyncData<T>(
  fetchFn: () => Promise<{ data: T | null; error: any }>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchFn()
      
      if (result.error) {
        setError(result.error)
        setData(null)
      } else {
        setData(result.data)
        setError(null)
      }
    } catch (err) {
      setError(err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const fetchDataWithCancellation = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchFn()
        
        if (!cancelled) {
          if (result.error) {
            setError(result.error)
            setData(null)
          } else {
            setData(result.data)
            setError(null)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err)
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchDataWithCancellation()

    return () => {
      cancelled = true
    }
  }, dependencies)

  return { data, loading, error, refetch: fetchData }
}

// Specific hooks for different data types

export function useDashboardStats() {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: null, error: null }
      return { data: await dataServices.getDashboardStats(user.id), error: null }
    },
    [user?.id]
  )
}

export function useTodaysMeals() {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: null, error: null }
      // Note: getTodaysMeals service removed as meal_plan_items table no longer exists
      return { data: [], error: null }
    },
    [user?.id]
  )
}

export function useRecipes(options?: {
  mealTypes?: string[]
  searchTerm?: string
  limit?: number
  offset?: number
}) {
  return useAsyncData(
    async () => {
      const result = await dataServices.getRecipes(options)
      return result
    },
    [options?.mealTypes, options?.searchTerm, options?.limit, options?.offset]
  )
}

export function useSavedRecipes() {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: null, error: null }
      const result = await dataServices.getSavedRecipes(user.id)
      return result
    },
    [user?.id]
  )
}

export function useCurrentMealPlan() {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: null, error: null }
      const result = await dataServices.getCurrentMealPlan(user.id)
      return result
    },
    [user?.id]
  )
}

export function useMealPlans() {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: null, error: null }
      const result = await dataServices.getMealPlans(user.id)
      return result
    },
    [user?.id]
  )
}

export function useNutritionGoals() {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: null, error: null }
      // Note: getCurrentNutritionGoals service removed as nutrition_goals table no longer exists
      return { data: null, error: null }
    },
    [user?.id]
  )
}

export function useSuggestedMeals(options?: {
  mealType?: string
  excludeRecipeIds?: string[]
  limit?: number
}) {
  const { user } = useAuth()
  
  return useAsyncData(
    async () => {
      if (!user) return { data: [], error: null }
      const result = await dataServices.getSuggestedMeals(user.id, options)
      return result
    },
    [user?.id, options?.mealType, options?.excludeRecipeIds, options?.limit]
  )
}

// Recipe-specific hooks
export function useRecipe(id: string | null) {
  return useAsyncData(
    async () => {
      if (!id) return { data: null, error: null }
      const result = await dataServices.getRecipeById(id)
      return result
    },
    [id]
  )
}

export function useRecipeCategoryAnalytics() {
  return useAsyncData(
    async () => {
      const result = await dataServices.getRecipeCategoryAnalytics()
      return result
    },
    []
  )
}

export function useRecipeStats() {
  return useAsyncData(
    async () => {
      const result = await dataServices.getRecipeStats()
      return result
    },
    []
  )
}
