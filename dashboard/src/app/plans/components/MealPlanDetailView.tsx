import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { MealPlan, DaySchedule } from '../mock-data'
import EnhancedCalendarEditor from './EnhancedCalendarEditor'
import {
  ArrowLeft,
  CalendarRange,
  ChefHat,
  Clock,
  Edit3,
  Eye,
  Save,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
  Plus,
  Sparkles,
} from 'lucide-react'

interface MealPlanDetailViewProps {
  plan: MealPlan
  schedule: DaySchedule[]
  onScheduleChange: (schedule: DaySchedule[]) => void
  onSave: () => void
  onReset: () => void
  hasChanges: boolean
  onBack: () => void
  onEditPlan: () => void
  onDeletePlan: () => void
  onSharePlan: () => void
  onAddMeal: (date: string, mealType: string) => void
  onGenerateGroceryList: () => void
}

export default function MealPlanDetailView({
  plan,
  schedule,
  onScheduleChange,
  onSave,
  onReset,
  hasChanges,
  onBack,
  onEditPlan,
  onDeletePlan,
  onSharePlan,
  onAddMeal,
  onGenerateGroceryList,
}: MealPlanDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'overview' | 'settings'>('calendar')

  return (
    <div className="meal-plan-detail">
      {/* Header */}
      <div className="detail-header">
        <div className="header-left">
          <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ArrowLeft size={16} />}>
            Back to Plans
          </Button>
          <div className="plan-info">
            <h1>{plan.title}</h1>
            <div className="plan-meta">
              <Badge variant={plan.createdBy === 'ai' ? 'brand' : 'neutral'} size="sm">
                {plan.createdBy === 'ai' ? 'Chef Nourish' : 'Manual'}
              </Badge>
              <span className="date-range">
                {formatDateRange(plan.startDate, plan.endDate)}
              </span>
              <span className="meals-count">
                {plan.mealsPerDay} meals per day
              </span>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <Button variant="ghost" size="sm" onClick={onSharePlan} leftIcon={<Share2 size={16} />}>
            Share
          </Button>
          <Button variant="ghost" size="sm" onClick={onEditPlan} leftIcon={<Edit3 size={16} />}>
            Edit Plan
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeletePlan} leftIcon={<Trash2 size={16} />}>
            Delete
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="detail-tabs">
        <button
          className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarRange size={16} />
          Calendar
        </button>
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Eye size={16} />
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Content Area */}
      <div className="detail-content">
        {activeTab === 'calendar' && (
          <div className="calendar-tab">
            <div className="calendar-header">
              <div className="calendar-info">
                <h2>Meal Calendar</h2>
                <p>Manage your daily meals and schedule</p>
              </div>
              <div className="calendar-actions">
                {hasChanges && (
                  <div className="save-actions">
                    <Button variant="ghost" size="sm" onClick={onReset} leftIcon={<RotateCcw size={16} />}>
                      Reset
                    </Button>
                    <Button size="sm" onClick={onSave} leftIcon={<Save size={16} />}>
                      Save Changes
                    </Button>
                  </div>
                )}
                <Button size="sm" onClick={onGenerateGroceryList} leftIcon={<Plus size={16} />}>
                  Generate Grocery List
                </Button>
              </div>
            </div>
            
            <EnhancedCalendarEditor
              plan={plan}
              schedule={schedule}
              onScheduleChange={onScheduleChange}
              onSave={onSave}
              onReset={onReset}
              hasChanges={hasChanges}
            />
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="overview-header">
              <h2>Plan Overview</h2>
              <p>Summary and statistics for this meal plan</p>
            </div>
            
            <div className="overview-grid">
              <Card className="stats-card">
                <CardHeader>
                  <CardTitle>Plan Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="stats-list">
                    <div className="stat-item">
                      <ChefHat size={20} />
                      <div>
                        <span className="stat-label">Total Meals</span>
                        <span className="stat-value">{schedule.reduce((sum, day) => sum + day.meals.length, 0)}</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <CalendarRange size={20} />
                      <div>
                        <span className="stat-label">Days Covered</span>
                        <span className="stat-value">{schedule.length}</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <Clock size={20} />
                      <div>
                        <span className="stat-label">Avg Meals/Day</span>
                        <span className="stat-value">
                          {schedule.length > 0 ? Math.round(schedule.reduce((sum, day) => sum + day.meals.length, 0) / schedule.length) : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="summary-card">
                <CardHeader>
                  <CardTitle>Plan Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {plan.summary ? (
                    <p className="plan-summary">{plan.summary}</p>
                  ) : (
                    <p className="no-summary">No summary available for this plan.</p>
                  )}
                  
                  {plan.tags && plan.tags.length > 0 && (
                    <div className="plan-tags">
                      <h4>Tags</h4>
                      <div className="tags-list">
                        {plan.tags.map(tag => (
                          <Badge key={tag} variant="neutral" size="sm">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="settings-header">
              <h2>Plan Settings</h2>
              <p>Manage plan preferences and options</p>
            </div>
            
            <div className="settings-grid">
              <Card>
                <CardHeader>
                  <CardTitle>Plan Details</CardTitle>
                  <CardDescription>Basic information about this meal plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="setting-item">
                    <label>Plan Name</label>
                    <input type="text" value={plan.title} readOnly />
                  </div>
                  <div className="setting-item">
                    <label>Date Range</label>
                    <input type="text" value={formatDateRange(plan.startDate, plan.endDate)} readOnly />
                  </div>
                  <div className="setting-item">
                    <label>Meals per Day</label>
                    <input type="text" value={plan.mealsPerDay} readOnly />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>Manage this meal plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="action-buttons">
                    <Button variant="outline" onClick={onEditPlan} leftIcon={<Edit3 size={16} />}>
                      Edit Plan Details
                    </Button>
                    <Button variant="outline" onClick={onSharePlan} leftIcon={<Share2 size={16} />}>
                      Share Plan
                    </Button>
                    <Button variant="outline" onClick={onGenerateGroceryList} leftIcon={<Plus size={16} />}>
                      Generate Grocery List
                    </Button>
                    <Button variant="destructive" onClick={onDeletePlan} leftIcon={<Trash2 size={16} />}>
                      Delete Plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .meal-plan-detail {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          height: 100%;
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          padding: var(--space-6);
          background: var(--surface);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border-strong);
        }

        .header-left {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .plan-info h1 {
          margin: 0;
          font-size: var(--text-2xl);
          font-weight: var(--font-bold);
          color: var(--text);
        }

        .plan-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }

        .date-range,
        .meals-count {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .header-actions {
          display: flex;
          gap: var(--space-2);
        }

        .detail-tabs {
          display: flex;
          gap: var(--space-1);
          background: var(--panel-1);
          border-radius: var(--radius-lg);
          padding: var(--space-1);
        }

        .tab {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border: none;
          background: transparent;
          color: var(--text-muted);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .tab:hover {
          background: var(--panel-2);
          color: var(--text);
        }

        .tab.active {
          background: var(--surface);
          color: var(--text);
          box-shadow: var(--shadow-sm);
        }

        .detail-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .calendar-tab,
        .overview-tab,
        .settings-tab {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .calendar-header,
        .overview-header,
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .calendar-header h2,
        .overview-header h2,
        .settings-header h2 {
          margin: 0;
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .calendar-header p,
        .overview-header p,
        .settings-header p {
          margin: var(--space-1) 0 0 0;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .calendar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .save-actions {
          display: flex;
          gap: var(--space-2);
        }

        .overview-grid,
        .settings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
        }

        .stats-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .stat-item svg {
          color: var(--brand-500);
        }

        .stat-label {
          display: block;
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .stat-value {
          display: block;
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .plan-summary {
          margin: 0 0 var(--space-4) 0;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .no-summary {
          margin: 0;
          color: var(--text-muted);
          font-style: italic;
        }

        .plan-tags {
          margin-top: var(--space-4);
        }

        .plan-tags h4 {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .setting-item {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }

        .setting-item label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .setting-item input {
          padding: var(--space-2) var(--space-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--input-bg);
          color: var(--text);
          font-size: var(--text-sm);
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        @media (max-width: 1024px) {
          .overview-grid,
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .detail-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            justify-content: flex-start;
          }

          .calendar-actions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
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
