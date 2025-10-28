import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Tabs from '../../components/ui/Tabs'
import LoadingScreen from '../../components/ui/LoadingScreen'
import LoadingState from '../../components/ui/LoadingState'
import { User, Heart, AlertTriangle, Globe, Target, Bell, Shield, Trash2, CreditCard, Download, AlertCircle, Check, X } from 'lucide-react'
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2'
import { supabase } from '../../lib/supabase'
import SubscriptionManagementTab from '../../components/settings/SubscriptionManagementTab'

const tabs = [
  { id: 'profile', label: 'Profile', icon: <User size={16} /> },
  { id: 'preferences', label: 'Preferences', icon: <Heart size={16} /> },
  { id: 'goals', label: 'Health Goals', icon: <Target size={16} /> },
  { id: 'subscription', label: 'Subscription', icon: <CreditCard size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'privacy', label: 'Privacy & Data', icon: <Shield size={16} /> },
  { id: 'account', label: 'Account', icon: <Trash2 size={16} /> }
]

interface UserSettings {
  timezone?: string
  dietary_tags?: string[]
  allergens?: string[]
  disliked_ingredients?: string[]
  cuisine_prefs?: string[]
  macro_split?: any
  calorie_target?: number
  budget_cad?: number
}

interface NutritionGoal {
  id?: string
  strategy: string
  calories_kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  start_date: string
  end_date?: string
}

interface SubscriptionInfo {
  plan_code?: string
  status?: string
  current_period_start?: string
  current_period_end?: string
}

