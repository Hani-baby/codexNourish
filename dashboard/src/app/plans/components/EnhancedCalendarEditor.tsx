import React, { useState } from 'react'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card'
import { MealPlan, DaySchedule } from '../mock-data'
import { 
  CalendarRange, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw, 
  Lock, 
  Unlock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface EnhancedCalendarEditorProps {
  plan: MealPlan | null
  schedule: DaySchedule[]
  onScheduleChange: (schedule: DaySchedule[]) => void
  onSave: () => void
  onReset: () => void
  hasChanges: boolean
}

const RECIPE_LIBRARY = [
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

const MEAL_TYPES: Array<{ value: DaySchedule['meals'][number]['mealType']; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'dessert', label: 'Dessert' },
]

export default function EnhancedCalendarEditor({ 
  plan, 
  schedule, 
  onScheduleChange, 
  onSave, 
  onReset, 
  hasChanges 
}: EnhancedCalendarEditorProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(0)

  if (!plan) {
    return (
      <Card>
        <CardContent>
          <div className="empty-editor">
            <p>Select a plan to open the calendar editor. Slots will appear here once a plan is active.</p>
          </div>
        </CardContent>
        <style jsx>{`
          .empty-editor {
            min-height: 220px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            font-size: var(--text-sm);
          }
        `}</style>
      </Card>
    )
  }

  // Group days into weeks (4 days per row)
  const daysPerWeek = 4
  const weeks = []
  for (let i = 0; i < schedule.length; i += daysPerWeek) {
    weeks.push(schedule.slice(i, i + daysPerWeek))
  }

  const currentWeekData = weeks[currentWeek] || []
  const totalWeeks = weeks.length

  const handleAddMeal = (date: string, mealType: DaySchedule['meals'][number]['mealType']) => {
    if (!isEditMode) return
    
    const newMeal = {
      id: `meal-${Date.now()}`,
      name: 'New meal',
      mealType,
      calories: 0,
      time: '',
      protein: 0,
      carbs: 0,
      fat: 0,
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop',
      servings: 1,
      notes: ''
    }

    const updatedSchedule = schedule.map(day => {
      if (day.date === date) {
        return {
          ...day,
          meals: [...day.meals, newMeal]
        }
      }
      return day
    })

    onScheduleChange(updatedSchedule)
  }

  const handleRemoveMeal = (date: string, mealId: string) => {
    if (!isEditMode) return
    
    const updatedSchedule = schedule.map(day => {
      if (day.date === date) {
        return {
          ...day,
          meals: day.meals.filter(meal => meal.id !== mealId)
        }
      }
      return day
    })

    onScheduleChange(updatedSchedule)
  }

  const handleMealNameChange = (date: string, mealId: string, newName: string) => {
    if (!isEditMode) return
    
    const updatedSchedule = schedule.map(day => {
      if (day.date === date) {
        return {
          ...day,
          meals: day.meals.map(meal => 
            meal.id === mealId ? { ...meal, name: newName } : meal
          )
        }
      }
      return day
    })

    onScheduleChange(updatedSchedule)
  }

  const toggleEditMode = () => {
    if (isEditMode && hasChanges) {
      // Ask for confirmation before exiting edit mode
      if (confirm('You have unsaved changes. Are you sure you want to exit edit mode?')) {
        setIsEditMode(false)
      }
    } else {
      setIsEditMode(!isEditMode)
    }
  }

  const handleSave = () => {
    onSave()
    setIsEditMode(false)
  }

  const handleReset = () => {
    onReset()
    setIsEditMode(false)
  }

  return (
    <Card className="calendar-editor">
      <CardHeader>
        <div className="calendar-header">
          <div>
            <CardTitle>Meal Calendar</CardTitle>
            <CardDescription>
              {isEditMode ? 'Edit mode active - click and drag to modify meals' : 'View your meal schedule'}
            </CardDescription>
          </div>
          <div className="calendar-actions">
            {isEditMode ? (
              <div className="edit-actions">
                <Button variant="ghost" size="sm" onClick={handleReset} leftIcon={<RotateCcw size={16} />}>
                  Reset
                </Button>
                <Button size="sm" onClick={handleSave} leftIcon={<Save size={16} />}>
                  Save Changes
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)} leftIcon={<Lock size={16} />}>
                  Exit Edit
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={toggleEditMode} leftIcon={<Edit3 size={16} />}>
                Edit Plan
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Week Navigation */}
        {totalWeeks > 1 && (
          <div className="week-navigation">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCurrentWeek(Math.max(0, currentWeek - 1))}
              disabled={currentWeek === 0}
              leftIcon={<ChevronLeft size={16} />}
            >
              Previous
            </Button>
            <span className="week-indicator">
              Week {currentWeek + 1} of {totalWeeks}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCurrentWeek(Math.min(totalWeeks - 1, currentWeek + 1))}
              disabled={currentWeek === totalWeeks - 1}
              rightIcon={<ChevronRight size={16} />}
            >
              Next
            </Button>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="calendar-grid">
          {currentWeekData.map((day, index) => (
            <DayCard
              key={day.date}
              day={day}
              isEditMode={isEditMode}
              onAddMeal={handleAddMeal}
              onRemoveMeal={handleRemoveMeal}
              onMealNameChange={handleMealNameChange}
            />
          ))}
        </div>

        {/* Edit Mode Instructions */}
        {isEditMode && (
          <div className="edit-instructions">
            <div className="instruction-item">
              <Plus size={16} />
              <span>Click the + button to add meals</span>
            </div>
            <div className="instruction-item">
              <Trash2 size={16} />
              <span>Click the trash icon to remove meals</span>
            </div>
            <div className="instruction-item">
              <Edit3 size={16} />
              <span>Click on meal names to edit them</span>
            </div>
          </div>
        )}
      </CardContent>

      <style jsx>{`
        .calendar-editor {
          border: ${isEditMode ? '2px solid var(--brand-200)' : '1px solid var(--border-strong)'};
          background: ${isEditMode ? 'linear-gradient(135deg, var(--brand-50) 0%, var(--surface) 100%)' : 'var(--surface)'};
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .calendar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .edit-actions {
          display: flex;
          gap: var(--space-2);
        }

        .week-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
          padding: var(--space-3);
          background: var(--panel-1);
          border-radius: var(--radius-lg);
        }

        .week-indicator {
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .edit-instructions {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: var(--space-4);
          background: var(--brand-50);
          border: 1px solid var(--brand-200);
          border-radius: var(--radius-lg);
        }

        .instruction-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .instruction-item svg {
          color: var(--brand-500);
        }

        @media (max-width: 1024px) {
          .calendar-grid {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .calendar-header {
            flex-direction: column;
            align-items: stretch;
          }

          .edit-actions {
            flex-direction: column;
          }

          .week-navigation {
            flex-direction: column;
            gap: var(--space-2);
          }
        }
      `}</style>
    </Card>
  )
}

