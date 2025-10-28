'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  UserIcon, 
  TargetIcon, 
  SettingsIcon, 
  SaveIcon, 
  LoaderIcon,
  CheckCircleIcon,
  XIcon,
  PlusIcon
} from 'lucide-react'
import { useUserSettings } from '@/hooks/useUserSettings'
import { type UserSettings, type NutritionGoals, type UserProfile } from '@/lib/user-settings-service'

export function UserSettingsManager() {
  const {
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
    applyRecommendations
  } = useUserSettings()

  const [activeTab, setActiveTab] = useState('profile')
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const handleSave = async (type: 'profile' | 'settings' | 'goals', data: any) => {
    try {
      setSaveSuccess(null)
      
      switch (type) {
        case 'profile':
          await saveProfile(data)
          setSaveSuccess('Profile updated successfully!')
          break
        case 'settings':
          await saveSettings(data)
          setSaveSuccess('Settings updated successfully!')
          break
        case 'goals':
          await saveGoals(data)
          setSaveSuccess('Nutrition goals updated successfully!')
          break
      }
      
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  const handleApplyRecommendations = async () => {
    try {
      await applyRecommendations()
      setSaveSuccess('Recommended nutrition goals applied!')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to apply recommendations:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert>
          <CheckCircleIcon className="h-4 w-4" />
          <AlertDescription>{saveSuccess}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <TargetIcon className="h-4 w-4" />
            Nutrition Goals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings 
            profile={profile} 
            onSave={(data) => handleSave('profile', data)}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="settings">
          <PreferencesSettings 
            settings={settings} 
            onSave={(data) => handleSave('settings', data)}
            saving={saving}
          />
        </TabsContent>

        <TabsContent value="goals">
          <NutritionGoalsSettings 
            goals={goals}
            profile={profile}
            onSave={(data) => handleSave('goals', data)}
            onApplyRecommendations={handleApplyRecommendations}
            saving={saving}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface ProfileSettingsProps {
  profile: UserProfile | null
  onSave: (data: Partial<UserProfile>) => void
  saving: boolean
}

function ProfileSettings({ profile, onSave, saving }: ProfileSettingsProps) {
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    date_of_birth: profile?.date_of_birth || '',
    gender: profile?.gender || '',
    height_cm: profile?.height_cm || '',
    weight_kg: profile?.weight_kg || '',
    timezone: profile?.timezone || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      height_cm: formData.height_cm ? Number(formData.height_cm) : undefined,
      weight_kg: formData.weight_kg ? Number(formData.weight_kg) : undefined
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
        <CardDescription>
          Update your personal details to get more accurate nutrition recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={formData.gender} onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="height_cm">Height (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                value={formData.height_cm}
                onChange={(e) => setFormData(prev => ({ ...prev, height_cm: e.target.value }))}
                placeholder="170"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight_kg">Weight (kg)</Label>
              <Input
                id="weight_kg"
                type="number"
                step="0.1"
                value={formData.weight_kg}
                onChange={(e) => setFormData(prev => ({ ...prev, weight_kg: e.target.value }))}
                placeholder="70"
              />
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <LoaderIcon className="h-4 w-4 mr-2 animate-spin" /> : <SaveIcon className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface PreferencesSettingsProps {
  settings: UserSettings | null
  onSave: (data: Partial<UserSettings>) => void
  saving: boolean
}

function PreferencesSettings({ settings, onSave, saving }: PreferencesSettingsProps) {
  const [formData, setFormData] = useState({
    dietary_restrictions: settings?.dietary_restrictions || [],
    allergies: settings?.allergies || [],
    cuisine_preferences: settings?.cuisine_preferences || [],
    cooking_skill_level: settings?.cooking_skill_level || '',
    meal_prep_time: settings?.meal_prep_time || '',
    household_size: settings?.household_size || 2,
    budget_range: settings?.budget_range || ''
  })

  const [newRestriction, setNewRestriction] = useState('')
  const [newAllergy, setNewAllergy] = useState('')
  const [newCuisine, setNewCuisine] = useState('')

  const addItem = (type: 'dietary_restrictions' | 'allergies' | 'cuisine_preferences', value: string) => {
    if (!value.trim()) return
    
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], value.trim()]
    }))
    
    if (type === 'dietary_restrictions') setNewRestriction('')
    if (type === 'allergies') setNewAllergy('')
    if (type === 'cuisine_preferences') setNewCuisine('')
  }

  const removeItem = (type: 'dietary_restrictions' | 'allergies' | 'cuisine_preferences', index: number) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Food Preferences</CardTitle>
        <CardDescription>
          Set your dietary preferences to get personalized meal recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dietary Restrictions */}
          <div className="space-y-3">
            <Label>Dietary Restrictions</Label>
            <div className="flex gap-2">
              <Input
                value={newRestriction}
                onChange={(e) => setNewRestriction(e.target.value)}
                placeholder="e.g., Vegetarian, Vegan, Keto"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('dietary_restrictions', newRestriction))}
              />
              <Button type="button" onClick={() => addItem('dietary_restrictions', newRestriction)}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.dietary_restrictions.map((restriction, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {restriction}
                  <XIcon 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeItem('dietary_restrictions', index)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div className="space-y-3">
            <Label>Allergies</Label>
            <div className="flex gap-2">
              <Input
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                placeholder="e.g., Nuts, Dairy, Shellfish"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('allergies', newAllergy))}
              />
              <Button type="button" onClick={() => addItem('allergies', newAllergy)}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.allergies.map((allergy, index) => (
                <Badge key={index} variant="destructive" className="flex items-center gap-1">
                  {allergy}
                  <XIcon 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeItem('allergies', index)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Cuisine Preferences */}
          <div className="space-y-3">
            <Label>Preferred Cuisines</Label>
            <div className="flex gap-2">
              <Input
                value={newCuisine}
                onChange={(e) => setNewCuisine(e.target.value)}
                placeholder="e.g., Italian, Asian, Mediterranean"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem('cuisine_preferences', newCuisine))}
              />
              <Button type="button" onClick={() => addItem('cuisine_preferences', newCuisine)}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.cuisine_preferences.map((cuisine, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  {cuisine}
                  <XIcon 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeItem('cuisine_preferences', index)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cooking_skill">Cooking Skill Level</Label>
              <Select value={formData.cooking_skill_level} onValueChange={(value) => setFormData(prev => ({ ...prev, cooking_skill_level: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select skill level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal_prep_time">Available Prep Time</Label>
              <Select value={formData.meal_prep_time} onValueChange={(value) => setFormData(prev => ({ ...prev, meal_prep_time: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prep time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15 minutes">15 minutes</SelectItem>
                  <SelectItem value="30 minutes">30 minutes</SelectItem>
                  <SelectItem value="45 minutes">45 minutes</SelectItem>
                  <SelectItem value="1 hour">1 hour</SelectItem>
                  <SelectItem value="1+ hours">1+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="household_size">Household Size</Label>
              <Input
                id="household_size"
                type="number"
                min="1"
                max="10"
                value={formData.household_size}
                onChange={(e) => setFormData(prev => ({ ...prev, household_size: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_range">Budget Range</Label>
              <Select value={formData.budget_range} onValueChange={(value) => setFormData(prev => ({ ...prev, budget_range: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select budget range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget-friendly</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <LoaderIcon className="h-4 w-4 mr-2 animate-spin" /> : <SaveIcon className="h-4 w-4 mr-2" />}
            Save Preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface NutritionGoalsSettingsProps {
  goals: NutritionGoals | null
  profile: UserProfile | null
  onSave: (data: Partial<NutritionGoals>) => void
  onApplyRecommendations: () => void
  saving: boolean
}

function NutritionGoalsSettings({ goals, profile, onSave, onApplyRecommendations, saving }: NutritionGoalsSettingsProps) {
  const [formData, setFormData] = useState({
    daily_calories: goals?.daily_calories || '',
    protein_grams: goals?.protein_grams || '',
    carbs_grams: goals?.carbs_grams || '',
    fat_grams: goals?.fat_grams || '',
    fiber_grams: goals?.fiber_grams || '',
    sodium_mg: goals?.sodium_mg || '',
    goal_type: goals?.goal_type || '',
    activity_level: goals?.activity_level || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      daily_calories: formData.daily_calories ? Number(formData.daily_calories) : undefined,
      protein_grams: formData.protein_grams ? Number(formData.protein_grams) : undefined,
      carbs_grams: formData.carbs_grams ? Number(formData.carbs_grams) : undefined,
      fat_grams: formData.fat_grams ? Number(formData.fat_grams) : undefined,
      fiber_grams: formData.fiber_grams ? Number(formData.fiber_grams) : undefined,
      sodium_mg: formData.sodium_mg ? Number(formData.sodium_mg) : undefined
    })
  }

  const canCalculateRecommendations = profile?.weight_kg && profile?.height_cm

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition Goals</CardTitle>
        <CardDescription>
          Set your daily nutrition targets to get personalized meal plans.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {canCalculateRecommendations && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Get Personalized Recommendations</h4>
                  <p className="text-sm text-muted-foreground">
                    Based on your profile, we can calculate recommended nutrition goals.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={onApplyRecommendations} disabled={saving}>
                  Apply Recommendations
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal_type">Goal Type</Label>
              <Select value={formData.goal_type} onValueChange={(value) => setFormData(prev => ({ ...prev, goal_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight_loss">Weight Loss</SelectItem>
                  <SelectItem value="weight_gain">Weight Gain</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity_level">Activity Level</Label>
              <Select value={formData.activity_level} onValueChange={(value) => setFormData(prev => ({ ...prev, activity_level: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="lightly_active">Lightly Active</SelectItem>
                  <SelectItem value="moderately_active">Moderately Active</SelectItem>
                  <SelectItem value="very_active">Very Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_calories">Daily Calories</Label>
              <Input
                id="daily_calories"
                type="number"
                value={formData.daily_calories}
                onChange={(e) => setFormData(prev => ({ ...prev, daily_calories: e.target.value }))}
                placeholder="2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protein_grams">Protein (g)</Label>
              <Input
                id="protein_grams"
                type="number"
                value={formData.protein_grams}
                onChange={(e) => setFormData(prev => ({ ...prev, protein_grams: e.target.value }))}
                placeholder="150"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carbs_grams">Carbs (g)</Label>
              <Input
                id="carbs_grams"
                type="number"
                value={formData.carbs_grams}
                onChange={(e) => setFormData(prev => ({ ...prev, carbs_grams: e.target.value }))}
                placeholder="200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat_grams">Fat (g)</Label>
              <Input
                id="fat_grams"
                type="number"
                value={formData.fat_grams}
                onChange={(e) => setFormData(prev => ({ ...prev, fat_grams: e.target.value }))}
                placeholder="70"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiber_grams">Fiber (g)</Label>
              <Input
                id="fiber_grams"
                type="number"
                value={formData.fiber_grams}
                onChange={(e) => setFormData(prev => ({ ...prev, fiber_grams: e.target.value }))}
                placeholder="25"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sodium_mg">Sodium (mg)</Label>
            <Input
              id="sodium_mg"
              type="number"
              value={formData.sodium_mg}
              onChange={(e) => setFormData(prev => ({ ...prev, sodium_mg: e.target.value }))}
              placeholder="2300"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <LoaderIcon className="h-4 w-4 mr-2 animate-spin" /> : <SaveIcon className="h-4 w-4 mr-2" />}
            Save Goals
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}