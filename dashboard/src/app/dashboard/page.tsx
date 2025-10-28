import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import Button from '../../components/ui/Button'
import ProgressRing from '../../components/ui/ProgressRing'
import QuickActionCard from '../../components/ui/QuickActionCard'
import EmptyState from '../../components/ui/EmptyState'
import Confetti from '../../components/ui/Confetti'
import SuggestedMeals from '../../components/ui/SuggestedMeals'
import AnimatedCard, { createStaggeredDelay } from '../../components/ui/AnimatedCard'
import FloatingActionButton from '../../components/ui/FloatingActionButton'
import LoadingScreen from '../../components/ui/LoadingScreen'
import { Calendar, ChefHat, ShoppingCart, TrendingUp, Plus, Bot, Target, Droplets, Heart, Star, Activity, Award, Flame } from 'lucide-react'
import { useAuthLegacy as useAuth } from '../../lib/auth-context-v2'
import { useDashboardStats, useTodaysMeals, useSuggestedMeals } from '../../lib/use-data'
import { useNavigate } from 'react-router-dom'
import { mockStats, mockTodaysMeals, mockRecentActivities, mockWeeklyProgress } from '../../lib/mockData'
// Fallback mock data for demo purposes when real data is not available

const focusTips = [
  "You're 353 calories away from your daily goal! 🎯",
  "Remember to drink 8 glasses of water today 💧",
  "Try a new recipe this week to keep things exciting! 👨‍🍳",
  "You're doing great with your protein intake! 💪",
  "Your consistency is inspiring! Keep up the great work! 🌟",
  "Time for a healthy snack? Try some nuts or fruit! 🥜",
  "Don't forget to stay hydrated throughout the day! 💧",
  "You're building healthy habits that will last a lifetime! 💚"
]

