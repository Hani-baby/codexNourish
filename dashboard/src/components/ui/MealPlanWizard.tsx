import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
import Button from './Button'
import Input from './Input'
import EnhancedInput from './EnhancedInput'
import Select from './Select'
import Badge from './Badge'
import DateRangePicker from './DateRangePicker'
import StepIndicator from './StepIndicator'
import { Calendar, Users, Clock, Sparkles, AlertTriangle, X, ChefHat, Target, Zap } from 'lucide-react'
import { useMealPlans } from '../../lib/use-data'
import { DateRange, findNextAvailableDay, findNextAvailableWeek, findOverlappingRange, mergeRanges, rangeLengthInDays } from '../../lib/meal-plan-availability'

interface MealPlanWizardProps {
  isOpen: boolean
  onClose: () => void
  onCreatePlan: (planData: MealPlanData) => void
}

interface MealPlanData {
  dateRange: {
    start: string
    end: string
  }
  inspiration: string
  mealsPerDay: number
  servings: number
  usePreferences: boolean
  specificRequests: string
  timeframe?: 'week' | 'day' | 'event'
  meals?: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'>
  rules?: {
    avoid_recent_weeks?: number
    max_repeat_per_week?: number
    min_variety_days?: number
  }
  include_ai_text?: boolean
  refresh_grocery_list?: boolean
  // Event planning specific fields
  eventDetails?: {
    isEvent: boolean
    guestCount: number
    eventDescription: string
    eventMeals: 'breakfast' | 'lunch' | 'dinner' | 'all-day'
  }
}

const MEAL_STRUCTURES = {
  1: ['Dinner'],
  2: ['Lunch', 'Dinner'],
  3: ['Breakfast', 'Lunch', 'Dinner'],
  4: ['Breakfast', 'Snack', 'Lunch', 'Dinner'],
  5: ['Breakfast', 'Snack', 'Lunch', 'Dinner', 'Snack'],
  6: ['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner', 'Snack']
}

