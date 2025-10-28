import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { MealPlan, DaySchedule } from './mock-data'
import MealPlanService from '../../lib/meal-plan-service'
import { supabase } from '../../lib/supabase'
import CreatePlanWizard from './components/CreatePlanWizard'
import ManualPlanModal, { ManualPlanDraft } from './components/ManualPlanModal'
import ManualPlanEditScreen from './components/ManualPlanEditScreen'
import MealPlansDashboard from './components/MealPlansDashboard'
import MealPlanDetailView from './components/MealPlanDetailView'
import PlanPicker from '../../components/billing/PlanPicker'

export default function MealPlansPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plans, setPlans] = useState<MealPlan[]>([])
  const [subscriptionOk, setSubscriptionOk] = useState<boolean>(true)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const loadPlans = useCallback(async (uid: string) => {
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', uid)
      .eq('status', 'active')
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    const hid = membership?.household_id ?? null
    let activeSubscription = false

    if (hid) {
      const { data: sub, error: subError } = await supabase
        .from('household_subscriptions')
        .select('status')
        .eq('household_id', hid)
        .maybeSingle()

      if (subError) {
        throw subError
      }

      activeSubscription = sub?.status === 'active' || sub?.status === 'trialing'
    }

    const dbPlans = await MealPlanService.getMealPlans(uid, {
      householdId: hid ?? undefined,
    })

    return {
      hid,
      active: activeSubscription,
      mappedPlans: mapDbPlansToUi(dbPlans),
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return
        if (!user) {
          setPlans([])
          setError('Please sign in to view your meal plans.')
          return
        }
        setUserId(user.id)

        const { hid, active, mappedPlans } = await loadPlans(user.id)
        if (!mounted) return

        setHouseholdId(hid)
        setSubscriptionOk(active)
        setPlans(mappedPlans)
      } catch (e: any) {
        console.error('Failed to load meal plans', e)
        if (mounted) setError(e?.message || 'Failed to load meal plans')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [loadPlans])

  const refreshPlans = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const { hid, active, mappedPlans } = await loadPlans(userId)
      setHouseholdId(hid)
      setSubscriptionOk(active)
      setPlans(mappedPlans)
    } catch (e: any) {
      console.error('Failed to refresh meal plans', e)
      setError(e?.message || 'Failed to refresh meal plans')
    } finally {
      setLoading(false)
    }
  }, [loadPlans, userId])

  const currentPlan = useMemo(() => plans.find(p => p.status === 'current') ?? null, [plans])
  const upcomingPlans = useMemo(() => plans.filter(p => p.status === 'upcoming'), [plans])
  const pastPlans = useMemo(() => plans.filter(p => p.status === 'past'), [plans])

  // Navigation state
  const [currentView, setCurrentView] = useState<'dashboard' | 'plan-detail' | 'manual-edit'>('dashboard')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  
  // Modal states
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [currentManualDraft, setCurrentManualDraft] = useState<ManualPlanDraft | null>(null)
  
  // Plan data states
  const [planDrafts, setPlanDrafts] = useState<Record<string, DaySchedule[]>>({})
  const [scheduleDraft, setScheduleDraft] = useState<DaySchedule[]>([])
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [grocerySuggestion, setGrocerySuggestion] = useState<string[] | null>(null)

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null
    return plans.find(plan => plan.id === selectedPlanId) ?? null
  }, [selectedPlanId, plans])

  // Navigation handlers
  const handleViewPlan = (planId: string) => {
    setSelectedPlanId(planId)
    setCurrentView('plan-detail')
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
    setSelectedPlanId(null)
  }

  const handleManualPlanCreate = (draft: ManualPlanDraft) => {
    setCurrentManualDraft(draft)
    setCurrentView('manual-edit')
    setShowManualModal(false)
  }

  const handleManualPlanBack = () => {
    setCurrentManualDraft(null)
    setCurrentView('dashboard')
  }

  const handleManualPlanSave = (planData: any) => {
    // TODO: Implement actual save logic
    console.log('Saving manual plan:', planData)
    setCurrentManualDraft(null)
    setCurrentView('dashboard')
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    setCurrentView('plan-detail')
  }

  const handlePlanReady = useCallback(async ({ mealPlanId }: { mealPlanId: string; groceryListId?: string | null }) => {
    await refreshPlans()
    setShowCreateWizard(false)
    if (mealPlanId) {
      setSelectedPlanId(mealPlanId)
      setCurrentView('plan-detail')
    } else {
      setCurrentView('dashboard')
    }
    setSaveSuccessMessage('Meal plan created successfully.')
  }, [refreshPlans])

  useEffect(() => {
    if (selectedPlan) {
      const base = planDrafts[selectedPlan.id] ?? selectedPlan.schedule
      setScheduleDraft(cloneSchedule(base))
    } else {
      setScheduleDraft([])
    }
  }, [selectedPlan, planDrafts])

  const baseSchedule = selectedPlan ? (planDrafts[selectedPlan.id] ?? selectedPlan.schedule) : []
  const hasChanges = selectedPlan ? !schedulesEqual(scheduleDraft, baseSchedule) : false

  const handleResetSchedule = () => {
    if (!selectedPlan) return
    setScheduleDraft(cloneSchedule(baseSchedule))
  }

  const handleSaveSchedule = () => {
    if (!selectedPlan || !hasChanges) return
    setSavePromptOpen(true)
  }

  const handleCommitSave = (generateList: boolean) => {
    if (!selectedPlan) return
    const cloned = cloneSchedule(scheduleDraft)
    setPlanDrafts(prev => ({ ...prev, [selectedPlan.id]: cloned }))
    setSavePromptOpen(false)
    if (generateList) {
      setGrocerySuggestion(generateMockGroceryList(cloned))
      setSaveSuccessMessage('Plan saved. Chef Nourish drafted a grocery list for you.')
    } else {
      setGrocerySuggestion(null)
      setSaveSuccessMessage('Plan saved without a grocery list.')
    }
  }

  const handleCancelSavePrompt = () => setSavePromptOpen(false)

  // Calculate total scheduled meals for dashboard
  const totalScheduledMeals = scheduleDraft.reduce((acc, day) => acc + day.meals.length, 0)

  return (
    <div className="meal-plans-page">
      {loading ? (
        <div style={{ padding: 16 }}>Loading meal plans…</div>
      ) : error ? (
        <div style={{ padding: 16, color: 'var(--color-danger-600)' }}>{error}</div>
      ) : !subscriptionOk ? (
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Select a plan to continue</h3>
          {householdId && userId && (
            <PlanPicker userId={userId} householdId={householdId} />
          )}
        </div>
      ) : currentView === 'dashboard' ? (
        <MealPlansDashboard
          currentPlan={currentPlan}
          upcomingPlans={upcomingPlans}
          pastPlans={pastPlans}
          totalScheduledMeals={totalScheduledMeals}
          onCreateWithAI={() => setShowCreateWizard(true)}
          onCreateManually={() => setShowManualModal(true)}
          onSelectPlan={handleSelectPlan}
          onViewPlan={handleViewPlan}
        />
      ) : currentView === 'plan-detail' && selectedPlan ? (
        <MealPlanDetailView
          plan={selectedPlan}
          schedule={scheduleDraft}
          onScheduleChange={setScheduleDraft}
          onSave={handleSaveSchedule}
          onReset={handleResetSchedule}
          hasChanges={hasChanges}
          onBack={handleBackToDashboard}
          onEditPlan={() => {
            // TODO: Implement edit plan functionality
            console.log('Edit plan:', selectedPlan.id)
          }}
          onDeletePlan={() => {
            // TODO: Implement delete plan functionality
            console.log('Delete plan:', selectedPlan.id)
          }}
          onSharePlan={() => {
            // TODO: Implement share plan functionality
            console.log('Share plan:', selectedPlan.id)
          }}
          onAddMeal={(date, mealType) => {
            // TODO: Implement add meal functionality
            console.log('Add meal:', date, mealType)
          }}
          onGenerateGroceryList={() => {
            // TODO: Implement generate grocery list functionality
            console.log('Generate grocery list for plan:', selectedPlan.id)
          }}
        />
      ) : currentView === 'manual-edit' && currentManualDraft ? (
        <ManualPlanEditScreen
          draft={currentManualDraft}
          onBack={handleManualPlanBack}
          onSave={handleManualPlanSave}
        />
      ) : null}

      <CreatePlanWizard
        isOpen={showCreateWizard}
        existingPlans={plans}
        onClose={() => setShowCreateWizard(false)}
        onPlanReady={handlePlanReady}
      />

      <ManualPlanModal
        isOpen={showManualModal}
        existingPlans={plans}
        onClose={() => setShowManualModal(false)}
        onCreate={handleManualPlanCreate}
      />

      <SavePrompt
        isOpen={savePromptOpen}
        onClose={handleCancelSavePrompt}
        onConfirm={handleCommitSave}
      />

      <style jsx>{`
        .meal-plans-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          min-height: 100vh;
        }
      `}</style>
    </div>
  )
}