const motivationMessages = [
  "Every healthy choice is a step toward your goals! 💪",
  "You're creating a healthier, happier version of yourself! 🌟",
  "Small changes lead to big results - you've got this! 🎯",
  "Your future self will thank you for today's choices! ❤️"
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const { data: stats, loading: statsLoading } = useDashboardStats()
  const { data: todaysMeals, loading: mealsLoading } = useTodaysMeals()
  const { data: suggestedMeals, loading: suggestionsLoading } = useSuggestedMeals({ limit: 4 })
  
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showMascot, setShowMascot] = useState(false)
  const [bannerType, setBannerType] = useState<'tip' | 'motivation'>('tip')

  // Get the current tip text
  const currentTip = bannerType === 'tip' ? focusTips[currentTipIndex] : motivationMessages[currentTipIndex]

  // Rotate tips and motivation messages every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % (bannerType === 'tip' ? focusTips.length : motivationMessages.length))
    }, 6000)
    return () => clearInterval(interval)
  }, [bannerType])

  // Switch between tips and motivation every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBannerType(prev => prev === 'tip' ? 'motivation' : 'tip')
      setCurrentTipIndex(0)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Show confetti if goal is 100%
  useEffect(() => {
    if ((stats?.dailyCalories?.percentage ?? 0) >= 100) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }, [stats?.dailyCalories?.percentage])

  // Show mascot wave on first visit (simulate)
  useEffect(() => {
    const isFirstVisit = !localStorage.getItem('dashboard-visited-today')
    if (isFirstVisit) {
      setShowMascot(true)
      localStorage.setItem('dashboard-visited-today', new Date().toDateString())
      setTimeout(() => setShowMascot(false), 3000)
    }
  }, [])

  const handleGoalReached = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3000)
  }

  const handleSuggestedMealClick = (meal: any) => {
    // Navigate to recipes page with the selected meal
    navigate('/recipes', { state: { selectedMeal: meal } })
  }

  // Show loading while data is being fetched
  if (authLoading || statsLoading) {
    return (
      <LoadingScreen 
        title="Nourish Dashboard"
        subtitle="Loading your personalized dashboard..."
        showProgress={statsLoading && !authLoading}
      />
    )
  }

  // Show sign-in prompt if not authenticated
  if (!user) {
    return (
      <div className="dashboard-page">
        <EmptyState
          icon={<Target size={32} />}
          title="Welcome to Nourish!"
          description="Please sign in to access your personalized nutrition dashboard."
          primaryAction={{
            label: "Sign In",
            onClick: () => navigate('/settings') // You might want to create a dedicated sign-in page
          }}
        />
      </div>
    )
  }

  // Use mock data as fallback for demo purposes
  const displayStats = stats || mockStats
  const displayMeals = todaysMeals || mockTodaysMeals
  const hasMealsToday = displayMeals && displayMeals.length > 0

  return (
    <div className="dashboard-page">
      {/* Hero Section */}
      <AnimatedCard delay={createStaggeredDelay(0, 0, 150)}>
        <div className="hero-section">
        <div className="hero-content">
          <div className="greeting">
            <h1 className="greeting-text">
              Welcome back, {profile?.display_name || user?.email?.split('@')[0] || 'there'}! 👋
              {showMascot && (
          <div className="mascot">
            <img src="/images/mascot.png" alt="Nourish Mascot" />
          </div>
        )}
            </h1>
            <div className="focus-banner">
              <div className="focus-content">
                <div className="focus-icon">
                  {bannerType === 'tip' && (
                    <>
                      {currentTip.includes('calories') && <Target size={16} />}
                      {currentTip.includes('water') && <Droplets size={16} />}
                      {currentTip.includes('recipe') && <ChefHat size={16} />}
                      {currentTip.includes('protein') && <TrendingUp size={16} />}
                      {currentTip.includes('snack') && <Heart size={16} />}
                      {currentTip.includes('hydrated') && <Droplets size={16} />}
                      {currentTip.includes('habits') && <Star size={16} />}
                    </>
                  )}
                  {bannerType === 'motivation' && <Heart size={16} />}
                </div>
                <span className="focus-text">{currentTip}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hero-progress">
          <ProgressRing
            value={displayStats?.dailyCalories?.percentage || 0}
            label="Daily Goal"
            size={120}
            onGoalReached={handleGoalReached}
          />
        </div>
        </div>
      </AnimatedCard>

      {/* KPI Row */}
      <div className="stats-grid">
        <AnimatedCard delay={createStaggeredDelay(0, 200, 100)}>
          <StatCard
            title="Daily Calories"
            value={`${displayStats?.dailyCalories?.current || 0}/${displayStats?.dailyCalories?.target || 2200}`}
            delta={{ value: displayStats?.dailyCalories?.delta || 0, label: 'vs target', trend: (displayStats?.dailyCalories?.delta || 0) > 0 ? 'up' : 'down' }}
            icon={<Flame size={20} />}
            tooltip="Calories consumed vs daily target"
          />
        </AnimatedCard>
        <AnimatedCard delay={createStaggeredDelay(1, 200, 100)}>
          <StatCard
            title="Protein"
            value={`${displayStats?.protein?.current || 0}g/${displayStats?.protein?.target || 120}g`}
            delta={{ value: displayStats?.protein?.delta || 0, label: 'vs target', trend: (displayStats?.protein?.delta || 0) > 0 ? 'up' : 'down' }}
            icon={<Target size={20} />}
            tooltip="Protein consumed vs daily target"
          />
        </AnimatedCard>
        <AnimatedCard delay={createStaggeredDelay(2, 200, 100)}>
          <StatCard
            title="Water Intake"
            value={`${displayStats?.water?.current || 0}/${displayStats?.water?.target || 8} glasses`}
            delta={{ value: displayStats?.water?.delta || 0, label: 'today', trend: (displayStats?.water?.delta || 0) > 0 ? 'up' : 'down' }}
            icon={<Droplets size={20} />}
            tooltip="Daily water intake progress"
          />
        </AnimatedCard>
        <AnimatedCard delay={createStaggeredDelay(3, 200, 100)}>
          <StatCard
            title="Weekly Streak"
            value={`${displayStats?.weeklyStreak?.current || 0} days`}
            delta={{ value: displayStats?.weeklyStreak?.delta || 0, label: 'this week', trend: (displayStats?.weeklyStreak?.delta || 0) > 0 ? 'up' : 'down' }}
            icon={<Award size={20} />}
            tooltip="Consecutive days meeting goals"
          />
        </AnimatedCard>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Today's Meals */}
        <AnimatedCard delay={createStaggeredDelay(0, 600, 150)}>
          <Card>
          <CardHeader>
            <CardTitle>Today's Meals</CardTitle>
            <CardDescription>Your planned nutrition for today</CardDescription>
          </CardHeader>
          <CardContent>
            {hasMealsToday ? (
              <div className="meal-list">
                {displayMeals?.map((meal, index) => (
                  <div 
                    key={meal.id} 
                    className="meal-item"
                    style={{
                      animationDelay: `${index * 100}ms`
                    } as React.CSSProperties}
                  >
                    <div className="meal-info">
                      <h4>{meal.type}</h4>
                      <p>{meal.name}</p>
                      <span className="meal-time">{meal.time}</span>
                      {meal.status && (
                        <span className={`meal-status ${meal.status}`}>
                          {meal.status === 'completed' ? '✓' : '○'}
                        </span>
                      )}
                    </div>
                    <div className="meal-calories">
                      {meal.calories} cal
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-meals">
                <SuggestedMeals 
                  meals={suggestedMeals || []}
                  onMealClick={handleSuggestedMealClick}
                />
              </div>
            )}
          </CardContent>
          </Card>
        </AnimatedCard>

        {/* Quick Actions */}
        <AnimatedCard delay={createStaggeredDelay(1, 600, 150)}>
          <div className="quick-actions-section">
          <h3 className="section-title">Quick Actions</h3>
          <div className="quick-actions-grid">
            <QuickActionCard
              icon={<Calendar size={24} />}
              title="Plan This Week"
              description="Create your weekly meal schedule"
              action="Plan Now"
              onClick={() => navigate('/plans')}
            />
            <QuickActionCard
              icon={<ChefHat size={24} />}
              title="Find Recipes"
              description="Discover new dishes to try"
              action="Explore"
              onClick={() => navigate('/recipes')}
            />
            <QuickActionCard
              icon={<Bot size={24} />}
              title="Chat with AI"
              description="Get personalized nutrition advice"
              action="Chat Now"
              onClick={() => navigate('/ai')}
            />
            <QuickActionCard
              icon={<ShoppingCart size={24} />}
              title="Update Grocery List"
              description="Manage your shopping needs"
              action="Update"
              onClick={() => navigate('/groceries')}
            />
          </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Recent Activity */}
      <AnimatedCard delay={createStaggeredDelay(2, 600, 150)}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest nutrition and wellness updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="activity-list">
              {mockRecentActivities.map((activity, index) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {activity.icon}
                  </div>
                  <div className="activity-content">
                    <h4>{activity.title}</h4>
                    <p>{activity.description}</p>
                    <span className="activity-time">{activity.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>

      {/* Confetti Animation */}
      <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {/* Floating Action Button */}
      <FloatingActionButton 
        onClick={() => navigate('/recipes')}
        icon={<Plus size={24} />}
        label="Log new meal"
      />

      <style jsx>{`
        .dashboard-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-16);
          gap: var(--space-4);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border);
          border-top: 3px solid var(--brand-500);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes slideInLeft {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .hero-section {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-6);
          padding: var(--space-6);
          background: linear-gradient(135deg, var(--brand-100) 0%, var(--panel) 100%);
          border-radius: var(--radius-2xl);
          border: 1px solid var(--border);
          transition: all var(--transition-fast);
        }

        .hero-section:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        [data-theme="dark"] .hero-section {
          background: linear-gradient(135deg, rgba(21, 181, 107, 0.1) 0%, var(--panel) 100%);
        }

        .hero-content {
          flex: 1;
        }

        .greeting-text {
          font-size: var(--text-3xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin: 0 0 var(--space-4) 0;
          position: relative;
        }

        .mascot {
          display: inline-block;
          animation: wave 0.5s ease-in-out 3;
          margin-left: var(--space-2);
          width: 32px;
          height: 32px;
        }

        .mascot img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }

        .focus-banner {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-fast);
        }

        .focus-banner:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .focus-content {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .focus-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background-color: var(--brand-100);
          color: var(--brand);
          border-radius: var(--radius-md);
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }

        .focus-banner:hover .focus-icon {
          transform: scale(1.1);
        }

        [data-theme="dark"] .focus-icon {
          background-color: rgba(21, 181, 107, 0.1);
        }

        .focus-text {
          font-size: var(--text-base);
          color: var(--text);
          font-weight: var(--font-medium);
        }

        .hero-progress {
          flex-shrink: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--space-6);
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: var(--space-8);
        }

        .meal-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .meal-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          background-color: var(--panel-2);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
          cursor: pointer;
          opacity: 0;
          transform: translateX(-20px);
          animation: slideInLeft 0.4s ease-out forwards;
        }

        .meal-item:hover {
          background-color: var(--hover-bg);
          transform: translateX(4px);
        }

        .meal-info h4 {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .meal-info p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0 0 var(--space-1) 0;
        }

        .meal-time {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .meal-calories {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--brand);
        }

        .meal-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          font-size: var(--text-xs);
          margin-left: var(--space-2);
        }

        .meal-status.completed {
          background-color: var(--success);
          color: white;
        }

        .meal-status.planned {
          background-color: var(--border);
          color: var(--text-muted);
        }

        .empty-meals {
          padding: var(--space-4) 0;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3);
          background-color: var(--panel-2);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
        }

        .activity-item:hover {
          background-color: var(--hover-bg);
          transform: translateX(4px);
        }

        .activity-icon {
          flex-shrink: 0;
          font-size: var(--text-xl);
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-lg);
          background-color: var(--panel);
        }

        .activity-content {
          flex: 1;
        }

        .activity-content h4 {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .activity-content p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0 0 var(--space-1) 0;
        }

        .activity-time {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .quick-actions-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .section-title {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }

        @media (max-width: 1279px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .quick-actions-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 767px) {
          .hero-section {
            flex-direction: column;
            text-align: center;
          }

          .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: var(--space-4);
          }
        }
      `}</style>
    </div>
  )
}