interface DayCardProps {
  day: DaySchedule
  isEditMode: boolean
  onAddMeal: (date: string, mealType: DaySchedule['meals'][number]['mealType']) => void
  onRemoveMeal: (date: string, mealId: string) => void
  onMealNameChange: (date: string, mealId: string, newName: string) => void
}

function DayCard({ day, isEditMode, onAddMeal, onRemoveMeal, onMealNameChange }: DayCardProps) {
  const [editingMeal, setEditingMeal] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      dayNumber: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' })
    }
  }

  const { dayName, dayNumber, month } = formatDate(day.date)

  const handleMealNameEdit = (mealId: string, currentName: string) => {
    if (!isEditMode) return
    setEditingMeal(mealId)
  }

  const handleMealNameSave = (mealId: string, newName: string) => {
    if (newName.trim()) {
      onMealNameChange(day.date, mealId, newName.trim())
    }
    setEditingMeal(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent, mealId: string, currentName: string) => {
    if (e.key === 'Enter') {
      handleMealNameSave(mealId, (e.target as HTMLInputElement).value)
    } else if (e.key === 'Escape') {
      setEditingMeal(null)
    }
  }

  return (
    <div className="day-card">
      <div className="day-header">
        <div className="day-info">
          <h3 className="day-name">{dayName}</h3>
          <div className="day-date">
            <span className="day-number">{dayNumber}</span>
            <span className="day-month">{month}</span>
          </div>
        </div>
        <div className="day-meta">
          <Badge variant="neutral" size="xs">
            {day.meals.length} meals
          </Badge>
        </div>
      </div>

      <div className="meals-list">
        {day.meals.map(meal => (
          <div key={meal.id} className="meal-item">
            <div className="meal-content">
              {editingMeal === meal.id ? (
                <input
                  type="text"
                  defaultValue={meal.name}
                  className="meal-name-input"
                  autoFocus
                  onBlur={(e) => handleMealNameSave(meal.id, e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, meal.id, meal.name)}
                />
              ) : (
                <div 
                  className="meal-name"
                  onClick={() => isEditMode && handleMealNameEdit(meal.id, meal.name)}
                >
                  {meal.name}
                </div>
              )}
              <div className="meal-meta">
                <Badge variant="neutral" size="xs">
                  {meal.mealType}
                </Badge>
                {meal.calories > 0 && (
                  <span className="meal-calories">{meal.calories} cal</span>
                )}
              </div>
            </div>
            {isEditMode && (
              <button
                className="remove-meal-btn"
                onClick={() => onRemoveMeal(day.date, meal.id)}
                title="Remove meal"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        {isEditMode && (
          <div className="add-meal-section">
            <div className="meal-type-buttons">
              {MEAL_TYPES.map(mealType => (
                <button
                  key={mealType.value}
                  className="add-meal-btn"
                  onClick={() => onAddMeal(day.date, mealType.value)}
                  title={`Add ${mealType.label}`}
                >
                  <Plus size={14} />
                  {mealType.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .day-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          transition: all var(--transition-fast);
        }

        .day-card:hover {
          border-color: var(--border-strong);
          box-shadow: var(--shadow-sm);
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-4);
        }

        .day-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .day-name {
          margin: 0;
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .day-date {
          display: flex;
          align-items: baseline;
          gap: var(--space-1);
        }

        .day-number {
          font-size: var(--text-xl);
          font-weight: var(--font-bold);
          color: var(--brand-500);
        }

        .day-month {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .day-meta {
          display: flex;
          align-items: center;
        }

        .meals-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .meal-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          background: var(--panel-1);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }

        .meal-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .meal-name {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
          cursor: ${isEditMode ? 'pointer' : 'default'};
        }

        .meal-name:hover {
          color: ${isEditMode ? 'var(--brand-500)' : 'var(--text)'};
        }

        .meal-name-input {
          width: 100%;
          padding: var(--space-1) var(--space-2);
          border: 1px solid var(--brand-300);
          border-radius: var(--radius-sm);
          background: var(--surface);
          color: var(--text);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .meal-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .meal-calories {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .remove-meal-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border: none;
          background: var(--danger-100);
          color: var(--danger-600);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .remove-meal-btn:hover {
          background: var(--danger-200);
        }

        .add-meal-section {
          margin-top: var(--space-2);
        }

        .meal-type-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .add-meal-btn {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          border: 1px dashed var(--border);
          background: var(--panel-1);
          color: var(--text-muted);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--text-xs);
          transition: all var(--transition-fast);
        }

        .add-meal-btn:hover {
          border-color: var(--brand-300);
          color: var(--brand-600);
          background: var(--brand-50);
        }

        @media (max-width: 768px) {
          .day-card {
            padding: var(--space-3);
          }

          .meal-type-buttons {
            flex-direction: column;
          }

          .add-meal-btn {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