// Utility functions
function mapDbPlansToUi(dbPlans: any[]): MealPlan[] {
  const today = new Date().toISOString().split('T')[0]
  return (dbPlans || []).map((p: any) => {
    const start = String(p.start_date)
    const end = String(p.end_date)
    const status: MealPlan['status'] = today < start ? 'upcoming' : (today > end ? 'past' : 'current')

    const grouped: Record<string, any[]> = {}
    ;(p.meal_plan_items || []).forEach((it: any) => {
      const d = String(it.date)
      if (!grouped[d]) grouped[d] = []
      grouped[d].push(it)
    })

    const schedule: DaySchedule[] = Object.keys(grouped)
      .sort()
      .map(date => ({
        date,
        meals: grouped[date]
          .sort((a, b) => a.meal_type.localeCompare(b.meal_type))
          .map((it: any, idx: number) => ({
            id: it.id || `${date}-${it.meal_type}-${idx}`,
            mealType: it.meal_type,
            recipeId: it.recipe_id || undefined,
            recipeTitle: it.recipes?.title || it.notes || 'Meal',
            notes: it.notes || undefined,
          }))
      }))

    const mealsPerDay = schedule.length > 0 ? Math.max(...schedule.map(d => d.meals.length)) : 0

    const createdBy: MealPlan['createdBy'] = (p.generated_by === 'ai' ? 'ai' : 'manual')

    return {
      id: p.id,
      title: p.title,
      status,
      createdBy,
      createdAt: p.created_at,
      startDate: start,
      endDate: end,
      mealsPerDay,
      schedule,
      tags: [],
      summary: p.meta?.notes || undefined,
      metrics: undefined,
    }
  })
}

