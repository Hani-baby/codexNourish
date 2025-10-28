import React, { useState, useMemo } from 'react'
import { Calendar, ArrowLeft, Plus, Search, Clock, Users, ChefHat } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import Badge from '../../../components/ui/Badge'
import { ManualPlanDraft } from './ManualPlanModal'
import RecipeCreationModal from './RecipeCreationModal'
import ManualMealModal from '../../../components/ui/ManualMealModal'

interface ManualPlanEditScreenProps {
  draft: ManualPlanDraft
  onBack: () => void
  onSave: (planData: any) => void
}

interface MealSlot {
  id: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'
  recipeTitle?: string
  recipeId?: string
  prepTime?: number
  cookTime?: number
  servings?: number
  recipeImage?: string
  notes?: string
}

interface DaySchedule {
  date: string
  meals: MealSlot[]
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', color: 'bg-orange-100 text-orange-800' },
  { value: 'lunch', label: 'Lunch', color: 'bg-blue-100 text-blue-800' },
  { value: 'dinner', label: 'Dinner', color: 'bg-purple-100 text-purple-800' },
  { value: 'snack', label: 'Snack', color: 'bg-green-100 text-green-800' },
  { value: 'dessert', label: 'Dessert', color: 'bg-pink-100 text-pink-800' },
]

const SAMPLE_RECIPES = [
  'Chia Yogurt Parfait',
  'Matcha Overnight Oats',
  'Golden Milk Latte',
  'Citrus Quinoa Bowl',
  'Lemon Herb Chicken',
  'Roasted Veggie Grain Bowl',
  'Butternut Squash Soup',
  'Turkey Meatballs with Polenta',
  'Seared Tuna with Greens',
  'Chef special: Surprise me',
]

const QUICK_RECIPES = [
  { title: 'Chia Yogurt Parfait', prepTime: 10, servings: 1, mealType: 'breakfast' },
  { title: 'Lemon Herb Chicken', prepTime: 25, servings: 4, mealType: 'dinner' },
  { title: 'Roasted Veggie Bowl', prepTime: 20, servings: 2, mealType: 'lunch' },
  { title: 'Turkey Meatballs', prepTime: 30, servings: 4, mealType: 'dinner' },
  { title: 'Citrus Quinoa Bowl', prepTime: 15, servings: 2, mealType: 'lunch' },
  { title: 'Butternut Squash Soup', prepTime: 35, servings: 6, mealType: 'dinner' },
]

const getQuickRecipesForMealType = (mealType: string) => {
  return QUICK_RECIPES.filter(recipe => 
    recipe.mealType === mealType || 
    (mealType === 'snack' && ['breakfast', 'lunch'].includes(recipe.mealType))
  ).slice(0, 3)
}

