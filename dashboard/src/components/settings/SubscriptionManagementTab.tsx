import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { StripeService, PlanCode, Interval } from '../../lib/stripe-service'
import PlanPicker from '../billing/PlanPicker'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card'
import Button from '../ui/Button'
import { Check, Crown, Users, Zap, AlertCircle, ExternalLink } from 'lucide-react'

interface SubscriptionManagementTabProps {
  userId?: string
}

interface SubscriptionInfo {
  tier: string
  status: string
  features: any
  renewalDate?: string
  householdId?: string
}

interface UsageStats {
  aiGenerationsThisPeriod: number
  recipeCount: number
  memberCount: number
  lastAiGeneration?: string
}

const SubscriptionManagementTab: React.FC<SubscriptionManagementTabProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true)
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [interval, setInterval] = useState<Interval>('month')
  const [familySeats, setFamilySeats] = useState<number>(4)

  useEffect(() => {
    if (userId) {
      loadSubscriptionInfo()
    }
  }, [userId])

  const loadSubscriptionInfo = async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)

      // Get user's household
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (!membership?.household_id) {
        setError('Unable to load subscription information')
        return
      }

      // Get subscription info
      const info = await StripeService.getSubscriptionInfo(membership.household_id)
      setSubscriptionInfo({ ...info, householdId: membership.household_id })

      // Get usage stats
      const stats = await StripeService.getUsageStats(membership.household_id)
      setUsageStats(stats)
    } catch (err) {
      console.error('Error loading subscription:', err)
      setError('Failed to load subscription information')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (plan: PlanCode) => {
    if (!userId || !subscriptionInfo?.householdId) return

    try {
      setLoading(true)
      const result = await StripeService.createCheckoutSession({
        userId,
        householdId: subscriptionInfo.householdId,
        planCode: plan,
        interval,
        seats: plan === 'family_table' ? familySeats : undefined,
        successUrl: `${window.location.origin}/settings?upgrade=success`,
        cancelUrl: `${window.location.origin}/settings?upgrade=cancelled`
      })

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        alert(result.error || 'Failed to start checkout')
      }
    } catch (err) {
      console.error('Error starting checkout:', err)
      alert('Failed to start checkout process')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    if (!userId || !subscriptionInfo?.householdId) return

    try {
      setLoading(true)
      const result = await StripeService.createPortalSession({
        userId,
        householdId: subscriptionInfo.householdId,
        returnUrl: `${window.location.origin}/settings`
      })

      if (result.success && result.portalUrl) {
        window.location.href = result.portalUrl
      } else {
        alert(result.error || 'Failed to open billing portal')
      }
    } catch (err) {
      console.error('Error opening portal:', err)
      alert('Failed to open billing portal')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !subscriptionInfo) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">Loading subscription information...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const tier = subscriptionInfo?.tier || 'free'
  const features = subscriptionInfo?.features || {}

  const getTierIcon = (tierName: string) => {
    switch (tierName) {
      case 'free':
        return <Zap className="w-6 h-6" />
      case 'individual':
        return <Crown className="w-6 h-6" />
      case 'family':
        return <Users className="w-6 h-6" />
      default:
        return <Zap className="w-6 h-6" />
    }
  }

  const getTierName = (tierName: string) => {
    switch (tierName) {
      case 'free':
        return 'Free Plan'
      case 'try_taste':
        return 'Try & Taste'
      case 'plan_save':
        return 'Plan & Save'
      case 'automate_optimize':
        return 'Automate & Optimize'
      case 'family_table':
        return 'Family Table'
      default:
        return 'Unknown Plan'
    }
  }

  const daysUntilNextGeneration = usageStats?.lastAiGeneration
    ? Math.max(0, 60 - Math.floor((Date.now() - new Date(usageStats.lastAiGeneration).getTime()) / (1000 * 60 * 60 * 24)))
    : 60

  return (
    <div className="subscription-section space-y-6">

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription and usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                {getTierIcon(tier)}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{getTierName(tier)}</h3>
                <p className="text-muted-foreground">
                  {tier === 'free' ? 'Limited features' : `Status: ${subscriptionInfo?.status || 'active'}`}
                  {subscriptionInfo?.renewalDate ? ` • Renews ${new Date(subscriptionInfo.renewalDate).toLocaleDateString()}` : ''}
                </p>
              </div>
            </div>
            {tier !== 'free' && (
              <Button variant="outline" onClick={handleManageBilling} disabled={loading}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            )}
          </div>

          {/* Usage Stats */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Household Members</div>
              <div className="text-2xl font-bold mt-1">
                {usageStats?.memberCount || 0} / {features.max_household_members || 1}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Recipes Created</div>
              <div className="text-2xl font-bold mt-1">
                {usageStats?.recipeCount || 0}
                {tier === 'free' && ` / ${features.recipe_access_limit || 21}`}
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">AI Generations</div>
              <div className="text-2xl font-bold mt-1">
                {tier === 'free' ? (
                  <span className="text-sm">
                    {daysUntilNextGeneration > 0 ? `Available in ${daysUntilNextGeneration}d` : 'Available now'}
                  </span>
                ) : (
                  'Unlimited'
                )}
              </div>
            </div>
          </div>

          {/* Current Features */}
          <div className="mt-6">
            <h4 className="font-semibold mb-3">Your Features</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                {features.grocery_lists ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                )}
                <span className={!features.grocery_lists ? 'text-muted-foreground line-through' : ''}>
                  Grocery Lists
                </span>
              </div>
              <div className="flex items-center gap-2">
                {features.instacart_integration ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                )}
                <span className={!features.instacart_integration ? 'text-muted-foreground line-through' : ''}>
                  Instacart Integration
                </span>
              </div>
              <div className="flex items-center gap-2">
                {features.ai_chef ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                )}
                <span className={!features.ai_chef ? 'text-muted-foreground line-through' : ''}>
                  AI Chef Assistant
                </span>
              </div>
              <div className="flex items-center gap-2">
                {features.community_access ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                )}
                <span className={!features.community_access ? 'text-muted-foreground line-through' : ''}>
                  Community Access
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards (single layout, no duplicate header) */}
      {subscriptionInfo?.householdId && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <PlanPicker userId={userId!} householdId={subscriptionInfo.householdId} />
        </div>
      )}

      {/* Paid Plan Info */}
      {tier !== 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>Manage your subscription and payment methods</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              To manage your subscription, update payment methods, or view billing history, 
              click the button below to access the billing portal.
            </p>
            <Button onClick={handleManageBilling} disabled={loading}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Billing Portal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SubscriptionManagementTab
