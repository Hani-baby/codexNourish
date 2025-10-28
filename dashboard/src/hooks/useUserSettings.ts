import { useState, useEffect, useCallback } from 'react'
import { 
  getUserSettings, 
  updateUserSettings, 
  getNutritionGoals, 
  updateNutritionGoals,
  getUserProfile,
  updateUserProfile,
  getCompleteUserData,
  calculateRecommendedGoals,
  type UserSettings, 
  type NutritionGoals,
  type UserProfile 
} from '@/lib/user-settings-service'

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [goals, setGoals] = useState<NutritionGoals | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const userData = await getCompleteUserData()
      setSettings(userData.settings)
      setGoals(userData.goals)
      setProfile(userData.profile)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      setSaving(true)
      setError(null)
      
      const updatedSettings = await updateUserSettings(newSettings)
      setSettings(updatedSettings)
      
      return updatedSettings
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
      setError(errorMessage)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  const saveGoals = useCallback(async (newGoals: Partial<NutritionGoals>) => {
    try {
      setSaving(true)
      setError(null)
      
      const updatedGoals = await updateNutritionGoals(newGoals)
      setGoals(updatedGoals)
      
      return updatedGoals
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save nutrition goals'
      setError(errorMessage)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  const saveProfile = useCallback(async (newProfile: Partial<UserProfile>) => {
    try {
      setSaving(true)
      setError(null)
      
      const updatedProfile = await updateUserProfile(newProfile)
      setProfile(updatedProfile)
      
      return updatedProfile
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save profile'
      setError(errorMessage)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  const calculateRecommendations = useCallback(async () => {
    try {
      const recommendations = await calculateRecommendedGoals()
      return recommendations
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate recommendations'
      setError(errorMessage)
      throw err
    }
  }, [])

  const applyRecommendations = useCallback(async () => {
    try {
      const recommendations = await calculateRecommendations()
      return await saveGoals(recommendations)
    } catch (err) {
      throw err
    }
  }, [calculateRecommendations, saveGoals])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  return {
    settings,
    goals,
    profile,
    loading,
    saving,
    error,
    saveSettings,
    saveGoals,
    saveProfile,
    calculateRecommendations,
    applyRecommendations,
    refreshData: fetchUserData
  }
}