export default function ManualPlanEditScreen({ draft, onBack, onSave }: ManualPlanEditScreenProps) {
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => {
    // Generate initial schedule based on draft
    const days = []
    const startDate = new Date(draft.startDate)
    const endDate = new Date(draft.endDate)
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const meals: MealSlot[] = []
      for (let i = 0; i < draft.mealsPerDay; i++) {
        meals.push({
          id: `${d.toISOString().split('T')[0]}-${i}`,
          mealType: ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'][i] as any,
        })
      }
      days.push({
        date: d.toISOString().split('T')[0],
        meals
      })
    }
    return days
  })

  const [selectedSlot, setSelectedSlot] = useState<{ dayIndex: number; slotIndex: number } | null>(null)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleMealTypeChange = (dayIndex: number, slotIndex: number, mealType: MealSlot['mealType']) => {
    const newSchedule = [...schedule]
    newSchedule[dayIndex].meals[slotIndex].mealType = mealType
    setSchedule(newSchedule)
  }

  const handleRecipeChange = (dayIndex: number, slotIndex: number, recipe: any) => {
    const newSchedule = [...schedule]
    newSchedule[dayIndex].meals[slotIndex] = {
      ...newSchedule[dayIndex].meals[slotIndex],
      recipeTitle: recipe.title,
      prepTime: recipe.prep_min,
      cookTime: recipe.cook_min,
      servings: recipe.servings,
      recipeImage: recipe.image_url,
      recipeId: recipe.id
    }
    setSchedule(newSchedule)
  }

  const handleRecipeFromBrowse = (selection: any) => {
    if (selectedSlot && selection.kind === 'recipe') {
      handleRecipeChange(selectedSlot.dayIndex, selectedSlot.slotIndex, selection.recipe)
      setShowRecipeModal(false)
      setSelectedSlot(null)
    }
  }

  const handleRecipeFromCreate = (recipe: any) => {
    if (selectedSlot) {
      handleRecipeChange(selectedSlot.dayIndex, selectedSlot.slotIndex, recipe)
      setShowCreateModal(false)
      setSelectedSlot(null)
    }
  }

  const handleNotesChange = (dayIndex: number, slotIndex: number, notes: string) => {
    const newSchedule = [...schedule]
    newSchedule[dayIndex].meals[slotIndex].notes = notes
    setSchedule(newSchedule)
  }

  const handleAddMeal = (dayIndex: number) => {
    const newSchedule = [...schedule]
    const newMeal: MealSlot = {
      id: `${schedule[dayIndex].date}-${Date.now()}`,
      mealType: 'snack'
    }
    newSchedule[dayIndex].meals.push(newMeal)
    setSchedule(newSchedule)
  }

  const handleRemoveMeal = (dayIndex: number, slotIndex: number) => {
    const newSchedule = [...schedule]
    newSchedule[dayIndex].meals.splice(slotIndex, 1)
    setSchedule(newSchedule)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getMealTypeColor = (mealType: string) => {
    return MEAL_TYPES.find(mt => mt.value === mealType)?.color || 'bg-gray-100 text-gray-800'
  }

  const totalMeals = schedule.reduce((acc, day) => acc + day.meals.length, 0)
  const assignedMeals = schedule.reduce((acc, day) => 
    acc + day.meals.filter(meal => meal.recipeTitle).length, 0
  )

  return (
    <div className="manual-plan-edit">
      <header className="edit-header">
        <div className="header-content">
          <Button 
            variant="ghost" 
            onClick={onBack}
            leftIcon={<ArrowLeft size={16} />}
          >
            Back
          </Button>
          <div className="plan-info">
            <h1>{draft.title}</h1>
            <div className="plan-meta">
              <Badge variant="neutral">
                <Calendar size={12} />
                {formatDate(draft.startDate)} - {formatDate(draft.endDate)}
              </Badge>
              <Badge variant="neutral">
                <Users size={12} />
                {draft.mealsPerDay} meals/day
              </Badge>
              <Badge variant="neutral">
                <Clock size={12} />
                {totalMeals} total meals
              </Badge>
            </div>
          </div>
        </div>
        <div className="progress-info">
          <div className="progress-text">
            {assignedMeals} of {totalMeals} meals assigned
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${totalMeals > 0 ? (assignedMeals / totalMeals) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      <div className="edit-content">
        <div className="schedule-grid">
          {schedule.map((day, dayIndex) => (
            <Card key={day.date} className="day-card">
              <div className="day-header">
                <h3>{formatDate(day.date)}</h3>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleAddMeal(dayIndex)}
                  leftIcon={<Plus size={14} />}
                >
                  Add meal
                </Button>
              </div>
              
              <div className="meals-list">
                {day.meals.map((meal, slotIndex) => (
                  <div key={meal.id} className="meal-slot">
                    <div className="meal-header">
                      <select
                        value={meal.mealType}
                        onChange={(e) => handleMealTypeChange(dayIndex, slotIndex, e.target.value as MealSlot['mealType'])}
                        className="meal-type-select"
                      >
                        {MEAL_TYPES.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <button 
                        className="remove-meal"
                        onClick={() => handleRemoveMeal(dayIndex, slotIndex)}
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="meal-content">
                      {meal.recipeTitle ? (
                        <div className="selected-recipe">
                          <div className="recipe-card">
                            <div className="recipe-info">
                              <div className="recipe-title">
                                <ChefHat size={16} />
                                <h4>{meal.recipeTitle}</h4>
                              </div>
                              <div className="recipe-meta">
                                {meal.prepTime && (
                                  <Badge variant="neutral" size="sm">
                                    <Clock size={12} />
                                    {meal.prepTime} min prep
                                  </Badge>
                                )}
                                {meal.cookTime && (
                                  <Badge variant="neutral" size="sm">
                                    <Clock size={12} />
                                    {meal.cookTime} min cook
                                  </Badge>
                                )}
                                {meal.servings && (
                                  <Badge variant="neutral" size="sm">
                                    <Users size={12} />
                                    {meal.servings} servings
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="recipe-actions">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setSelectedSlot({ dayIndex, slotIndex })
                                  setShowRecipeModal(true)
                                }}
                              >
                                Change
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleRecipeChange(dayIndex, slotIndex, {})}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="recipe-selector">
                          <div className="quick-assign">
                            <p>Choose a recipe for this {meal.mealType}:</p>
                            <div className="quick-options">
                              {getQuickRecipesForMealType(meal.mealType).map(recipe => (
                                <Button
                                  key={recipe.title}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRecipeChange(dayIndex, slotIndex, recipe)}
                                  className="quick-recipe-btn"
                                >
                                  {recipe.title}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div className="recipe-actions">
                            <Button 
                              size="sm" 
                              variant="primary"
                              onClick={() => {
                                setSelectedSlot({ dayIndex, slotIndex })
                                setShowRecipeModal(true)
                              }}
                              leftIcon={<Search size={14} />}
                            >
                              Browse recipes
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedSlot({ dayIndex, slotIndex })
                                setShowCreateModal(true)
                              }}
                              leftIcon={<ChefHat size={14} />}
                            >
                              Create recipe
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <textarea
                        placeholder="Add notes for this meal..."
                        value={meal.notes || ''}
                        onChange={(e) => handleNotesChange(dayIndex, slotIndex, e.target.value)}
                        rows={2}
                        className="meal-notes"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <footer className="edit-footer">
        <div className="footer-content">
          <div className="save-info">
            <p>Ready to save your meal plan?</p>
            <span>{assignedMeals} of {totalMeals} meals have recipes assigned</span>
          </div>
          <div className="footer-actions">
            <Button variant="ghost" onClick={onBack}>
              Cancel
            </Button>
            <Button 
              onClick={() => onSave({ draft, schedule })}
              disabled={assignedMeals === 0}
            >
              Save meal plan
            </Button>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .manual-plan-edit {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: var(--background);
        }

        .edit-header {
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: var(--space-6);
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .plan-info h1 {
          margin: 0;
          font-size: var(--text-xl);
          font-weight: 600;
        }

        .plan-meta {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }

        .progress-info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .progress-text {
          font-size: var(--text-sm);
          color: var(--text-muted);
          min-width: 120px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--brand-500);
          transition: width 0.3s ease;
        }

        .edit-content {
          flex: 1;
          padding: var(--space-6);
        }

        .schedule-grid {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        }

        .day-card {
          background: var(--panel);
          border: 1px solid var(--border);
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .day-header h3 {
          margin: 0;
          font-size: var(--text-base);
          font-weight: 600;
        }

        .meals-list {
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .meal-slot {
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          background: var(--panel-2);
        }

        .meal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }

        .meal-type-select {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          background: var(--input-bg);
          color: var(--text);
          font-size: var(--text-sm);
        }

        .remove-meal {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 18px;
          padding: var(--space-1);
          border-radius: var(--radius-sm);
        }

        .remove-meal:hover {
          background: var(--danger-50);
          color: var(--danger);
        }

        .meal-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .recipe-selector {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .selected-recipe {
          margin-bottom: var(--space-2);
        }

        .recipe-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
        }

        .recipe-info {
          flex: 1;
        }

        .recipe-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .recipe-title h4 {
          margin: 0;
          font-size: var(--text-sm);
          font-weight: 600;
        }

        .recipe-meta {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .recipe-actions {
          display: flex;
          gap: var(--space-2);
        }

        .quick-assign p {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .quick-options {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .quick-recipe-btn {
          font-size: var(--text-xs);
          padding: var(--space-1) var(--space-2);
        }

        .meal-notes {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-2);
          background: var(--input-bg);
          color: var(--text);
          font-size: var(--text-sm);
          resize: vertical;
          min-height: 60px;
        }

        .edit-footer {
          background: var(--panel);
          border-top: 1px solid var(--border);
          padding: var(--space-6);
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .save-info p {
          margin: 0 0 var(--space-1) 0;
          font-weight: 500;
        }

        .save-info span {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .footer-actions {
          display: flex;
          gap: var(--space-3);
        }

        @media (max-width: 768px) {
          .schedule-grid {
            grid-template-columns: 1fr;
          }
          
          .footer-content {
            flex-direction: column;
            gap: var(--space-4);
            align-items: stretch;
          }
        }
      `}</style>

      {/* Recipe Browse Modal */}
      <ManualMealModal
        isOpen={showRecipeModal}
        onClose={() => {
          setShowRecipeModal(false)
          setSelectedSlot(null)
        }}
        targetDate={selectedSlot ? schedule[selectedSlot.dayIndex]?.date : ''}
        mealType={selectedSlot ? schedule[selectedSlot.dayIndex]?.meals[selectedSlot.slotIndex]?.mealType : 'dinner'}
        onSubmit={handleRecipeFromBrowse}
      />

      {/* Recipe Creation Modal */}
      <RecipeCreationModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setSelectedSlot(null)
        }}
        mealType={selectedSlot ? schedule[selectedSlot.dayIndex]?.meals[selectedSlot.slotIndex]?.mealType : 'dinner'}
        onRecipeCreated={handleRecipeFromCreate}
      />
    </div>
  )
}
