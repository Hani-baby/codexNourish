import React from 'react'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card'
import { MealPlan, DaySchedule } from '../mock-data'
import { CalendarRange, Plus, Trash2 } from 'lucide-react'

interface PlanCalendarEditorProps {
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

export default function PlanCalendarEditor({ plan, schedule, onScheduleChange, onSave, onReset, hasChanges }: PlanCalendarEditorProps) {
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
            text-align: center;
            color: var(--text-muted);
            font-size: var(--text-sm);
          }
        `}</style>
      </Card>
    )
  }

  const handleRecipeChange = (dayIndex: number, slotIndex: number, recipe: string) => {
    const next = cloneSchedule(schedule)
    next[dayIndex].meals[slotIndex] = {
      ...next[dayIndex].meals[slotIndex],
      recipeTitle: recipe,
    }
    onScheduleChange(next)
  }

  const handleMealTypeChange = (dayIndex: number, slotIndex: number, mealType: DaySchedule['meals'][number]['mealType']) => {
    const next = cloneSchedule(schedule)
    next[dayIndex].meals[slotIndex] = {
      ...next[dayIndex].meals[slotIndex],
      mealType,
    }
    onScheduleChange(next)
  }

  const handleDayDateChange = (dayIndex: number, newDate: string) => {
    const next = cloneSchedule(schedule)
    next[dayIndex] = {
      ...next[dayIndex],
      date: newDate,
    }
    onScheduleChange(sortedSchedule(next))
  }

  const handleNotesChange = (dayIndex: number, slotIndex: number, notes: string) => {
    const next = cloneSchedule(schedule)
    next[dayIndex].meals[slotIndex] = {
      ...next[dayIndex].meals[slotIndex],
      notes,
    }
    onScheduleChange(next)
  }

  const handleRemoveSlot = (dayIndex: number, slotIndex: number) => {
    const next = cloneSchedule(schedule)
    next[dayIndex].meals.splice(slotIndex, 1)
    onScheduleChange(next)
  }

  const handleAddSlot = (dayIndex: number) => {
    const next = cloneSchedule(schedule)
    if (next[dayIndex].meals.length >= 6) return
    next[dayIndex].meals.push({
      id: `${next[dayIndex].date}-extra-${Date.now()}`,
      mealType: 'snack',
      recipeTitle: 'New recipe',
    })
    onScheduleChange(next)
  }

  const handleAddDay = () => {
    if (schedule.length === 0) return
    const lastDay = schedule[schedule.length - 1]
    const nextDate = addDays(lastDay.date, 1)
    const next = cloneSchedule(schedule)
    next.push({
      date: nextDate,
      meals: [
        { id: `${nextDate}-m1`, mealType: 'breakfast', recipeTitle: 'Morning smoothie' },
        { id: `${nextDate}-m2`, mealType: 'lunch', recipeTitle: 'Chef salad' },
        { id: `${nextDate}-m3`, mealType: 'dinner', recipeTitle: 'Baked salmon' },
      ],
    })
    onScheduleChange(next)
  }

  return (
    <Card className="calendar-editor">
      <CardHeader>
        <CardTitle>Calendar editor</CardTitle>
        <CardDescription>Adjust the meals Chef generated or slot in your own recipes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="days-grid">
          {schedule.map((day, dayIndex) => (
            <div key={day.date} className="day-card">
              <div className="day-header">
                <div>
                  <h3>{formatDay(day.date)}</h3>
                  <p>{formatRange(day.date)}</p>
                </div>
                <input
                  type="date"
                  value={day.date}
                  onChange={event => handleDayDateChange(dayIndex, event.target.value)}
                />
              </div>

              <div className="slots">
                {day.meals.map((slot, slotIndex) => (
                  <div key={slot.id} className="slot-row">
                    <div className="slot-meta">
                      <label>
                        <span>Meal type</span>
                        <select
                          value={slot.mealType}
                          onChange={event => handleMealTypeChange(dayIndex, slotIndex, event.target.value as typeof slot.mealType)}
                        >
                          {MEAL_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="slot-body">
                      <label>
                        <span>Recipe</span>
                        <select
                          value={slot.recipeTitle || ''}
                          onChange={event => handleRecipeChange(dayIndex, slotIndex, event.target.value)}
                        >
                          {[slot.recipeTitle || '', ...RECIPE_LIBRARY.filter(recipe => recipe !== (slot.recipeTitle || ''))].map(recipe => (
                            <option key={recipe} value={recipe}>
                              {recipe}
                            </option>
                          ))}
                        </select>
                      </label>
                      <textarea
                        placeholder="Notes for this meal"
                        value={slot.notes || ''}
                        onChange={event => handleNotesChange(dayIndex, slotIndex, event.target.value)}
                        rows={2}
                      />
                    </div>
                    <button className="remove-slot" onClick={() => handleRemoveSlot(dayIndex, slotIndex)} aria-label="Remove meal slot">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="day-footer">
                <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={() => handleAddSlot(dayIndex)} disabled={schedule[dayIndex].meals.length >= 6}>
                  Add recipe slot
                </Button>
                <Badge variant="neutral" size="xs">
                  {schedule[dayIndex].meals.length} / 6 slots used
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="editor-actions">
          <Button variant="outline" onClick={handleAddDay} leftIcon={<CalendarRange size={16} />}>
            Extend plan by a day
          </Button>
          <div className="actions-right">
            <Button variant="ghost" onClick={onReset} disabled={!hasChanges}>
              Reset changes
            </Button>
            <Button onClick={onSave} disabled={!hasChanges}>
              Save changes
            </Button>
          </div>
        </div>
      </CardContent>

      <style jsx>{`
        .calendar-editor {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .days-grid {
          display: grid;
          gap: var(--space-4);
        }

        .day-card {
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          background: var(--panel);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
        }

        .day-header h3 {
          margin: 0;
          font-size: var(--text-base);
        }

        .day-header p {
          margin: var(--space-1) 0 0 0;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .day-header input[type='date'] {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          background: var(--input-bg);
          color: var(--text);
          font-size: var(--text-sm);
        }

        .slots {
          display: grid;
          gap: var(--space-3);
        }

        .slot-row {
          display: grid;
          grid-template-columns: 140px 1fr auto;
          gap: var(--space-3);
          align-items: stretch;
        }

        .slot-meta label span,
        .slot-body label span {
          display: block;
          font-size: var(--text-xs);
          color: var(--text-muted);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: var(--space-2);
        }

        select {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px;
          background: var(--input-bg);
          color: var(--text);
          font-size: var(--text-sm);
        }

        textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          background: var(--input-bg);
          color: var(--text);
          font-size: var(--text-sm);
          resize: vertical;
        }

        .remove-slot {
          border: none;
          background: transparent;
          color: var(--danger);
          cursor: pointer;
          padding: var(--space-2);
          border-radius: var(--radius-full);
        }

        .remove-slot:hover {
          background: rgba(248, 113, 113, 0.12);
        }

        .day-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .editor-actions {
          margin-top: var(--space-4);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .actions-right {
          display: flex;
          gap: var(--space-3);
        }

        @media (max-width: 768px) {
          .slot-row {
            grid-template-columns: 1fr;
          }

          .day-footer {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-2);
          }

          .editor-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .actions-right {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </Card>
  )
}

function cloneSchedule(schedule: DaySchedule[]) {
  return schedule.map(day => ({
    date: day.date,
    meals: day.meals.map(meal => ({ ...meal })),
  }))
}

function sortedSchedule(schedule: DaySchedule[]) {
  return [...schedule].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(date))
}

function formatRange(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date))
}
