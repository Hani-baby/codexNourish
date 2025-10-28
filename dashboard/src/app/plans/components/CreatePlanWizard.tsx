import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import StepIndicator from '../../../components/ui/StepIndicator'
import Badge from '../../../components/ui/Badge'
import GenerationView from '../../../components/ui/GenerationView'
import { MealPlan } from '../mock-data'
import { CalendarRange, Sparkles, X } from 'lucide-react'
import { MealPlanService, MealPlanRequest } from '../../../lib/meal-plan-service'
import { useAuth } from '../../../lib/auth-context-v2'
import { supabase } from '../../../lib/supabase'

export type DateSelectionMode = 'single' | 'week' | 'custom'

interface CreatePlanWizardProps {
  isOpen: boolean
  existingPlans: MealPlan[]
  onClose: () => void
  onPlanReady?: (result: { mealPlanId: string; groceryListId?: string | null }) => void
}

const STEP_DEFINITIONS = [
  { title: 'Select dates', description: 'Choose when this plan should run.' },
  { title: 'Plan details', description: 'Name it and fine-tune the structure.' },
  { title: 'Review', description: 'Confirm everything before Chef Nourish begins.' },
]

const SESSION_RULES = [
  'Prioritise seasonal produce',
  'High protein focus',
  'No dairy for this plan',
  'Budget friendly',
  'Kid-friendly meals',
  '15-minute breakfasts',
]