export default function MealPlanWizard({ isOpen, onClose, onCreatePlan }: MealPlanWizardProps) {
  const { data: mealPlans } = useMealPlans()

  const planRanges = useMemo(() => {
    if (!mealPlans) return [] as Array<{ start: string; end: string; title: string }>
    return mealPlans.map(plan => ({
      start: plan.dateRange.start,
      end: plan.dateRange.end,
      title: plan.title,
    }))
  }, [mealPlans])

  const blockedRanges = useMemo(() =>
    mergeRanges(planRanges.map(({ start, end }) => ({ start, end }))),
  [planRanges])
  const [step, setStep] = useState(1)
  const [dateSelectionMode, setDateSelectionMode] = useState<'single' | 'week' | 'custom'>('week')
  const [formData, setFormData] = useState<MealPlanData>({
    dateRange: {
      start: getNextMonday(),
      end: getNextSunday()
    },
    inspiration: 'Surprise me!',
    mealsPerDay: 3,
    servings: 2,
    usePreferences: true,
    specificRequests: ''
  })
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [hasUserEditedRange, setHasUserEditedRange] = useState(false)

  const deriveTimeframe = (range: DateRange): MealPlanData['timeframe'] => {
    const length = rangeLengthInDays(range)
    if (dateSelectionMode === 'single' || length === 1) return 'day'
    if (dateSelectionMode === 'week' || length === 7) return 'week'
    return 'event'
  }

  // Precompute existing plan date ranges to prevent overlaps
    useEffect(() => {
    if (isOpen) {
      setHasUserEditedRange(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (hasUserEditedRange) return
    if (!formData.dateRange?.start || !formData.dateRange?.end) return

    const todayIso = new Date().toISOString().split('T')[0]
    let candidate = null as DateRange | null

    if (dateSelectionMode === 'single') {
      candidate = findNextAvailableDay(blockedRanges, { from: todayIso })
    } else if (dateSelectionMode === 'week') {
      candidate = findNextAvailableWeek(blockedRanges, { from: todayIso })
    }

    if (candidate) {
      setFormData(prev => ({
        ...prev,
        dateRange: candidate,
        timeframe: deriveTimeframe(candidate, dateSelectionMode),
      }))
    }
  }, [isOpen, dateSelectionMode, blockedRanges, hasUserEditedRange])

  const overlappingRange = useMemo(() => {
    if (!formData.dateRange?.start || !formData.dateRange?.end) {
      return null
    }
    const overlap = findOverlappingRange({
      start: formData.dateRange.start,
      end: formData.dateRange.end,
    }, blockedRanges)

    if (!overlap) return null
    return planRanges.find(range => range.start === overlap.start && range.end === overlap.end) ?? overlap
  }, [formData.dateRange, blockedRanges, planRanges])

  const handleNext = () => {
    if (step < 3) {
      if (step === 1 && overlappingRange) return // block moving forward when overlap
      setStep(step + 1)
    } else {
      // Show confirmation if user is not using preferences OR if they have specific requests
      if (!formData.usePreferences || (!formData.usePreferences && formData.specificRequests.trim())) {
        setShowConfirmation(true)
      } else {
        handleCreatePlan()
      }
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleCreatePlan = () => {
    if (overlappingRange) return

    const mealsOrder = buildMealsArray(formData.mealsPerDay)
    const payload = {
      timeframe: formData.timeframe ?? 'week' as const,
      meals: formData.meals ?? mealsOrder,
      rules: {
        avoid_recent_weeks: formData.rules?.avoid_recent_weeks ?? 4,
        max_repeat_per_week: formData.rules?.max_repeat_per_week ?? 1,
        min_variety_days: formData.rules?.min_variety_days ?? 3
      },
      include_ai_text: formData.include_ai_text ?? true,
      refresh_grocery_list: formData.refresh_grocery_list ?? true
    }

    const finalPlanData = {
      ...formData,
      meals: payload.meals,
      timeframe: payload.timeframe,
      rules: payload.rules,
      include_ai_text: payload.include_ai_text,
      refresh_grocery_list: payload.refresh_grocery_list
    }

    console.log('🍽️ MealPlanWizard: Data being passed to onCreatePlan:', {
      formData: formData,
      payload: payload,
      finalPlanData: finalPlanData
    })

    onCreatePlan(finalPlanData)
    onClose()
  }

  const updateFormData = (updates: Partial<MealPlanData>) => {
    if (updates.dateRange) {
      setHasUserEditedRange(true)
    }

    setFormData(prev => {
      const next = { ...prev, ...updates }
      if (updates.dateRange) {
        next.timeframe = deriveTimeframe(updates.dateRange)
      }
      return next
    })
  }

  if (!isOpen) return null

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        {showConfirmation ? (
          <Card className="confirmation-card">
            <CardHeader>
              <div className="confirmation-header">
                <AlertTriangle size={24} className="warning-icon" />
                <CardTitle>Confirm Your Choices</CardTitle>
              </div>
              <CardDescription>
                You've chosen to ignore your dietary preferences and {formData.specificRequests.trim() ? 'provided specific requirements' : 'let us surprise you'}. 
                This may result in meal suggestions that don't align with your usual preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="confirmation-details">
                {!formData.usePreferences && (
                  <div className="warning-item">
                    <strong>Dietary preferences will be ignored</strong>
                    <p>The meal plan won't consider your saved dietary restrictions and preferences.</p>
                  </div>
                )}
                {!formData.usePreferences && formData.specificRequests.trim() && (
                  <div className="warning-item">
                    <strong>Your specific requests:</strong>
                    <p>"{formData.specificRequests}"</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <div className="confirmation-actions">
                <Button variant="ghost" onClick={() => setShowConfirmation(false)}>
                  Go Back
                </Button>
                <Button onClick={handleCreatePlan}>
                  Yes, Create Plan
                </Button>
              </div>
            </CardFooter>
          </Card>
        ) : (
          <Card className="wizard-card">
            <CardHeader>
              <div className="wizard-header">
                <div className="wizard-title-section">
                  <div className="wizard-icon">
                    <ChefHat size={24} />
                  </div>
                  <div>
                    <CardTitle>Create New Meal Plan</CardTitle>
                    <CardDescription>Let's craft your perfect meal plan together</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="close-button">
                  <X size={16} />
                </Button>
              </div>
              <StepIndicator
                currentStep={step}
                totalSteps={3}
                steps={[
                  { title: 'When & What', description: 'Choose dates and inspiration' },
                  { title: 'Meal Structure', description: 'Set up your meals' },
                  { title: 'Preferences', description: 'Finalize your plan' }
                ]}
              />
            </CardHeader>

            <CardContent>
              {step === 1 && (
                <div className="wizard-step">
                  <div className="step-header">
                    <div className="step-icon">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3>When & What</h3>
                      <p>Choose your dates and tell us what you're craving</p>
                    </div>
                  </div>

                  <div className="form-section">
                    <DateRangePicker
                      startDate={formData.dateRange.start}
                      endDate={formData.dateRange.end}
                      onChange={(start, end) => updateFormData({
                        dateRange: { start, end }
                      })}
                      existingRanges={planRanges}
                      label="Date Range"
                      hint="Choose how you want to select your dates"
                      selectionMode={dateSelectionMode}
                      onSelectionModeChange={(mode) => {
                        setHasUserEditedRange(false)
                        setDateSelectionMode(mode)
                      }}
                    />
                  </div>



                  <div className="form-section">
                    <EnhancedInput
                      label="What are you feeling like?"
                      placeholder="Surprise me! 🎉"
                      value={formData.inspiration}
                      onChange={(e) => updateFormData({ inspiration: e.target.value })}
                      icon={<Sparkles size={16} />}
                      hint="Tell us your mood, cuisine preference, or let us surprise you!"
                      animated
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <>
                <div className="wizard-step">
                  <div className="step-header">
                    <div className="step-icon">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3>Meal Structure</h3>
                      <p>Set up your daily meal routine</p>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="meal-count-section">
                      <label className="section-label">How many meals per day?</label>
                      <div className="meal-count-grid">
                        {[1, 2, 3, 4, 5, 6].map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={`meal-count-card ${formData.mealsPerDay === count ? 'active' : ''}`}
                            onClick={() => updateFormData({ mealsPerDay: count })}
                          >
                            <div className="meal-count-number">{count}</div>
                            <div className="meal-count-label">
                              {count === 1 ? 'Just Dinner' : 
                               count === 2 ? 'Lunch & Dinner' :
                               count === 3 ? 'Full Day' :
                               `${count} Meals`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="meal-structure-preview">
                      <div className="preview-header">
                        <span className="preview-label">Your meal structure:</span>
                        <div className="preview-badges">
                          {buildMealsArray(formData.mealsPerDay).map((meal, index) => (
                            <Badge key={index} variant="brand" size="sm" className="meal-badge">
                              {capitalize(meal)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <label className="section-label">How many people are you cooking for?</label>
                    <div className="servings-grid">
                      {[1, 2, 3, 4, 5, 6].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`serving-option ${formData.servings === count ? 'active' : ''}`}
                          onClick={() => updateFormData({ servings: count })}
                        >
                          <div className="serving-icon">
                            <Users size={18} />
                          </div>
                          <div className="serving-content">
                            <div className="serving-count">{count}</div>
                            <div className="serving-label">
                              {count === 1 ? 'Just me' : 
                               count === 2 ? 'Couple' :
                               count === 3 ? 'Small family' :
                               count === 4 ? 'Family' :
                               count === 5 ? 'Large family' :
                               '6+ people'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {overlappingRange && (
                  <div className="overlap-warning">
                    <AlertTriangle size={16} />
                    <span>
                      Selected range overlaps with existing plan "{overlappingRange.title}" ({formatRange(overlappingRange.start, overlappingRange.end)}).
                      Please choose a different week.
                    </span>
                  </div>
                )}
                </>
              )}

              {step === 3 && (
                <div className="wizard-step">
                  <div className="step-header">
                    <div className="step-icon">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h3>Preferences & Special Requests</h3>
                      <p>Fine-tune your meal plan generation</p>
                    </div>
                  </div>
                  
                  <div className="form-section">
                    <div className="preference-toggle">
                      <div className="toggle-header">
                        <div className="toggle-icon">
                          <Target size={18} />
                        </div>
                        <div className="toggle-content">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={formData.usePreferences}
                              onChange={(e) => updateFormData({ usePreferences: e.target.checked })}
                            />
                            <span className="toggle-text">
                              Use my dietary preferences and restrictions
                            </span>
                          </label>
                          <p className="toggle-description">
                            We'll create meals tailored to your saved preferences and dietary restrictions
                          </p>
                        </div>
                      </div>
                    </div>

                    {!formData.usePreferences && (
                      <div className="form-section">
                        <EnhancedInput
                          label="Tell us what you're in the mood for"
                          placeholder="e.g., I want to try Mediterranean cuisine, avoid dairy this week, include more protein, focus on comfort foods..."
                          value={formData.specificRequests}
                          onChange={(e) => updateFormData({ specificRequests: e.target.value })}
                          icon={<Sparkles size={16} />}
                          hint="Since you're not using saved preferences, help us understand what you want for this meal plan"
                          animated
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-section">
                    <label className="section-label">Advanced Options</label>
                    <div className="advanced-options">
                      <div className="option-group">
                        <label className="option-label">Avoid recent weeks</label>
                        <EnhancedInput
                          type="number"
                          value={String(formData.rules?.avoid_recent_weeks ?? 4)}
                          onChange={(e) => updateFormData({ 
                            rules: { ...formData.rules, avoid_recent_weeks: parseInt(e.target.value || '0') } 
                          })}
                          hint="How many weeks back to avoid repeating meals"
                          animated
                        />
                      </div>
                      <div className="option-group">
                        <label className="option-label">Max repeat per week</label>
                        <EnhancedInput
                          type="number"
                          value={String(formData.rules?.max_repeat_per_week ?? 1)}
                          onChange={(e) => updateFormData({ 
                            rules: { ...formData.rules, max_repeat_per_week: parseInt(e.target.value || '0') } 
                          })}
                          hint="Maximum times a recipe can repeat in one week"
                          animated
                        />
                      </div>
                      <div className="option-group">
                        <label className="option-label">Min variety days</label>
                        <EnhancedInput
                          type="number"
                          value={String(formData.rules?.min_variety_days ?? 3)}
                          onChange={(e) => updateFormData({ 
                            rules: { ...formData.rules, min_variety_days: parseInt(e.target.value || '0') } 
                          })}
                          hint="Minimum days with different cuisine types"
                          animated
                        />
                      </div>
                    </div>

                    <div className="feature-toggles">
                      <div className="feature-toggle">
                        <label className="toggle-label">
                          <input 
                            type="checkbox" 
                            checked={formData.include_ai_text ?? true} 
                            onChange={(e) => updateFormData({ include_ai_text: e.target.checked })} 
                          />
                          <span className="toggle-text">Polish plan titles and summaries with AI</span>
                        </label>
                        <p className="toggle-description">Make your meal plan descriptions more engaging</p>
                      </div>
                      <div className="feature-toggle">
                        <label className="toggle-label">
                          <input 
                            type="checkbox" 
                            checked={formData.refresh_grocery_list ?? true} 
                            onChange={(e) => updateFormData({ refresh_grocery_list: e.target.checked })} 
                          />
                          <span className="toggle-text">Auto-generate grocery list from plan</span>
                        </label>
                        <p className="toggle-description">Create a shopping list based on your meal plan</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <div className="wizard-actions">
                <Button 
                  variant="ghost" 
                  onClick={handleBack}
                  disabled={step === 1}
                >
                  Back
                </Button>
                <Button onClick={handleNext} disabled={step === 1 && !!overlappingRange}>
                  {step === 3 ? 'Create Plan' : 'Next'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>

      <style jsx>{`
        .wizard-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6));
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal);
          padding: var(--space-4);
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .wizard-container {
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .wizard-card, .confirmation-card {
          background-color: var(--panel);
          box-shadow: var(--shadow-xl);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .wizard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: var(--space-6);
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, var(--panel), var(--panel-2));
        }

        .wizard-title-section {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .wizard-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--brand-500), var(--brand-600));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.3);
        }

        .close-button {
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
        }

        .close-button:hover {
          background-color: var(--hover-bg);
          transform: scale(1.05);
        }

        .confirmation-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .warning-icon {
          color: var(--warning);
        }

        .wizard-step {
          padding: var(--space-6);
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .step-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--brand-100), var(--brand-200));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-600);
        }

        .step-header h3 {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .step-header p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .form-section {
          margin-bottom: var(--space-6);
        }

        .section-label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin-bottom: var(--space-3);
        }

        .timeframe-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
          margin-top: var(--space-3);
        }

        .timeframe-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-4);
          background-color: var(--panel-2);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .timeframe-option:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .timeframe-option.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.2);
        }

        .option-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background-color: var(--brand-100);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-600);
        }

        .timeframe-option.active .option-icon {
          background-color: var(--brand-500);
          color: white;
        }

        .option-content {
          flex: 1;
        }

        .option-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .option-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .meal-count-section {
          margin-bottom: var(--space-6);
        }

        .meal-count-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: var(--space-3);
        }

        .meal-count-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-4);
          background-color: var(--panel-2);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }

        .meal-count-card:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .meal-count-card.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.2);
        }

        .meal-count-number {
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--brand-600);
          margin-bottom: var(--space-2);
        }

        .meal-count-card.active .meal-count-number {
          color: var(--brand-700);
        }

        .meal-count-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-weight: var(--font-medium);
        }

        .meal-structure-preview {
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-top: var(--space-4);
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .preview-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .preview-badges {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .meal-badge {
          animation: fadeInUp 0.3s ease-out;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .servings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: var(--space-3);
        }

        .serving-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background-color: var(--panel-2);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .serving-option:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .serving-option.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 2px 8px rgba(0, 177, 64, 0.2);
        }

        .serving-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background-color: var(--brand-100);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-600);
        }

        .serving-option.active .serving-icon {
          background-color: var(--brand-500);
          color: white;
        }

        .serving-content {
          flex: 1;
        }

        .serving-count {
          font-size: var(--text-lg);
          font-weight: var(--font-bold);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .serving-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          font-weight: var(--font-medium);
        }

        .preference-toggle {
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .toggle-header {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }

        .toggle-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-lg);
          background-color: var(--brand-100);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-600);
          flex-shrink: 0;
        }

        .toggle-content {
          flex: 1;
        }

        .toggle-label {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          cursor: pointer;
          margin-bottom: var(--space-2);
        }

        .toggle-label input[type="checkbox"] {
          margin: 0;
          margin-top: 2px;
          width: 18px;
          height: 18px;
          accent-color: var(--brand-500);
        }

        .toggle-text {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .toggle-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }

        .advanced-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .option-label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .feature-toggles {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .feature-toggle {
          background: linear-gradient(135deg, var(--panel-2), var(--panel));
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }

        .wizard-actions {
          display: flex;
          justify-content: space-between;
          width: 100%;
          padding: var(--space-6);
          border-top: 1px solid var(--border);
          background: linear-gradient(135deg, var(--panel), var(--panel-2));
        }

        .overlap-warning {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3);
          margin-top: var(--space-4);
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, var(--warning-100), var(--warning-50));
          border: 1px solid var(--warning-200);
          color: var(--warning-700);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        [data-theme="dark"] .overlap-warning {
          background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.05));
          border-color: rgba(251,191,36,0.2);
          color: var(--warning-300);
        }

        .confirmation-details {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .warning-item {
          padding: var(--space-4);
          background: linear-gradient(135deg, var(--warning-100), var(--warning-50));
          border: 1px solid var(--warning-200);
          border-radius: var(--radius-lg);
        }

        [data-theme="dark"] .warning-item {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05));
          border-color: rgba(251, 191, 36, 0.2);
        }

        .warning-item strong {
          display: block;
          color: var(--warning-700);
          margin-bottom: var(--space-1);
          font-weight: var(--font-semibold);
        }

        [data-theme="dark"] .warning-item strong {
          color: var(--warning-300);
        }

        .warning-item p {
          margin: 0;
          color: var(--warning-600);
          font-size: var(--text-sm);
          line-height: 1.4;
        }

        [data-theme="dark"] .warning-item p {
          color: var(--warning-200);
        }

        .confirmation-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
          width: 100%;
        }

        /* Event Planning Styles */
        .event-planning-section {
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          border: 1px solid var(--brand-200);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--brand-200);
        }

        .section-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-lg);
          background-color: var(--brand-500);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .section-header h4 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .section-header p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .event-fields {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .event-meals-section {
          margin-top: var(--space-4);
        }

        .event-meals-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: var(--space-3);
          margin-top: var(--space-3);
        }

        .event-meal-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background-color: var(--panel);
          border: 2px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .event-meal-option:hover {
          border-color: var(--brand-300);
          background-color: var(--hover-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .event-meal-option.active {
          border-color: var(--brand-500);
          background: linear-gradient(135deg, var(--brand-50), var(--brand-100));
          box-shadow: 0 4px 12px rgba(0, 177, 64, 0.2);
        }

        .meal-option-icon {
          font-size: var(--text-xl);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .meal-option-content {
          flex: 1;
        }

        .meal-option-title {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin-bottom: var(--space-1);
        }

        .meal-option-description {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        /* Dark theme adjustments for event planning */
        [data-theme="dark"] .event-planning-section {
          background: linear-gradient(135deg, rgba(0, 177, 64, 0.1), rgba(0, 177, 64, 0.05));
          border-color: rgba(0, 177, 64, 0.2);
        }

        [data-theme="dark"] .section-header {
          border-bottom-color: rgba(0, 177, 64, 0.2);
        }

        [data-theme="dark"] .event-meal-option {
          background-color: var(--panel);
          border-color: var(--border);
        }

        [data-theme="dark"] .event-meal-option.active {
          background: linear-gradient(135deg, rgba(0, 177, 64, 0.1), rgba(0, 177, 64, 0.05));
          border-color: var(--brand-400);
        }

        @media (max-width: 640px) {
          .wizard-overlay {
            padding: var(--space-2);
          }

          .wizard-container {
            max-width: 100%;
          }

          .wizard-header {
            padding: var(--space-4);
          }

          .wizard-step {
            padding: var(--space-4);
          }

          .timeframe-options {
            grid-template-columns: 1fr;
          }

          .event-meals-options {
            grid-template-columns: repeat(2, 1fr);
          }

          .meal-count-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .servings-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .advanced-options {
            grid-template-columns: 1fr;
          }

          .preview-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  )
}

// Helper functions
function getNextMonday(): string {
  const today = new Date()
  const monday = new Date(today)
  const daysUntilMonday = (1 + 7 - today.getDay()) % 7
  monday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday))
  return monday.toISOString().split('T')[0]
}

function getNextSunday(): string {
  const monday = new Date(getNextMonday())
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday.toISOString().split('T')[0]
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  // normalize times
  const aS = new Date(aStart); aS.setHours(0,0,0,0)
  const aE = new Date(aEnd); aE.setHours(23,59,59,999)
  const bS = new Date(bStart); bS.setHours(0,0,0,0)
  const bE = new Date(bEnd); bE.setHours(23,59,59,999)
  return aS <= bE && bS <= aE
}

function formatRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${sStr} - ${eStr}`
}

function buildMealsArray(mealsPerDay: number): Array<'breakfast'|'lunch'|'dinner'|'snack'> {
  if (mealsPerDay === 1) return ['dinner']
  if (mealsPerDay === 2) return ['breakfast','dinner']
  if (mealsPerDay === 3) return ['breakfast','lunch','dinner']
  // 4-6 → insert snacks between
  const base: Array<'breakfast'|'lunch'|'dinner'|'snack'> = ['breakfast','snack','lunch','dinner']
  if (mealsPerDay >= 5) base.push('snack')
  if (mealsPerDay >= 6) base.splice(3, 0, 'snack') // breakfast, snack, lunch, snack, dinner, snack
  return base
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
