import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import StatCard from '../../../components/ui/StatCard'
import Badge from '../../../components/ui/Badge'
import { MealPlan } from '../mock-data'
import {
  CalendarRange,
  ChefHat,
  Clock,
  History,
  LucideIcon,
  Plus,
  Sparkles,
  Tag,
  ArrowRight,
  Edit3,
  Eye,
} from 'lucide-react'

interface MealPlansDashboardProps {
  currentPlan: MealPlan | null
  upcomingPlans: MealPlan[]
  pastPlans: MealPlan[]
  totalScheduledMeals: number
  onCreateWithAI: () => void
  onCreateManually: () => void
  onSelectPlan: (planId: string) => void
  onViewPlan: (planId: string) => void
}

export default function MealPlansDashboard({
  currentPlan,
  upcomingPlans,
  pastPlans,
  totalScheduledMeals,
  onCreateWithAI,
  onCreateManually,
  onSelectPlan,
  onViewPlan,
}: MealPlansDashboardProps) {
  return (
    <div className="meal-plans-dashboard">
      {/* Quick Actions Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Meal Plans</h1>
            <p>Plan your meals, discover recipes, and stay organized.</p>
          </div>
          <div className="header-actions">
            <Button variant="outline" onClick={onCreateManually} leftIcon={<Plus size={16} />}>
              Create manually
            </Button>
            <Button onClick={onCreateWithAI} leftIcon={<Sparkles size={16} />}>
              Create with AI
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-section">
        <StatCard
          title="Current Plan"
          value={currentPlan ? 'Active' : 'None'}
          icon={<ChefHat size={16} />}
          tooltip="Your currently active meal plan"
        />
        <StatCard
          title="Upcoming Plans"
          value={upcomingPlans.length}
          icon={<Clock size={16} />}
          tooltip="Plans scheduled for future dates"
        />
        <StatCard
          title="Past Plans"
          value={pastPlans.length}
          icon={<History size={16} />}
          tooltip="Completed plans in the last 60 days"
        />
        <StatCard
          title="Total Meals"
          value={totalScheduledMeals}
          icon={<ChefHat size={16} />}
          tooltip="Total meals across all plans"
        />
      </div>

      {/* Current Plan Highlight */}
      {currentPlan && (
        <div className="current-plan-section">
          <Card className="current-plan-card">
            <CardHeader>
              <div className="current-plan-header">
                <div>
                  <CardTitle>{currentPlan.title}</CardTitle>
                  <CardDescription>
                    {formatDateRange(currentPlan.startDate, currentPlan.endDate)}
                  </CardDescription>
                </div>
                <Badge variant="brand" size="sm">
                  {currentPlan.createdBy === 'ai' ? 'Chef Nourish' : 'Manual'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="current-plan-content">
                {currentPlan.summary && (
                  <p className="plan-summary">{currentPlan.summary}</p>
                )}
                <div className="plan-meta">
                  <MetaPill icon={CalendarRange} label={formatDateRange(currentPlan.startDate, currentPlan.endDate)} />
                  <MetaPill icon={ChefHat} label={`${currentPlan.mealsPerDay} meals / day`} />
                </div>
                {currentPlan.tags && currentPlan.tags.length > 0 && (
                  <div className="plan-tags">
                    {currentPlan.tags.map(tag => (
                      <Badge key={tag} variant="neutral" size="xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="plan-actions">
                  <Button size="sm" onClick={() => onViewPlan(currentPlan.id)} leftIcon={<Eye size={14} />}>
                    View Plan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onSelectPlan(currentPlan.id)} leftIcon={<Edit3 size={14} />}>
                    Edit Calendar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Plans Grid */}
      <div className="plans-grid">
        {/* Upcoming Plans */}
        <PlansSection
          title="Upcoming Plans"
          plans={upcomingPlans}
          emptyLabel="No upcoming plans scheduled yet."
          onSelectPlan={onSelectPlan}
          onViewPlan={onViewPlan}
        />

        {/* Past Plans */}
        <PlansSection
          title="Past Plans"
          plans={pastPlans}
          emptyLabel="No past plans to review."
          onSelectPlan={onSelectPlan}
          onViewPlan={onViewPlan}
        />
      </div>

      <style jsx>{`
        .meal-plans-dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .dashboard-header {
          background: var(--surface);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border-strong);
          padding: var(--space-6);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .header-content h1 {
          margin: 0;
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--text);
        }

        .header-content p {
          margin: var(--space-2) 0 0 0;
          color: var(--text-muted);
          font-size: var(--text-base);
        }

        .header-actions {
          display: flex;
          gap: var(--space-3);
        }

        .stats-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .current-plan-section {
          margin: var(--space-2) 0;
        }

        .current-plan-card {
          border: 2px solid var(--brand-200);
          background: linear-gradient(135deg, var(--brand-50) 0%, var(--surface) 100%);
        }

        .current-plan-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .current-plan-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .plan-summary {
          margin: 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.5;
        }

        .plan-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
        }

        .plan-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .plan-actions {
          display: flex;
          gap: var(--space-3);
        }

        .plans-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
        }

        @media (max-width: 1024px) {
          .plans-grid {
            grid-template-columns: 1fr;
          }
          
          .header-content {
            flex-direction: column;
            align-items: stretch;
          }
          
          .header-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 768px) {
          .stats-section {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

interface PlansSectionProps {
  title: string
  plans: MealPlan[]
  emptyLabel: string
  onSelectPlan: (planId: string) => void
  onViewPlan: (planId: string) => void
}

function PlansSection({ title, plans, emptyLabel, onSelectPlan, onViewPlan }: PlansSectionProps) {
  return (
    <section className="plans-section">
      <header className="section-header">
        <h2>{title}</h2>
        <span className="plans-count">{plans.length}</span>
      </header>
      
      <div className="plans-list">
        {plans.length === 0 ? (
          <div className="empty-state">
            <p>{emptyLabel}</p>
          </div>
        ) : (
          plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelectPlan={onSelectPlan}
              onViewPlan={onViewPlan}
            />
          ))
        )}
      </div>

      <style jsx>{`
        .plans-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .section-header h2 {
          margin: 0;
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .plans-count {
          background: var(--panel-2);
          color: var(--text-muted);
          padding: var(--space-1) var(--space-3);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .plans-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .empty-state {
          background: var(--panel-1);
          border: 1px dashed var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          text-align: center;
        }

        .empty-state p {
          margin: 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }
      `}</style>
    </section>
  )
}

interface PlanCardProps {
  plan: MealPlan
  onSelectPlan: (planId: string) => void
  onViewPlan: (planId: string) => void
}

function PlanCard({ plan, onSelectPlan, onViewPlan }: PlanCardProps) {
  return (
    <Card className="plan-card">
      <CardHeader>
        <div className="plan-card-header">
          <div>
            <CardTitle className="plan-title">{plan.title}</CardTitle>
            <CardDescription>
              {formatDateRange(plan.startDate, plan.endDate)}
            </CardDescription>
          </div>
          <Badge variant={plan.createdBy === 'ai' ? 'brand' : 'neutral'} size="xs">
            {plan.createdBy === 'ai' ? 'Chef Nourish' : 'Manual'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="plan-card-content">
          {plan.summary && (
            <p className="plan-summary">{plan.summary}</p>
          )}
          <div className="plan-meta">
            <MetaPill icon={CalendarRange} label={formatDateRange(plan.startDate, plan.endDate)} />
            <MetaPill icon={ChefHat} label={`${plan.mealsPerDay} per day`} />
          </div>
          {plan.tags && plan.tags.length > 0 && (
            <div className="plan-tags">
              {plan.tags.map(tag => (
                <Badge key={tag} variant="neutral" size="xs" icon={<Tag size={12} />}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="plan-actions">
            <Button size="sm" variant="ghost" onClick={() => onViewPlan(plan.id)} leftIcon={<Eye size={14} />}>
              View
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSelectPlan(plan.id)} leftIcon={<Edit3 size={14} />}>
              Edit
            </Button>
          </div>
        </div>
      </CardContent>

      <style jsx>{`
        .plan-card {
          transition: all var(--transition-fast);
          cursor: pointer;
        }

        .plan-card:hover {
          border-color: var(--brand-300);
          box-shadow: var(--shadow-sm);
        }

        .plan-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-3);
        }

        .plan-title {
          font-size: var(--text-base);
          margin: 0;
        }

        .plan-card-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .plan-summary {
          margin: 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.4;
        }

        .plan-meta {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .plan-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .plan-actions {
          display: flex;
          gap: var(--space-2);
        }
      `}</style>
    </Card>
  )
}

interface MetaPillProps {
  icon: LucideIcon
  label: string
}

function MetaPill({ icon: Icon, label }: MetaPillProps) {
  return (
    <span className="meta-pill">
      <Icon size={14} />
      <span>{label}</span>
      <style jsx>{`
        .meta-pill {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          background: var(--panel-2);
          color: var(--text-muted);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
        }
      `}</style>
    </span>
  )
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  const startFormatted = startDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
  const endFormatted = endDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
  
  return `${startFormatted} - ${endFormatted}`
}
