import React, { useEffect, useState } from 'react'
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2'
import { supabase } from '../../lib/supabase'
import PlanPicker from '../../components/billing/PlanPicker'
import LoadingScreen from '../../components/ui/LoadingScreen'

export default function OnboardingPlansPage() {
  const { user, loading } = useAuth()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [fetching, setFetching] = useState<boolean>(true)

  useEffect(() => {
    if (!user) { setFetching(false); return }
    ;(async () => {
      try {
        // Try to find active household membership
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()
        if (membership?.household_id) {
          setHouseholdId(membership.household_id)
        } else {
          // Fallback to profiles.child as household id (single-user household)
          const { data: profile } = await supabase
            .from('profiles')
            .select('child')
            .eq('id', user.id)
            .maybeSingle()
          setHouseholdId(profile?.child || user.id)
        }
      } finally {
        setFetching(false)
      }
    })()
  }, [user])

  if (loading || fetching) {
    return <LoadingScreen title="Setting up" subtitle="Preparing plans..." />
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        Please sign in to select a plan.
      </div>
    )
  }

  if (!householdId) {
    return (
      <div style={{ padding: 24 }}>
        Could not determine your household. Please try again.
      </div>
    )
  }

  return (
    <div className="onboarding-plans">
      <PlanPicker userId={user.id} householdId={householdId} />
    </div>
  )
}

