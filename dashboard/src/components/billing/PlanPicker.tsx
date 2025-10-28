import React, { useMemo, useState } from 'react'
import Button from '../ui/Button'
import { Check } from 'lucide-react'
import { StripeService, PlanCode, Interval } from '../../lib/stripe-service'

interface PlanPickerProps {
  userId: string
  householdId: string
  hideHeader?: boolean
}

const prices: Record<PlanCode, { month: string; year?: string; label: string; featured?: boolean }> = {
  try_taste: { month: '$4.99', year: '$39.99', label: 'Try & Taste' },
  plan_save: { month: '$11.99', year: '$95.99', label: 'Plan & Save', featured: true },
  automate_optimize: { month: '$14.99', year: '$119.99', label: 'Automate & Optimize' },
  family_table: { month: '$20.00', year: '$199.99', label: 'Family Table' }
}

export default function PlanPicker({ userId, householdId, hideHeader = false }: PlanPickerProps) {
  const [interval, setInterval] = useState<Interval>('month')
  const [loadingPlan, setLoadingPlan] = useState<PlanCode | null>(null)
  const [familySeats, setFamilySeats] = useState<number>(4)

  const cards = useMemo(() => ([
    {
      code: 'try_taste' as PlanCode,
      header: 'Try & Taste',
      price: interval === 'year' ? prices.try_taste.year : prices.try_taste.month,
      originalYear: (() => {
        if (interval !== 'year') return undefined
        const monthly = 4.99
        return (monthly * 12).toFixed(2)
      })(),
      bullets: [
        '1 AI weekly meal plan per month',
        '1 AI grocery list per month',
        'Manual: unlimited edits & manual lists',
        'Instacart cart export (AI or manual)',
        'Community: read-only',
        'Chat interface: disabled'
      ]
    },
    {
      code: 'plan_save' as PlanCode,
      header: 'Plan & Save',
      badge: 'Most Popular',
      price: interval === 'year' ? prices.plan_save.year : prices.plan_save.month,
      originalYear: (() => {
        if (interval !== 'year') return undefined
        const monthly = 11.99
        return (monthly * 12).toFixed(2)
      })(),
      bullets: [
        '4 weekly plans per month',
        'AI recipe suggestions, daily nutrition summary',
        'Smart list (dedupe & substitutions)',
        'Community: read & post',
        'No event planning'
      ]
    },
    {
      code: 'automate_optimize' as PlanCode,
      header: 'Automate & Optimize',
      price: interval === 'year' ? prices.automate_optimize.year : prices.automate_optimize.month,
      originalYear: (() => {
        if (interval !== 'year') return undefined
        const monthly = 14.99
        return (monthly * 12).toFixed(2)
      })(),
      bullets: [
        'Unlimited plans, pantry tracking & low‑stock alerts',
        'Takeout‑day automation, macro targets',
        'Full chat assistant',
        'Event planning'
      ]
    },
    {
      code: 'family_table' as PlanCode,
      header: 'Family Table',
      badge: 'Family',
      price: (() => {
        if (interval === 'year' && prices.family_table.year) {
          const extras = Math.max(0, familySeats - 4)
          const total = 199.99 + extras * 19.99
          return `$${total.toFixed(2)}`
        }
        const extras = Math.max(0, familySeats - 4)
        const total = 20 + extras * 1
        return `$${total.toFixed(2)}`
      })(),
      sub: interval === 'year' ? '+$19.99/yr each additional member' : '+$1/mo each additional member',
      originalYear: (() => {
        if (interval !== 'year') return undefined
        const extras = Math.max(0, familySeats - 4)
        const monthlyTotal = (20 + extras * 1) * 12
        return monthlyTotal.toFixed(2)
      })(),
      custom: true,
      bullets: [
        'All Premium features shared',
        'Shared pantry & multi‑profile nutrition',
        'Role‑based permissions (Parent/Teen)'
      ]
    }
  ]), [interval, familySeats])

  const startCheckout = async (plan: PlanCode) => {
    try {
      setLoadingPlan(plan)
      const res = await StripeService.createCheckoutSession({
        userId,
        householdId,
        planCode: plan,
        interval,
        seats: plan === 'family_table' ? familySeats : undefined,
        successUrl: `${window.location.origin}/settings?upgrade=success`,
        cancelUrl: `${window.location.origin}/onboarding?upgrade=cancelled`
      })
      if (res.success && res.checkoutUrl) {
        window.location.href = res.checkoutUrl
      } else {
        alert(res.error || 'Failed to start checkout')
      }
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="plan-picker">
      {!hideHeader && (
        <div className="header">
          <h1>Pick your meal plan</h1>
          <p>7‑day free trial. Cancel anytime. USD pricing.</p>
          <div className="interval">
            <span className={interval === 'month' ? 'active' : ''}>Monthly</span>
            <label className="switch">
              <input type="checkbox" checked={interval === 'year'} onChange={(e) => setInterval(e.target.checked ? 'year' : 'month')} />
              <span className="slider" />
            </label>
            <span className={interval === 'year' ? 'active' : ''}>Yearly</span>
          </div>
        </div>
      )}

      <div className="grid">
        {cards.map((c) => (
          <div key={c.code} className={`card ${c.badge ? 'featured' : ''}`}>
            {c.badge && <div className="badge">{c.badge}</div>}
            <h3>{c.header}</h3>
            <div className="price">
              {c.price}<span>/{c.code === 'family_table' ? (interval === 'year' ? 'year' : 'month') : interval}</span>
            </div>
            {interval === 'year' && c.originalYear && (
              <div className="discount">
                <span className="strike">${c.originalYear}</span>
                <span className="save">Save ${(
                  Math.max(0, parseFloat(c.originalYear) - parseFloat(String((c.price || '').toString().replace('$',''))))
                ).toFixed(2)}</span>
              </div>
            )}
            {c.sub && <div className="sub">{c.sub}</div>}
            {c.code === 'family_table' && (
              <div className="seats">
                <label>Total members</label>
                <input type="number" min={4} value={familySeats} onChange={(e) => setFamilySeats(Math.max(4, parseInt(e.target.value || '4', 10)))} />
              </div>
            )}
            <ul>
              {c.bullets.map((b) => (
                <li key={b}><Check size={16} />{b}</li>
              ))}
            </ul>
            <Button className="cta" onClick={() => startCheckout(c.code)} disabled={!!loadingPlan}>
              {loadingPlan === c.code ? 'Starting…' : 'Start free trial'}
            </Button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .plan-picker { display: flex; flex-direction: column; gap: var(--space-6); }
        .header { text-align: center; }
        .header h1 { margin: 0; }
        .interval { display: inline-flex; gap: 12px; align-items: center; margin-top: 8px; justify-content: center; }
        .interval .active { font-weight: 600; }
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; transition: .2s; border-radius: 999px; }
        .slider:before { position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; transition: .2s; border-radius: 50%; }
        input:checked + .slider { background: var(--brand-500); }
        input:checked + .slider:before { transform: translateX(20px); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-5); align-items: stretch; }
        .card { position: relative; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--border); border-radius: 14px; padding: var(--space-6); background: var(--panel-1); min-height: 420px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: var(--brand-400); }
        .card.featured { border-color: var(--brand-400); box-shadow: 0 0 0 1px var(--brand-300) inset; }
        .badge { position: absolute; top: 0; right: 0; background: var(--brand-500); color: white; font-size: 11px; padding: 6px 10px; border-bottom-left-radius: 10px; border-top-right-radius: 10px; }
        .price { font-size: 26px; font-weight: 800; color: var(--brand-500); margin: 8px 0 2px; }
        .price span { color: var(--text-muted); font-size: 12px; margin-left: 4px; }
        .discount { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
        .strike { text-decoration: line-through; color: var(--text-muted); font-size: 12px; }
        .save { color: var(--success); font-size: 12px; font-weight: 600; }
        .sub { color: var(--text-muted); font-size: 12px; margin-bottom: 8px; }
        .seats { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .seats input { width: 72px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); }
        ul { list-style: none; padding: 0; margin: 12px 0 16px; display: grid; gap: 10px; }
        li { display: flex; gap: 8px; align-items: center; color: var(--text); font-size: 14px; }
        .cta { width: 100%; margin-top: auto; }
      `}</style>
    </div>
  )
}