function cloneSchedule(schedule: DaySchedule[]): DaySchedule[] {
  return schedule.map(day => ({
    ...day,
    meals: day.meals.map(meal => ({ ...meal })),
  }))
}

function schedulesEqual(a: DaySchedule[], b: DaySchedule[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].date !== b[i].date || a[i].meals.length !== b[i].meals.length) return false
    for (let j = 0; j < a[i].meals.length; j++) {
      if (a[i].meals[j].name !== b[i].meals[j].name) return false
    }
  }
  return true
}

function generateMockGroceryList(schedule: DaySchedule[]): string[] {
  const items = new Set<string>()
  schedule.forEach(day => {
    day.meals.forEach(meal => {
      if (meal.name in mockGroceryItems) {
        mockGroceryItems[meal.name].forEach(item => items.add(item))
      }
    })
  })
  return Array.from(items)
}

const mockGroceryItems: Record<string, string[]> = {
  'Overnight oats': ['Rolled oats', 'Chia seeds', 'Almond milk', 'Honey'],
  'Greek yogurt bowl': ['Greek yogurt', 'Berries', 'Granola', 'Honey'],
  'Avocado toast': ['Bread', 'Avocado', 'Lemon', 'Salt', 'Pepper'],
  'Smoothie bowl': ['Frozen berries', 'Banana', 'Spinach', 'Almond milk'],
  'Quinoa salad': ['Quinoa', 'Cherry tomatoes', 'Cucumber', 'Feta cheese'],
  'Grilled chicken': ['Chicken breast', 'Olive oil', 'Herbs', 'Lemon'],
  'Chef salad': ['Mixed greens', 'Cherry tomatoes', 'Vinaigrette'],
  'Baked salmon': ['Salmon fillets', 'Dill', 'Lemon'],
}

// Save Prompt Component
interface SavePromptProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (generateList: boolean) => void
}

function SavePrompt({ isOpen, onClose, onConfirm }: SavePromptProps) {
  if (!isOpen) return null
  
  return (
    <div className="prompt-backdrop" role="dialog" aria-modal="true">
      <div className="prompt-panel">
        <h3>Generate a grocery list?</h3>
        <p>Chef Nourish can draft a grocery list for this plan. Would you like to add it now?</p>
        <div className="prompt-actions">
          <button onClick={() => onConfirm(false)}>Save without list</button>
          <button onClick={() => onConfirm(true)}>Save with grocery list</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>

      <style jsx>{`
        .prompt-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 40;
          padding: var(--space-4);
        }

        .prompt-panel {
          background: var(--surface);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border-strong);
          padding: var(--space-6);
          max-width: 420px;
          width: 100%;
        }

        .prompt-panel h3 {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .prompt-panel p {
          margin: 0 0 var(--space-4) 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .prompt-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
        }

        .prompt-actions button {
          padding: var(--space-2) var(--space-4);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
          font-size: var(--text-sm);
          transition: all var(--transition-fast);
        }

        .prompt-actions button:hover {
          background: var(--panel-2);
        }

        .prompt-actions button:last-child {
          background: var(--brand-500);
          color: white;
          border-color: var(--brand-500);
        }

        @media (max-width: 768px) {
          .prompt-actions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}