export default function CreatePlanWizard({ isOpen, existingPlans, onClose, onPlanReady }: CreatePlanWizardProps) {
  const { user } = useAuth()
  const blockedRanges = useMemo(() => existingPlans.map(plan => ({ start: plan.startDate, end: plan.endDate, title: plan.title })), [existingPlans])

  const [step, setStep] = useState(1)
  const [selectionMode, setSelectionMode] = useState<DateSelectionMode>('week')
  const [startDate, setStartDate] = useState<string>(() => suggestRange('week', blockedRanges).start)
  const [endDate, setEndDate] = useState<string>(() => suggestRange('week', blockedRanges).end)
  const [planTitle, setPlanTitle] = useState('')
  const [mealsPerDay, setMealsPerDay] = useState(3)
  const [applyProfilePreferences, setApplyProfilePreferences] = useState(true)
  const [sessionOverrides, setSessionOverrides] = useState<string[]>([])
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [customTouched, setCustomTouched] = useState(false)
  const [showGenerationScreen, setShowGenerationScreen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null)
  const [trackingDraftId, setTrackingDraftId] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string>('Chef Nourish is getting started.')
  const [generatedMealPlanId, setGeneratedMealPlanId] = useState<string | null>(null)
  const [generatedGroceryListId, setGeneratedGroceryListId] = useState<string | null>(null)
  const [groceryListStatus, setGroceryListStatus] = useState<'pending' | 'completed' | 'failed' | null>(null)
  const lastAnnouncementRef = useRef<{ planId: string | null; groceryId: string | null }>({ planId: null, groceryId: null })

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setSelectionMode('week')
      const { start, end } = suggestRange('week', blockedRanges)
      setStartDate(start)
      setEndDate(end)
      setPlanTitle('')
      setMealsPerDay(3)
      setApplyProfilePreferences(true)
      setSessionOverrides([])
      setAdditionalNotes('')
      setCustomTouched(false)
      setShowGenerationScreen(false)
      setIsGenerating(false)
      setGenerationError(null)
      setTrackingJobId(null)
      setTrackingDraftId(null)
      setProgressValue(0)
      setStatusMessage('Chef Nourish is getting started.')
      setGeneratedMealPlanId(null)
      setGeneratedGroceryListId(null)
      setGroceryListStatus(null)
      lastAnnouncementRef.current = { planId: null, groceryId: null }
    }
  }, [isOpen, blockedRanges])

  useEffect(() => {
    if (!isOpen) return
    if (selectionMode === 'custom' && customTouched) return
    const { start, end } = suggestRange(selectionMode, blockedRanges)
    setStartDate(start)
    setEndDate(end)
  }, [selectionMode, blockedRanges, customTouched, isOpen])

  const conflicts = findConflicts(startDate, endDate, blockedRanges)
  const rangeValid = !!startDate && !!endDate && !conflicts.length && startDate <= endDate
  const rangeLength = dateDiffInDays(startDate, endDate) + 1

  const handleNext = () => {
    if (step === 1 && !rangeValid) return
    setStep(prev => Math.min(prev + 1, STEP_DEFINITIONS.length))
  }

  const handleBack = () => setStep(prev => Math.max(prev - 1, 1))

  const handleConfirm = async () => {
    if (!user?.id) {
      setGenerationError('User not authenticated')
      return
    }

    setStep(4)
    setShowGenerationScreen(true)
    setIsGenerating(true)
    setGenerationError(null)
    setTrackingJobId(null)
    setTrackingDraftId(null)
    setProgressValue(0)
    setStatusMessage('Chef Nourish is getting started.')
    setGeneratedMealPlanId(null)
    setGeneratedGroceryListId(null)
    setGroceryListStatus(null)
    lastAnnouncementRef.current = { planId: null, groceryId: null }

    try {
      const freeformPrompt = buildFreeformPrompt({
        planTitle: planTitle.trim(),
        applyProfilePreferences,
        sessionOverrides,
        additionalNotes: additionalNotes.trim(),
      })

      const request: MealPlanRequest = {
        user_id: user.id,
        start_date: startDate,
        end_date: endDate,
        meals_per_day: mealsPerDay,
        freeform_prompt: freeformPrompt || 'Surprise me',
        use_user_preferences: applyProfilePreferences,
        session_preferences: buildSessionPreferences(sessionOverrides, additionalNotes),
        auto_generate_grocery_list: true,
        include_pantry_inventory: true,
      }

      const orchestration = await MealPlanService.startMealPlanOrchestration({
        ...request,
        plan_title: planTitle.trim() || `Meal Plan ${startDate} - ${endDate}`,
      })

      if (orchestration.job_id) {
        setTrackingJobId(orchestration.job_id)
      }
      if (orchestration.draft_id) {
        setTrackingDraftId(orchestration.draft_id)
      }
      if (typeof orchestration.progress === 'number') {
        setProgressValue(orchestration.progress)
      } else {
        setProgressValue(5)
      }
      if (orchestration.message) {
        setStatusMessage(orchestration.message)
      } else {
        setStatusMessage('Chef Nourish is analyzing your preferences.')
      }
      if (orchestration.meal_plan_id) {
        setGeneratedMealPlanId(orchestration.meal_plan_id)
      }
    } catch (error) {
      console.error('Error starting meal plan generation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start meal plan generation';
      setGenerationError(errorMessage);
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (!trackingJobId) return

    let cancelled = false

    const parseField = (value: unknown) => {
      if (!value) return {}
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch (parseError) {
          console.warn('Unable to parse async job field', parseError)
          return {}
        }
      }
      return value
    }

    const applyJobRow = (row: any) => {
      if (!row || cancelled) return
      setShowGenerationScreen(true)

      const payload = parseField(row.payload ?? {}) as Record<string, any>
      const result = parseField(row.result ?? {}) as Record<string, any>

      if (typeof payload.progress === 'number') {
        setProgressValue(payload.progress)
      }
      if (typeof payload.status_message === 'string') {
        setStatusMessage(payload.status_message)
      }
      if (typeof payload.draft_id === 'string') {
        setTrackingDraftId(prev => prev ?? payload.draft_id)
      }
      if (typeof payload.grocery_list_status === 'string') {
        setGroceryListStatus(payload.grocery_list_status)
      }

      if (typeof result.mealPlanId === 'string') {
        setGeneratedMealPlanId(result.mealPlanId)
      }
      if (Object.prototype.hasOwnProperty.call(result, 'groceryListId')) {
        setGeneratedGroceryListId(result.groceryListId ?? null)
      }
      if (typeof result.groceryListStatus === 'string') {
        setGroceryListStatus(result.groceryListStatus)
      }

      if (row.status === 'failed') {
        // Extract clean error message to avoid double-wrapping
        let errorMessage = 'Meal plan generation failed';
        if (row.error) {
          try {
            const parsed = JSON.parse(row.error);
            errorMessage = parsed.message || row.error;
          } catch {
            errorMessage = row.error;
          }
        } else if (result.error) {
          try {
            const parsed = JSON.parse(result.error);
            errorMessage = parsed.message || result.error;
          } catch {
            errorMessage = result.error;
          }
        }
        setGenerationError(errorMessage);
        setIsGenerating(false);
      } else if (row.status === 'completed') {
        setIsGenerating(false);
      }
    }

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('async_jobs')
        .select('status, payload, result, error')
        .eq('id', trackingJobId)
        .maybeSingle()

      if (!cancelled && !error && data) {
        applyJobRow(data)
      }
    }

    fetchInitial()

    const channel = supabase
      .channel(`job-status-${trackingJobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'async_jobs', filter: `id=eq.${trackingJobId}` },
        payload => {
          if (payload.new) {
            applyJobRow(payload.new)
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [trackingJobId])

  useEffect(() => {
    if (!trackingDraftId) return

    let cancelled = false

    const applyDraftRow = (row: any) => {
      if (!row || cancelled) return
      if (typeof row.progress_message === 'string') {
        setStatusMessage(row.progress_message)
      }
    }

    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('meal_plan_drafts')
        .select('progress_message')
        .eq('id', trackingDraftId)
        .maybeSingle()

      if (!cancelled && !error && data) {
        applyDraftRow(data)
      }
    }

    fetchInitial()

    const channel = supabase
      .channel(`draft-status-${trackingDraftId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meal_plan_drafts', filter: `id=eq.${trackingDraftId}` },
        payload => {
          if (payload.new) {
            applyDraftRow(payload.new)
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [trackingDraftId])

  useEffect(() => {
    if (!generatedMealPlanId) return

    const currentPlanId = generatedMealPlanId
    const currentGroceryId = generatedGroceryListId ?? null
    const last = lastAnnouncementRef.current

    if (last.planId !== currentPlanId || last.groceryId !== currentGroceryId) {
      lastAnnouncementRef.current = { planId: currentPlanId, groceryId: currentGroceryId }
      onPlanReady?.({ mealPlanId: currentPlanId, groceryListId: currentGroceryId })
    }
  }, [generatedMealPlanId, generatedGroceryListId, onPlanReady])

  if (!isOpen) {
    return null
  }

  return (
    <div className="wizard-backdrop" role="dialog" aria-modal="true">
      <div className="wizard-panel">
        <header className="wizard-header">
          <div>
            <h2>Create plan with AI</h2>
            <p>Chef Nourish will build a plan that respects your preferences and any overrides you set here.</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close wizard">
            <X size={18} />
          </button>
        </header>

        <StepIndicator currentStep={step} totalSteps={STEP_DEFINITIONS.length} steps={STEP_DEFINITIONS} />

        <div className="wizard-body">
          {step === 1 && (
            <DateStep
              selectionMode={selectionMode}
              onSelectionModeChange={mode => {
                setSelectionMode(mode)
                setCustomTouched(mode === 'custom' ? customTouched : false)
              }}
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end, touchedCustom) => {
                setStartDate(start)
                setEndDate(end)
                if (touchedCustom) setCustomTouched(true)
              }}
              blockedRanges={blockedRanges}
              conflicts={conflicts}
              rangeLength={rangeLength}
              rangeValid={rangeValid}
            />
          )}

          {step === 2 && (
            <DetailsStep
              planTitle={planTitle}
              setPlanTitle={setPlanTitle}
              mealsPerDay={mealsPerDay}
              setMealsPerDay={setMealsPerDay}
              applyProfilePreferences={applyProfilePreferences}
              setApplyProfilePreferences={setApplyProfilePreferences}
              sessionOverrides={sessionOverrides}
              setSessionOverrides={setSessionOverrides}
              additionalNotes={additionalNotes}
              setAdditionalNotes={setAdditionalNotes}
            />
          )}

          {step === 3 && (
            <ReviewStep
              selectionMode={selectionMode}
              startDate={startDate}
              endDate={endDate}
              planTitle={planTitle}
              mealsPerDay={mealsPerDay}
              applyProfilePreferences={applyProfilePreferences}
              sessionOverrides={sessionOverrides}
              additionalNotes={additionalNotes}
            />
          )}

          {step === 4 && (
            <div className="generation-stage">
              <GenerationView
                isVisible={showGenerationScreen}
                title="Chef Nourish is cooking up your meal plan!"
                subtitle="Analyzing your preferences and creating the perfect plan"
                estimatedTime="30-45 seconds"
                statusMessage={statusMessage}
                progress={progressValue}
                isBusy={isGenerating || !generatedMealPlanId}
                error={generationError}
                onRetry={() => {
                  setGenerationError(null)
                  handleConfirm()
                }}
              />

              <div className="generation-followup">
                {generatedMealPlanId && (
                  <div className="result-card">
                    <h3>Meal plan ready</h3>
                    <p>
                      {groceryListStatus === 'pending' &&
                        "Chef Nourish is building your grocery list now. We'll notify you when it's ready."}
                      {groceryListStatus === 'completed' && generatedGroceryListId && 'Your grocery list is ready to review.'}
                      {groceryListStatus === 'failed' &&
                        'We could not create a grocery list automatically. You can generate one from the plan page.'}
                      {!groceryListStatus && 'Your plan has been saved and is ready to review.'}
                    </p>

                    <div className="result-actions">
                      <Button
                        variant="solid"
                        leftIcon={<Sparkles size={16} />}
                        onClick={() => {
                          onPlanReady?.({
                            mealPlanId: generatedMealPlanId,
                            groceryListId: generatedGroceryListId ?? null,
                          })
                          onClose()
                        }}
                      >
                        View meal plan
                      </Button>
                    </div>
                  </div>
                )}

                {!generatedMealPlanId && !generationError && (
                  <p className="generation-hint">We will update this view as soon as your plan is ready.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="wizard-footer">
          <div className="footer-left">
            {step > 1 && step < 4 && (
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="footer-right">
            {step < STEP_DEFINITIONS.length && (
              <Button onClick={handleNext} disabled={step === 1 && !rangeValid}>
                Continue
              </Button>
            )}
            {step === STEP_DEFINITIONS.length && (
              <Button variant="solid" leftIcon={<Sparkles size={16} />} onClick={handleConfirm}>
                Generate meal plan
              </Button>
            )}
            {step === 4 && (
              <div className="generation-footer">
                <span className="generation-status">Chef Nourish is working...</span>
              </div>
            )}
          </div>
        </footer>
      </div>

      <style jsx>{`
        .wizard-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(16, 23, 42, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 40;
          padding: var(--space-4);
        }

        .wizard-panel {
          width: min(860px, 100%);
          background: var(--panel);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border-strong);
          box-shadow: 0 24px 64px rgba(15, 23, 42, 0.22);
          display: flex;
          flex-direction: column;
          max-height: 95vh;
        }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: var(--space-8) var(--space-8) var(--space-6);
          gap: var(--space-4);
        }

        .wizard-header h2 {
          margin: 0;
          font-size: var(--text-xl);
        }

        .wizard-header p {
          margin: var(--space-3) 0 0 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.5;
        }

        .close-button {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--space-2);
          border-radius: var(--radius-full);
          transition: background var(--transition-fast);
        }

        .close-button:hover {
          background: var(--panel-2);
        }

        .wizard-body {
          flex: 1;
          overflow-y: auto;
          padding: 0 var(--space-8) var(--space-8);
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }

        .wizard-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-6) var(--space-8);
          border-top: 1px solid var(--border);
          background: var(--panel);
        }

        .footer-right {
          display: flex;
          gap: var(--space-3);
        }

        .generation-stage {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .generation-followup {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          align-items: center;
        }

        .result-card {
          width: 100%;
          max-width: 480px;
          padding: var(--space-5);
          border-radius: var(--radius-xl);
          background: var(--panel);
          border: 1px solid var(--border);
          text-align: left;
        }

        .result-card h3 {
          margin: 0 0 var(--space-2);
          font-size: var(--text-lg);
        }

        .result-card p {
          margin: 0 0 var(--space-4);
          color: var(--text-muted);
        }

        .result-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-start;
        }

        .generation-hint {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .generation-footer {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .generation-status {
          font-size: var(--text-sm);
          color: var(--text-muted);
          font-style: italic;
        }

        @media (max-width: 768px) {
          .wizard-panel {
            height: 100%;
            max-height: none;
            border-radius: 0;
          }

          .wizard-body {
            padding: 0 var(--space-6) var(--space-6);
          }

          .wizard-header {
            padding: var(--space-6) var(--space-6) var(--space-4);
          }
        }
      `}</style>
    </div>
  )
}

interface DateStepProps {
  selectionMode: DateSelectionMode
  onSelectionModeChange: (mode: DateSelectionMode) => void
  startDate: string
  endDate: string
  onChange: (start: string, end: string, touchedCustom?: boolean) => void
  blockedRanges: Array<{ start: string; end: string; title: string }>
  conflicts: Array<{ start: string; end: string; title: string }>
  rangeLength: number
  rangeValid: boolean
}

function DateStep({ selectionMode, onSelectionModeChange, startDate, endDate, onChange, blockedRanges, conflicts, rangeLength, rangeValid }: DateStepProps) {
  return (
    <section className="step-section">
      <header className="step-header">
        <h3>When should this plan run?</h3>
        <p>Pick a single day, the next available week, or create a custom block. Existing plans are automatically respected.</p>
      </header>

      <div className="mode-toggle">
        <ModeButton
          label="Single day"
          description="Perfect for a focused reset day"
          active={selectionMode === 'single'}
          onClick={() => onSelectionModeChange('single')}
        />
        <ModeButton
          label="Full week"
          description="Chef finds the next free Monday-Sunday"
          active={selectionMode === 'week'}
          onClick={() => onSelectionModeChange('week')}
        />
        <ModeButton
          label="Custom"
          description="Pick any sequence of free days"
          active={selectionMode === 'custom'}
          onClick={() => onSelectionModeChange('custom')}
        />
      </div>

      <div className="range-board">
        <div className="range-summary">
          <div className="summary-icon">
            <CalendarRange size={20} />
          </div>
          <div>
            <div className="range-dates">{formatRangeLabel(startDate, endDate)}</div>
            <div className="range-caption">{rangeLength} {rangeLength === 1 ? 'day' : 'days'} selected</div>
          </div>
        </div>

        {selectionMode === 'custom' ? (
          <div className="custom-inputs">
            <label>
              <span>Start date</span>
              <input
                type="date"
                min={todayIso()}
                value={startDate}
                onChange={event => {
                  const nextStart = event.target.value
                  const nextEnd = nextStart > endDate ? nextStart : endDate
                  onChange(nextStart, nextEnd, true)
                }}
              />
            </label>
            <label>
              <span>End date</span>
              <input
                type="date"
                min={startDate || todayIso()}
                value={endDate}
                onChange={event => onChange(startDate, event.target.value, true)}
              />
            </label>
          </div>
        ) : (
          <div className="auto-hint">
            Chef Nourish reserved the earliest available {selectionMode === 'single' ? 'day' : 'week'} for you.
          </div>
        )}

        {!rangeValid && (
          <div className="range-error">
            {conflicts.length > 0 ? (
              <>
                Those dates conflict with {conflicts.map(range => range.title).join(', ')}.
              </>
            ) : (
              'Please make sure the end date is after the start date.'
            )}
          </div>
        )}
      </div>

      {blockedRanges.length > 0 && (
        <div className="blocked-list">
          <h4>Already booked</h4>
          <ul>
            {blockedRanges.map(range => (
              <li key={`${range.start}-${range.end}`}>
                <span>{formatRangeLabel(range.start, range.end)}</span>
                <Badge variant="neutral" size="xs">{range.title}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .step-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .step-header h3 {
          margin: 0;
          font-size: var(--text-lg);
        }

        .step-header p {
          margin: var(--space-2) 0 0 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .mode-toggle {
          display: grid;
          gap: var(--space-3);
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .range-board {
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          background: var(--panel);
        }

        .range-summary {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .summary-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--panel-2);
        }

        .range-dates {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
        }

        .range-caption {
          font-size: var(--text-xs);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .custom-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-3);
        }

        label span {
          display: block;
          font-size: var(--text-xs);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: var(--space-2);
        }

        input[type='date'] {
          width: 100%;
          padding: 10px 12px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--input-bg);
          color: var(--text);
        }

        .auto-hint {
          font-size: var(--text-sm);
          color: var(--text-muted);
          background: var(--panel-2);
          padding: var(--space-3);
          border-radius: var(--radius-lg);
        }

        .range-error {
          color: var(--danger);
          font-size: var(--text-sm);
          background: rgba(248, 113, 113, 0.12);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
        }

        .blocked-list h4 {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--text-xs);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .blocked-list ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: var(--space-2);
        }

        .blocked-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          background: var(--panel-2);
          font-size: var(--text-sm);
        }
      `}</style>
    </section>
  )
}

interface ModeButtonProps {
  label: string
  description: string
  active: boolean
  onClick: () => void
}

function ModeButton({ label, description, active, onClick }: ModeButtonProps) {
  return (
    <button type="button" className={`mode-button ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="mode-label">{label}</span>
      <span className="mode-description">{description}</span>

      <style jsx>{`
        .mode-button {
          padding: var(--space-4);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border);
          background: var(--panel);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-2);
          text-align: left;
          cursor: pointer;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .mode-button:hover {
          border-color: var(--brand-400);
        }

        .mode-button.active {
          border-color: var(--brand-500);
          box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
        }

        .mode-label {
          font-weight: var(--font-semibold);
        }

        .mode-description {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }
      `}</style>
    </button>
  )
}

interface DetailsStepProps {
  planTitle: string
  setPlanTitle: (value: string) => void
  mealsPerDay: number
  setMealsPerDay: (value: number) => void
  applyProfilePreferences: boolean
  setApplyProfilePreferences: (value: boolean) => void
  sessionOverrides: string[]
  setSessionOverrides: (value: string[]) => void
  additionalNotes: string
  setAdditionalNotes: (value: string) => void
}

function DetailsStep({
  planTitle,
  setPlanTitle,
  mealsPerDay,
  setMealsPerDay,
  applyProfilePreferences,
  setApplyProfilePreferences,
  sessionOverrides,
  setSessionOverrides,
  additionalNotes,
  setAdditionalNotes,
}: DetailsStepProps) {
  return (
    <section className="step-section">
      <header className="step-header">
        <h3>Give Chef a few guardrails</h3>
        <p>Name the plan, choose how many meals per day, and add any session-specific overrides.</p>
      </header>

      <div className="field-grid">
        <Input
          label="Plan name (optional)"
          placeholder="Balanced week, Family dinners, High energy..."
          value={planTitle}
          onChange={event => setPlanTitle(event.target.value)}
        />

        <div className="meals-field">
          <label>Meals per day</label>
          <div className="meals-slider">
            <input
              type="range"
              min={2}
              max={6}
              step={1}
              value={mealsPerDay}
              onChange={event => setMealsPerDay(Number(event.target.value))}
            />
            <div className="slider-labels">
              {[2, 3, 4, 5, 6].map(value => (
                <button
                  key={value}
                  type="button"
                  className={`slider-pill ${value === mealsPerDay ? 'active' : ''}`}
                  onClick={() => setMealsPerDay(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="slider-hint">Chef can schedule up to six slots a day (breakfast through dessert).</p>
          </div>
        </div>
      </div>

      <div className="preferences-card">
        <div className="preferences-header">
          <div>
            <h4>Profile preferences</h4>
            <p>Chef will honour your saved dietary preferences. Toggle off to override everything for this plan.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={applyProfilePreferences}
              onChange={event => setApplyProfilePreferences(event.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>
      </div>

      <div className="overrides-card">
        <h4>Session overrides</h4>
        <p>Select quick rules specific to this plan.</p>
        <div className="override-grid">
          {SESSION_RULES.map(rule => {
            const active = sessionOverrides.includes(rule)
            return (
              <button
                key={rule}
                type="button"
                className={`override-chip ${active ? 'active' : ''}`}
                onClick={() => {
                  setSessionOverrides(active ? sessionOverrides.filter(item => item !== rule) : [...sessionOverrides, rule])
                }}
              >
                {rule}
              </button>
            )
          })}
        </div>
      </div>

      <div className="notes-card">
        <label>
          <span>Additional notes for Chef</span>
          <textarea
            placeholder="Example: Keep lunches under 500 calories, include one seafood dinner."
            value={additionalNotes}
            onChange={event => setAdditionalNotes(event.target.value)}
            rows={4}
          />
        </label>
      </div>

      <style jsx>{`
        .step-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .field-grid {
          display: grid;
          gap: var(--space-4);
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }

        .meals-field label {
          display: block;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          margin-bottom: var(--space-3);
        }

        .meals-slider {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        input[type='range'] {
          width: 100%;
        }

        .slider-labels {
          display: flex;
          gap: var(--space-2);
        }

        .slider-pill {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--panel-2);
          font-size: var(--text-sm);
          cursor: pointer;
        }

        .slider-pill.active {
          background: var(--brand-500);
          border-color: var(--brand-500);
          color: white;
        }

        .slider-hint {
          margin: 0;
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .preferences-card,
        .overrides-card,
        .notes-card {
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: var(--space-4);
          background: var(--panel);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .preferences-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
        }

        .preferences-header h4,
        .overrides-card h4 {
          margin: 0;
          font-size: var(--text-base);
        }

        .preferences-header p,
        .overrides-card p {
          margin: var(--space-2) 0 0 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .switch {
          position: relative;
          width: 46px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: var(--panel-2);
          border-radius: 999px;
          transition: background-color var(--transition-fast);
        }

        .slider::before {
          position: absolute;
          content: '';
          height: 18px;
          width: 18px;
          left: 4px;
          bottom: 3px;
          background-color: white;
          border-radius: 999px;
          transition: transform var(--transition-fast);
          box-shadow: var(--shadow-sm);
        }

        .switch input:checked + .slider {
          background-color: var(--brand-500);
        }

        .switch input:checked + .slider::before {
          transform: translateX(20px);
        }

        .override-grid {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .override-chip {
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          padding: 8px 14px;
          background: var(--panel-2);
          font-size: var(--text-xs);
          cursor: pointer;
        }

        .override-chip.active {
          background: rgba(59, 130, 246, 0.15);
          border-color: var(--brand-400);
          color: var(--brand-600);
        }

        textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          background: var(--input-bg);
          resize: vertical;
          min-height: 110px;
        }
      `}</style>
    </section>
  )
}

interface ReviewStepProps {
  selectionMode: DateSelectionMode
  startDate: string
  endDate: string
  planTitle: string
  mealsPerDay: number
  applyProfilePreferences: boolean
  sessionOverrides: string[]
  additionalNotes: string
}

function ReviewStep({ selectionMode, startDate, endDate, planTitle, mealsPerDay, applyProfilePreferences, sessionOverrides, additionalNotes }: ReviewStepProps) {
  return (
    <section className="step-section">
      <header className="step-header">
        <h3>Ready for Chef to cook something up?</h3>
        <p>Confirm the details below. You can tweak the plan after it generates.</p>
      </header>

      <div className="review-grid">
        <div className="review-card">
          <h4>Date range</h4>
          <p>{formatRangeLabel(startDate, endDate)}</p>
          <span className="review-chip">{modeLabel(selectionMode)}</span>
        </div>

        <div className="review-card">
          <h4>Name</h4>
          <p>{planTitle ? planTitle : 'Chef will name it for you'}</p>
        </div>

        <div className="review-card">
          <h4>Meals per day</h4>
          <p>{mealsPerDay}</p>
          <span className="review-caption">Up to six total slots per day</span>
        </div>

        <div className="review-card">
          <h4>Profile preferences</h4>
          <p>{applyProfilePreferences ? 'Use my saved preferences' : 'Override preferences for this plan'}</p>
        </div>
      </div>

      <div className="review-section">
        <h4>Session overrides</h4>
        {sessionOverrides.length === 0 ? (
          <p>No overrides selected. Chef will rely on your saved profile.</p>
        ) : (
          <ul>
            {sessionOverrides.map(rule => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="review-section">
        <h4>Special notes</h4>
        <p>{additionalNotes ? additionalNotes : 'None provided.'}</p>
      </div>

      <style jsx>{`
        .review-grid {
          display: grid;
          gap: var(--space-3);
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .review-card {
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: var(--space-4);
          background: var(--panel);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .review-card h4 {
          margin: 0;
          font-size: var(--text-sm);
        }

        .review-card p {
          margin: 0;
          font-size: var(--text-sm);
          color: var(--text);
        }

        .review-chip {
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: var(--panel-2);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .review-caption {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .review-section {
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: var(--space-4);
          background: var(--panel);
        }

        .review-section h4 {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--text-sm);
        }

        .review-section ul {
          margin: 0;
          padding-left: var(--space-4);
          display: grid;
          gap: var(--space-2);
        }

        .review-section p {
          margin: 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }
      `}</style>
    </section>
  )
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function suggestRange(mode: DateSelectionMode, ranges: Array<{ start: string; end: string }>) {
  if (mode === 'custom') {
    const next = findNextAvailableRange('week', ranges)
    return next
  }
  return findNextAvailableRange(mode, ranges)
}

function findNextAvailableRange(mode: DateSelectionMode, ranges: Array<{ start: string; end: string }>) {
  const startFrom = todayIso()
  const maxLookAhead = 120
  const step = 1
  let candidate = startFrom

  for (let i = 0; i < maxLookAhead; i++) {
    const start = addDays(startFrom, i * step)
    const end = mode === 'single' ? start : addDays(start, mode === 'week' ? 6 : 0)
    const overlaps = ranges.some(range => rangesOverlap(start, end, range.start, range.end))
    if (!overlaps && start >= startFrom) {
      return { start, end }
    }
    candidate = addDays(candidate, step)
  }

  return { start: candidate, end: candidate }
}

function findConflicts(start: string, end: string, ranges: Array<{ start: string; end: string; title: string }>) {
  if (!start || !end) return []
  if (start > end) return []
  return ranges.filter(range => rangesOverlap(start, end, range.start, range.end))
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd)
}

function addDays(date: string, amount: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d.toISOString().split('T')[0]
}

function dateDiffInDays(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
}

function formatRangeLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${formatter.format(new Date(start))} — ${formatter.format(new Date(end))}`
}

function modeLabel(mode: DateSelectionMode) {
  if (mode === 'single') return 'Single day'
  if (mode === 'week') return 'Full week'
  return 'Custom range'
}

function buildFreeformPrompt({
  planTitle,
  applyProfilePreferences,
  sessionOverrides,
  additionalNotes
}: {
  planTitle: string
  applyProfilePreferences: boolean
  sessionOverrides: string[]
  additionalNotes: string
}): string {
  const parts: string[] = []
  
  if (planTitle) {
    parts.push(`Plan title: ${planTitle}`)
  }
  
  if (!applyProfilePreferences) {
    parts.push('Override all profile preferences for this plan')
  }
  
  if (sessionOverrides.length > 0) {
    parts.push(`Session overrides: ${sessionOverrides.join(', ')}`)
  }
  
  if (additionalNotes) {
    parts.push(`Additional notes: ${additionalNotes}`)
  }
  
  return parts.join('. ')
}

function buildSessionPreferences(sessionOverrides: string[], additionalNotes: string) {
  const preferences: any = {}
  
  // Map session overrides to preference categories
  if (sessionOverrides.includes('Prioritise seasonal produce')) {
    preferences.cuisines = ['seasonal']
  }
  
  if (sessionOverrides.includes('High protein focus')) {
    preferences.dietary_patterns = ['high-protein']
  }
  
  if (sessionOverrides.includes('No dairy for this plan')) {
    preferences.excluded_ingredients = ['dairy']
  }
  
  if (sessionOverrides.includes('Budget friendly')) {
    preferences.budget_range = 50 // Lower budget
  }
  
  if (sessionOverrides.includes('Kid-friendly meals')) {
    preferences.convenience_level = 'family-friendly'
  }
  
  if (sessionOverrides.includes('15-minute breakfasts')) {
    preferences.cooking_time = 'quick'
  }
  
  if (additionalNotes) {
    preferences.additional_notes = additionalNotes
  }
  
  return Object.keys(preferences).length > 0 ? preferences : undefined
}