export default function Settings() {
  const { user, profile, updateProfile, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  
  // Form states
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    date_of_birth: '',
    gender: '',
    height_cm: '',
    weight_kg: ''
  })
  
  const [userSettings, setUserSettings] = useState<UserSettings>({})
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoal>({
    strategy: 'maintenance',
    start_date: new Date().toISOString().split('T')[0]
  })
  const [subscription, setSubscription] = useState<SubscriptionInfo>({})
  const [notificationSettings, setNotificationSettings] = useState({
    meal_reminders: true,
    recipe_suggestions: true,
    goal_progress: false,
    shopping_lists: true,
    marketing: false
  })
  const [privacySettings, setPrivacySettings] = useState({
    data_sharing: true,
    marketing_communications: false
  })
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (profile) {
      setProfileForm({
        display_name: profile.display_name || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        height_cm: profile.height_cm?.toString() || '',
        weight_kg: profile.weight_kg?.toString() || ''
      })
    }
    
    if (user && profile) {
      loadAllData()
    }
  }, [user, profile])

  const loadAllData = async () => {
    setDataLoading(true)
    try {
      // Load critical data first (user settings), then others in parallel
      await loadUserSettings()
      
      // Load remaining data in parallel
      await Promise.all([
        loadNutritionGoals(),
        loadSubscriptionInfo()
      ])
    } catch (error) {
      console.error('Error loading settings data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const loadUserSettings = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (data && !error) {
        setUserSettings(data)
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
    }
  }

  const loadNutritionGoals = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', user.id)
        .is('end_date', null)
        .single()
      
      if (data && !error) {
        setNutritionGoals({
          id: data.id,
          strategy: data.strategy,
          calories_kcal: data.calories_kcal,
          protein_g: data.protein_g,
          carbs_g: data.carbs_g,
          fat_g: data.fat_g,
          fiber_g: data.fiber_g,
          start_date: data.start_date,
          end_date: data.end_date
        })
      }
    } catch (error) {
      console.error('Error loading nutrition goals:', error)
    }
  }

  const loadSubscriptionInfo = async () => {
    if (!user) return
    
    try {
      // Get user's household using master-child logic
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('child')
        .eq('id', user.id)
        .single()
      
      const householdId = userProfile?.child || user.id
      
      if (householdId && !profileError) {
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('household_subscriptions')
          .select('*')
          .eq('household_id', householdId)
          .single()
        
        if (subscriptionData && !subscriptionError) {
          setSubscription(subscriptionData)
        }
      }
    } catch (error) {
      console.error('Error loading subscription info:', error)
    }
  }

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setShowToast({ message, type })
    setTimeout(() => setShowToast(null), 3000)
  }

  // Show loading screen while auth or data is loading
  if (authLoading || dataLoading) {
    return (
      <LoadingScreen 
        title="Nourish Settings"
        subtitle="Loading your preferences..."
        showProgress={dataLoading && !authLoading}
      />
    )
  }

  const handleProfileSave = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const updates = {
        display_name: profileForm.display_name,
        date_of_birth: profileForm.date_of_birth || null,
        gender: profileForm.gender || null,
        height_cm: profileForm.height_cm ? parseInt(profileForm.height_cm) : null,
        weight_kg: profileForm.weight_kg ? parseFloat(profileForm.weight_kg) : null,
        updated_at: new Date().toISOString()
      }
      
      const { error } = await updateProfile(updates)
      
      if (error) {
        showNotification('Failed to update profile', 'error')
      } else {
        showNotification('Profile updated successfully')
      }
    } catch (error) {
      showNotification('Failed to update profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSettingsSave = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...userSettings,
          last_updated: new Date().toISOString()
        })
      
      if (error) {
        showNotification('Failed to update preferences', 'error')
      } else {
        showNotification('Preferences updated successfully')
      }
    } catch (error) {
      showNotification('Failed to update preferences', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoalsSave = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // End current goal if exists
      if (nutritionGoals.id) {
        await supabase
          .from('nutrition_goals')
          .update({ end_date: new Date().toISOString().split('T')[0] })
          .eq('id', nutritionGoals.id)
      }
      
      // Create new goal
      const { error } = await supabase
        .from('nutrition_goals')
        .insert({
          user_id: user.id,
          strategy: nutritionGoals.strategy,
          calories_kcal: nutritionGoals.calories_kcal,
          protein_g: nutritionGoals.protein_g,
          carbs_g: nutritionGoals.carbs_g,
          fat_g: nutritionGoals.fat_g,
          fiber_g: nutritionGoals.fiber_g,
          start_date: nutritionGoals.start_date
        })
      
      if (error) {
        showNotification('Failed to update goals', 'error')
      } else {
        showNotification('Health goals updated successfully')
        loadNutritionGoals()
      }
    } catch (error) {
      showNotification('Failed to update goals', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Delete user data (profiles will be deleted via CASCADE)
      const { error } = await supabase.auth.admin.deleteUser(user.id)
      
      if (error) {
        showNotification('Failed to delete account', 'error')
      } else {
        showNotification('Account deleted successfully')
        // User will be signed out automatically
      }
    } catch (error) {
      showNotification('Failed to delete account', 'error')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleExportData = async () => {
    if (!user) return
    
    try {
      // Get all user data
      const [profileData, settingsData, goalsData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('nutrition_goals').select('*').eq('user_id', user.id)
      ])
      
      const exportData = {
        profile: profileData.data,
        settings: settingsData.data,
        nutritionGoals: goalsData.data,
        exportDate: new Date().toISOString()
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nourish-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      showNotification('Data exported successfully')
    } catch (error) {
      showNotification('Failed to export data', 'error')
    }
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-description">Customize your Nourish experience</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        defaultTab="profile"
        onTabChange={setActiveTab}
        variant="underline"
      />

      {/* Content */}
      <div className="settings-content">
        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="subscription-section">
            <SubscriptionManagementTab userId={user?.id} />
          </div>
        )}
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    value={profileForm.display_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, display_name: e.target.value }))}
                    className="form-input"
                    placeholder="Enter your display name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="form-input"
                    disabled
                  />
                  <span className="form-help">Email cannot be changed here. Contact support if needed.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    value={profileForm.date_of_birth}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    value={profileForm.gender}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Height (cm)</label>
                  <input
                    type="number"
                    value={profileForm.height_cm}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, height_cm: e.target.value }))}
                    className="form-input"
                    placeholder="170"
                    min="100"
                    max="250"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input
                    type="number"
                    value={profileForm.weight_kg}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, weight_kg: e.target.value }))}
                    className="form-input"
                    placeholder="70.5"
                    min="30"
                    max="300"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="form-actions">
                <Button onClick={handleProfileSave} disabled={loading}>
                  {loading ? <LoadingState message="Saving..." size="sm" /> : 'Save Changes'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setProfileForm({
                    display_name: profile?.display_name || '',
                    date_of_birth: profile?.date_of_birth || '',
                    gender: profile?.gender || '',
                    height_cm: profile?.height_cm?.toString() || '',
                    weight_kg: profile?.weight_kg?.toString() || ''
                  })}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="preferences-section">
            {/* Dietary Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Dietary Preferences</CardTitle>
              <CardDescription>Tell us about your dietary preferences and lifestyle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="preferences-grid">
                  {['vegetarian', 'vegan', 'keto', 'paleo', 'gluten-free', 'dairy-free'].map(diet => (
                    <div key={diet} className="preference-item">
                      <input 
                        type="checkbox" 
                        id={diet}
                        checked={userSettings.dietary_tags?.includes(diet) || false}
                        onChange={(e) => {
                          const currentTags = userSettings.dietary_tags || []
                          if (e.target.checked) {
                            setUserSettings(prev => ({
                              ...prev,
                              dietary_tags: [...currentTags, diet]
                            }))
                          } else {
                            setUserSettings(prev => ({
                              ...prev,
                              dietary_tags: currentTags.filter(tag => tag !== diet)
                            }))
                          }
                        }}
                        className="preference-checkbox" 
                      />
                      <label htmlFor={diet} className="preference-label">
                        <span className="preference-title">{diet.charAt(0).toUpperCase() + diet.slice(1).replace('-', ' ')}</span>
                  </label>
                </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Allergens & Restrictions */}
            <Card>
              <CardHeader>
                <CardTitle>Allergens & Restrictions</CardTitle>
                <CardDescription>Let us know about any food allergies or restrictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="preferences-grid">
                  {['nuts', 'shellfish', 'eggs', 'dairy', 'soy', 'gluten', 'fish', 'sesame'].map(allergen => (
                    <div key={allergen} className="preference-item">
                      <input 
                        type="checkbox" 
                        id={`allergen-${allergen}`}
                        checked={userSettings.allergens?.includes(allergen) || false}
                        onChange={(e) => {
                          const currentAllergens = userSettings.allergens || []
                          if (e.target.checked) {
                            setUserSettings(prev => ({
                              ...prev,
                              allergens: [...currentAllergens, allergen]
                            }))
                          } else {
                            setUserSettings(prev => ({
                              ...prev,
                              allergens: currentAllergens.filter(a => a !== allergen)
                            }))
                          }
                        }}
                        className="preference-checkbox" 
                      />
                      <label htmlFor={`allergen-${allergen}`} className="preference-label">
                        <span className="preference-title">{allergen.charAt(0).toUpperCase() + allergen.slice(1)}</span>
                  </label>
                </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cuisine Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Favorite Cuisines</CardTitle>
                <CardDescription>Select your preferred types of cuisine</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="preferences-grid">
                  {['italian', 'chinese', 'mexican', 'indian', 'japanese', 'thai', 'mediterranean', 'american'].map(cuisine => (
                    <div key={cuisine} className="preference-item">
                      <input 
                        type="checkbox" 
                        id={`cuisine-${cuisine}`}
                        checked={userSettings.cuisine_prefs?.includes(cuisine) || false}
                        onChange={(e) => {
                          const currentCuisines = userSettings.cuisine_prefs || []
                          if (e.target.checked) {
                            setUserSettings(prev => ({
                              ...prev,
                              cuisine_prefs: [...currentCuisines, cuisine]
                            }))
                          } else {
                            setUserSettings(prev => ({
                              ...prev,
                              cuisine_prefs: currentCuisines.filter(c => c !== cuisine)
                            }))
                          }
                        }}
                        className="preference-checkbox" 
                      />
                      <label htmlFor={`cuisine-${cuisine}`} className="preference-label">
                        <span className="preference-title">{cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}</span>
                  </label>
                </div>
                  ))}
              </div>
              </CardContent>
            </Card>

            {/* Budget */}
            <Card>
              <CardHeader>
                <CardTitle>Budget Preferences</CardTitle>
                <CardDescription>Set your preferred budget for meal planning</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="form-group">
                  <label className="form-label">Weekly Budget (CAD)</label>
                  <input
                    type="number"
                    value={userSettings.budget_cad || ''}
                    onChange={(e) => setUserSettings(prev => ({
                      ...prev,
                      budget_cad: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="form-input"
                    placeholder="150"
                    min="0"
                  />
                  <span className="form-help">Optional: Help us suggest meals within your budget</span>
              </div>
            </CardContent>
          </Card>

            <div className="form-actions">
              <Button onClick={handleSettingsSave} disabled={loading}>
                {loading ? <LoadingState message="Saving..." size="sm" /> : 'Save Preferences'}
              </Button>
            </div>
          </div>
        )}

        {/* Health Goals Tab */}
        {activeTab === 'goals' && (
          <Card>
            <CardHeader>
              <CardTitle>Health Goals</CardTitle>
              <CardDescription>Set your nutrition and fitness targets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="goals-grid">
                <div className="form-group">
                  <label className="form-label">Primary Goal</label>
                  <select 
                    value={nutritionGoals.strategy}
                    onChange={(e) => setNutritionGoals(prev => ({ ...prev, strategy: e.target.value }))}
                    className="form-select"
                  >
                    <option value="maintenance">Maintain Weight</option>
                    <option value="weight_loss">Lose Weight</option>
                    <option value="muscle_gain">Gain Weight/Build Muscle</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Calorie Target</label>
                  <input
                    type="number"
                    value={nutritionGoals.calories_kcal || ''}
                    onChange={(e) => setNutritionGoals(prev => ({ 
                      ...prev, 
                      calories_kcal: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="form-input"
                    placeholder="2200"
                    min="1000"
                    max="5000"
                  />
                  <span className="form-help">Recommended: 1800-2500 calories</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Protein Goal (g)</label>
                  <input
                    type="number"
                    value={nutritionGoals.protein_g || ''}
                    onChange={(e) => setNutritionGoals(prev => ({ 
                      ...prev, 
                      protein_g: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="form-input"
                    placeholder="150"
                    min="30"
                    max="300"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Carbohydrates Goal (g)</label>
                  <input
                    type="number"
                    value={nutritionGoals.carbs_g || ''}
                    onChange={(e) => setNutritionGoals(prev => ({ 
                      ...prev, 
                      carbs_g: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="form-input"
                    placeholder="200"
                    min="20"
                    max="500"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fat Goal (g)</label>
                  <input
                    type="number"
                    value={nutritionGoals.fat_g || ''}
                    onChange={(e) => setNutritionGoals(prev => ({ 
                      ...prev, 
                      fat_g: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="form-input"
                    placeholder="70"
                    min="20"
                    max="200"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fiber Goal (g)</label>
                  <input
                    type="number"
                    value={nutritionGoals.fiber_g || ''}
                    onChange={(e) => setNutritionGoals(prev => ({ 
                      ...prev, 
                      fiber_g: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="form-input"
                    placeholder="25"
                    min="10"
                    max="60"
                  />
                </div>
              </div>
              <div className="form-actions">
                <Button onClick={handleGoalsSave} disabled={loading}>
                  {loading ? <LoadingState message="Saving..." size="sm" /> : 'Update Goals'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <SubscriptionManagementTab userId={user?.id} />
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what notifications you'd like to receive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="notifications-list">
                <div className="notification-item">
                  <div className="notification-info">
                    <span className="notification-title">Meal Reminders</span>
                    <span className="notification-description">Get reminded when it's time to eat</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notificationSettings.meal_reminders}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, meal_reminders: e.target.checked }))}
                    className="notification-toggle" 
                  />
                </div>
                <div className="notification-item">
                  <div className="notification-info">
                    <span className="notification-title">Recipe Suggestions</span>
                    <span className="notification-description">Weekly recipe recommendations</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notificationSettings.recipe_suggestions}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, recipe_suggestions: e.target.checked }))}
                    className="notification-toggle" 
                  />
                </div>
                <div className="notification-item">
                  <div className="notification-info">
                    <span className="notification-title">Goal Progress</span>
                    <span className="notification-description">Updates on your nutrition goals</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notificationSettings.goal_progress}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, goal_progress: e.target.checked }))}
                    className="notification-toggle" 
                  />
                </div>
                <div className="notification-item">
                  <div className="notification-info">
                    <span className="notification-title">Shopping Lists</span>
                    <span className="notification-description">Reminders about grocery shopping</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notificationSettings.shopping_lists}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, shopping_lists: e.target.checked }))}
                    className="notification-toggle" 
                  />
                </div>
                <div className="notification-item">
                  <div className="notification-info">
                    <span className="notification-title">Marketing Communications</span>
                    <span className="notification-description">Promotional emails and updates</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notificationSettings.marketing}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, marketing: e.target.checked }))}
                    className="notification-toggle" 
                  />
                </div>
              </div>
              <div className="form-actions">
                <Button onClick={() => showNotification('Notification preferences saved')}>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Privacy Tab */}
        {activeTab === 'privacy' && (
          <div className="privacy-section">
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Data</CardTitle>
                <CardDescription>Manage your data and privacy settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="privacy-options">
                  <div className="privacy-item">
                    <div className="privacy-info">
                      <span className="privacy-title">Data Sharing</span>
                      <span className="privacy-description">Allow anonymous usage data to improve the service</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={privacySettings.data_sharing}
                      onChange={(e) => setPrivacySettings(prev => ({ ...prev, data_sharing: e.target.checked }))}
                      className="privacy-toggle" 
                    />
                  </div>
                  <div className="privacy-item">
                    <div className="privacy-info">
                      <span className="privacy-title">Marketing Communications</span>
                      <span className="privacy-description">Receive updates about new features and tips</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={privacySettings.marketing_communications}
                      onChange={(e) => setPrivacySettings(prev => ({ ...prev, marketing_communications: e.target.checked }))}
                      className="privacy-toggle" 
                    />
                  </div>
                </div>
                
                <div className="privacy-links">
                  <h4>Legal</h4>
                  <div className="links-grid">
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="privacy-link">
                      Privacy Policy
                    </a>
                    <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="privacy-link">
                      Terms of Service
                    </a>
                    <a href="/cookie-policy" target="_blank" rel="noopener noreferrer" className="privacy-link">
                      Cookie Policy
                    </a>
                    <a href="/data-processing" target="_blank" rel="noopener noreferrer" className="privacy-link">
                      Data Processing Agreement
                    </a>
                  </div>
                </div>
                
                <div className="form-actions">
                  <Button onClick={() => showNotification('Privacy settings updated')}>Update Privacy Settings</Button>
                  <Button variant="outline" onClick={handleExportData} leftIcon={<Download size={16} />}>
                    Download My Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Account Management Tab */}
        {activeTab === 'account' && (
          <div className="account-section">
            <Card>
              <CardHeader>
                <CardTitle>Account Management</CardTitle>
                <CardDescription>Manage your account settings and data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="account-info">
                  <div className="info-item">
                    <span className="info-label">Account Created:</span>
                    <span className="info-value">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Last Updated:</span>
                    <span className="info-value">{profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">User ID:</span>
                    <span className="info-value">{user?.id}</span>
                  </div>
                </div>
                
                <div className="account-actions">
                  <Button variant="outline" onClick={handleExportData} leftIcon={<Download size={16} />}>
                    Export All Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="danger-zone">
              <CardHeader>
                <CardTitle className="danger-title">Danger Zone</CardTitle>
                <CardDescription>Irreversible and destructive actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="danger-content">
                  <div className="danger-info">
                    <h4>Delete Account</h4>
                    <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                    <div className="warning-list">
                      <div className="warning-item">
                        <AlertTriangle size={16} className="warning-icon" />
                        <span>All your recipes and meal plans will be deleted</span>
                  </div>
                      <div className="warning-item">
                        <AlertTriangle size={16} className="warning-icon" />
                        <span>Your nutrition goals and progress will be lost</span>
                      </div>
                      <div className="warning-item">
                        <AlertTriangle size={16} className="warning-icon" />
                        <span>Your subscription will be cancelled immediately</span>
                      </div>
                      <div className="warning-item">
                        <AlertTriangle size={16} className="warning-icon" />
                        <span>This action cannot be undone</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="danger" 
                    leftIcon={<Trash2 size={16} />}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <AlertCircle size={24} className="modal-icon danger" />
                <h3>Confirm Account Deletion</h3>
              </div>
              <div className="modal-content">
                <p>Are you absolutely sure you want to delete your account? This action cannot be undone.</p>
                <p><strong>Please type "DELETE" to confirm:</strong></p>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="Type DELETE here"
                  onChange={(e) => {
                    const deleteButton = document.getElementById('confirm-delete-btn') as HTMLButtonElement
                    if (deleteButton) {
                      deleteButton.disabled = e.target.value !== 'DELETE'
                    }
                  }}
                />
              </div>
              <div className="modal-actions">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button 
                  id="confirm-delete-btn"
                  variant="danger" 
                  onClick={handleDeleteAccount}
                  disabled={true}
                >
                  {loading ? <LoadingState message="Deleting..." size="sm" /> : 'Delete Account'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className={`toast toast-${showToast.type}`}>
          {showToast.type === 'success' ? (
            <Check size={16} className="toast-icon" />
          ) : (
            <X size={16} className="toast-icon" />
          )}
          {showToast.message}
        </div>
      )}

      <style jsx>{`
        .settings-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .header-content {
          flex: 1;
        }

        .page-title {
          font-size: var(--text-3xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .page-description {
          font-size: var(--text-lg);
          color: var(--text-muted);
          margin: 0;
        }

        .settings-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .goals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .form-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .form-input,
        .form-select {
          padding: var(--space-3);
          background-color: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--radius-md);
          color: var(--input-text);
          font-size: var(--text-sm);
          transition: border-color var(--transition-fast);
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: var(--brand);
        }

        .form-input::placeholder {
          color: var(--input-placeholder);
        }

        .form-help {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .form-actions {
          display: flex;
          gap: var(--space-3);
          padding-top: var(--space-4);
          border-top: 1px solid var(--border);
        }

        .preferences-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .preference-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }

        .preference-checkbox {
          margin-top: var(--space-1);
          accent-color: var(--brand);
        }

        .preference-label {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          cursor: pointer;
        }

        .preference-title {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .preference-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .notifications-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .notification-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          background-color: var(--panel-2);
          border-radius: var(--radius-md);
        }

        .notification-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .notification-title {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .notification-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .notification-toggle,
        .privacy-toggle {
          accent-color: var(--brand);
        }

        .privacy-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .privacy-options {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .privacy-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          background-color: var(--panel-2);
          border-radius: var(--radius-md);
        }

        .privacy-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .privacy-title {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .privacy-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .danger-zone {
          border-color: var(--danger);
        }

        .danger-title {
          color: var(--danger);
        }

        .danger-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
        }

        .danger-info h4 {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .danger-info p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .placeholder-content {
          text-align: center;
          padding: var(--space-8);
        }

        .placeholder-content p {
          color: var(--text-muted);
          margin: 0;
        }

        .preferences-section,
        .subscription-section,
        .account-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .subscription-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .current-plan h4 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .status {
          display: inline-block;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          text-transform: uppercase;
        }

        .status-active {
          background-color: var(--success-bg);
          color: var(--success);
        }

        .status-past_due {
          background-color: var(--warning-bg);
          color: var(--warning);
        }

        .status-canceled {
          background-color: var(--danger-bg);
          color: var(--danger);
        }

        .plan-actions {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .no-subscription {
          text-align: center;
          padding: var(--space-6);
        }

        .no-subscription h4 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--space-4);
          margin-top: var(--space-6);
        }

        .plan-card {
          padding: var(--space-6);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          background-color: var(--panel-1);
          text-align: center;
        }

        .plan-card.featured {
          border-color: var(--brand);
          background-color: var(--brand-bg);
        }

        .plan-card h5 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .price {
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--brand);
          margin: 0 0 var(--space-4) 0;
        }

        .plan-card ul {
          list-style: none;
          padding: 0;
          margin: 0 0 var(--space-6) 0;
        }

        .plan-card li {
          padding: var(--space-2) 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .privacy-links {
          margin-top: var(--space-6);
          padding-top: var(--space-6);
          border-top: 1px solid var(--border);
        }

        .privacy-links h4 {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-4) 0;
        }

        .links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
        }

        .privacy-link {
          color: var(--brand);
          text-decoration: none;
          font-size: var(--text-sm);
          padding: var(--space-2);
          border-radius: var(--radius-md);
          transition: background-color var(--transition-fast);
        }

        .privacy-link:hover {
          background-color: var(--brand-bg);
        }

        .account-info {
          margin-bottom: var(--space-6);
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3) 0;
          border-bottom: 1px solid var(--border);
        }

        .info-label {
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .info-value {
          color: var(--text-muted);
          font-family: monospace;
          font-size: var(--text-sm);
        }

        .account-actions {
          margin-bottom: var(--space-6);
        }

        .warning-list {
          margin-top: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .warning-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--danger);
          font-size: var(--text-sm);
        }

        .warning-icon {
          flex-shrink: 0;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal);
        }

        .modal {
          background-color: var(--panel-1);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          max-width: 500px;
          width: 90%;
          box-shadow: var(--shadow-xl);
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .modal-header h3 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .modal-icon.danger {
          color: var(--danger);
        }

        .modal-content {
          margin-bottom: var(--space-6);
        }

        .modal-content p {
          color: var(--text);
          margin: 0 0 var(--space-3) 0;
        }

        .modal-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
        }

        .toast {
          position: fixed;
          top: var(--space-6);
          right: var(--space-6);
          padding: var(--space-4) var(--space-6);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          font-weight: var(--font-medium);
          z-index: var(--z-toast);
          animation: slideIn 0.3s ease-out;
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .toast-success {
          background-color: var(--success);
          color: white;
        }

        .toast-error {
          background-color: var(--danger);
          color: white;
        }

        .toast-icon {
          flex-shrink: 0;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @media (max-width: 767px) {
          .form-grid {
            grid-template-columns: 1fr;
          }

          .goals-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .danger-content {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .notification-item,
          .privacy-item {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
          }

          .toast {
            top: var(--space-4);
            right: var(--space-4);
            left: var(--space-4);
            text-align: center;
          }
        }
      `}</style>
      <style jsx>{`
        .page-header {
          padding: var(--space-6) 0;
          margin-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }
        .header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }
        .page-title {
          margin: 0;
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
        }
        .page-description { margin: 0; color: var(--text-muted); }
        .settings-content { display: flex; flex-direction: column; gap: var(--space-6); }
      `}</style>
    </div>
  )
}
