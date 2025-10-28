import React, { useState } from 'react'
import Button from './Button'
import { Sparkles, Calendar, ChefHat, Heart, Zap, Clock, Target, Users, Star, ArrowRight, Play, Plus, TrendingUp, BookOpen } from 'lucide-react'

interface MealPlanEmptyStateProps {
  onCreatePlan: () => void
  isFirstTime?: boolean
  weekContext?: string
}

export default function MealPlanEmptyState({ 
  onCreatePlan, 
  isFirstTime = false, 
  weekContext 
}: MealPlanEmptyStateProps) {
  const [hoveredBenefit, setHoveredBenefit] = useState<number | null>(null)

  return (
    <div className="empty-state-container">
      {/* Background Animation */}
      <div className="floating-elements">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`floating-element element-${i + 1}`}>
            {getFloatingIcon(i)}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="empty-state-content">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="mascot-container">
            <img src="/mascot.png" alt="Chef Nourish" className="mascot-image" />
            <div className="mascot-sparkle">
              <Sparkles size={20} />
            </div>
            <div className="mascot-wave">👋</div>
          </div>
          
          <h1 className="hero-title">
            {isFirstTime 
              ? "Ready to create your first meal plan?"
              : weekContext 
                ? `No meal plans for ${weekContext}`
                : "No meal plans for this week"
            }
          </h1>
          
          <p className="hero-subtitle">
            {isFirstTime 
              ? "Let Chef Nourish craft personalized meals just for you! From quick weeknight dinners to weekend feasts, we've got you covered."
              : "Ready to plan your meals for this week? Let's create a delicious and nutritious meal plan tailored just for you!"
            }
          </p>

          {/* Quick Action Buttons */}
          <div className="quick-actions">
            <Button
              size="lg"
              leftIcon={<Sparkles size={20} />}
              onClick={onCreatePlan}
              className="primary-cta-btn"
            >
              {isFirstTime ? "✨ Create AI Meal Plan" : "✨ Plan This Week's Meals"}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              leftIcon={<ChefHat size={20} />}
              onClick={onCreatePlan}
              className="secondary-cta-btn"
            >
              🍳 Manual Planning
            </Button>
          </div>
        </div>

        {/* Benefits */}
        <div className="benefits-grid">
          <div 
            className={`benefit-card ${hoveredBenefit === 0 ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredBenefit(0)}
            onMouseLeave={() => setHoveredBenefit(null)}
          >
            <div className="benefit-icon">
              <ChefHat size={24} />
            </div>
            <h3>Personalized Plans</h3>
            <p>Tailored to your taste, dietary needs, and lifestyle</p>
            <div className="benefit-highlight">🎯 Perfect for you</div>
          </div>
          
          <div 
            className={`benefit-card ${hoveredBenefit === 1 ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredBenefit(1)}
            onMouseLeave={() => setHoveredBenefit(null)}
          >
            <div className="benefit-icon">
              <Zap size={24} />
            </div>
            <h3>Smart & Quick</h3>
            <p>Get a full week planned in under 2 minutes</p>
            <div className="benefit-highlight">⚡ Lightning fast</div>
          </div>
          
          <div 
            className={`benefit-card ${hoveredBenefit === 2 ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredBenefit(2)}
            onMouseLeave={() => setHoveredBenefit(null)}
          >
            <div className="benefit-icon">
              <Heart size={24} />
            </div>
            <h3>Healthy & Delicious</h3>
            <p>Nutritionally balanced meals you'll actually love</p>
            <div className="benefit-highlight">💚 Nutritious & tasty</div>
          </div>
        </div>

        {/* Quick Tips for Returning Users */}
        {!isFirstTime && (
          <div className="quick-tips">
            <h3 className="tips-title">💡 Quick Tips</h3>
            <div className="tips-grid">
              <div className="tip-item">
                <TrendingUp size={20} />
                <span>Try new cuisines this week</span>
              </div>
              <div className="tip-item">
                <Clock size={20} />
                <span>Plan quick 30-min meals</span>
              </div>
              <div className="tip-item">
                <Heart size={20} />
                <span>Include your favorite dishes</span>
              </div>
              <div className="tip-item">
                <BookOpen size={20} />
                <span>Explore seasonal ingredients</span>
              </div>
            </div>
          </div>
        )}

        {/* Features Showcase */}
        <div className="features-showcase">
          <h3 className="showcase-title">What you'll get:</h3>
          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">
                <Calendar size={20} />
              </div>
              <span>7-day meal calendar</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <Target size={20} />
              </div>
              <span>Nutrition tracking</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <Users size={20} />
              </div>
              <span>Family-friendly options</span>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <Clock size={20} />
              </div>
              <span>Prep time estimates</span>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
          <div className="cta-buttons">
            <Button
              size="lg"
              leftIcon={<Sparkles size={20} />}
              onClick={onCreatePlan}
              className="create-plan-btn"
            >
              {isFirstTime ? "✨ Create Your First Meal Plan" : "✨ Plan This Week's Meals"}
            </Button>
            
            <Button
              variant="ghost"
              size="lg"
              leftIcon={<Play size={20} />}
              onClick={onCreatePlan}
              className="demo-btn"
            >
              🎬 See How It Works
            </Button>
          </div>
          
          <p className="cta-subtitle">
            ✨ Takes less than 2 minutes • 🎯 Completely personalized • 🆓 Always free
          </p>
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-item">
            <span className="stat-number">10K+</span>
            <span className="stat-label">Recipes</span>
          </div>
          <div className="stat-divider">•</div>
          <div className="stat-item">
            <span className="stat-number">50+</span>
            <span className="stat-label">Cuisines</span>
          </div>
          <div className="stat-divider">•</div>
          <div className="stat-item">
            <span className="stat-number">24/7</span>
            <span className="stat-label">AI Chef</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .empty-state-container {
          position: relative;
          min-height: 600px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--brand-50) 0%, var(--brand-100) 100%);
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin: var(--space-8) 0;
        }

        [data-theme="dark"] .empty-state-container {
          background: linear-gradient(135deg, rgba(21, 181, 107, 0.05) 0%, rgba(21, 181, 107, 0.1) 100%);
          border: 1px solid var(--border);
        }

        .floating-elements {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .floating-element {
          position: absolute;
          opacity: 0.6;
          animation: float 6s ease-in-out infinite;
        }

        .element-1 { top: 10%; left: 10%; animation-delay: 0s; }
        .element-2 { top: 20%; right: 15%; animation-delay: 1s; }
        .element-3 { bottom: 30%; left: 8%; animation-delay: 2s; }
        .element-4 { bottom: 20%; right: 12%; animation-delay: 3s; }
        .element-5 { top: 60%; left: 20%; animation-delay: 4s; }
        .element-6 { top: 40%; right: 25%; animation-delay: 5s; }
        .element-7 { top: 30%; left: 70%; animation-delay: 1.5s; }
        .element-8 { bottom: 60%; right: 30%; animation-delay: 2.5s; }
        .element-9 { top: 15%; left: 50%; animation-delay: 0.5s; }
        .element-10 { bottom: 40%; left: 60%; animation-delay: 3.5s; }
        .element-11 { top: 70%; right: 40%; animation-delay: 4.5s; }
        .element-12 { bottom: 10%; left: 40%; animation-delay: 1.8s; }

        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          25% { transform: translateY(-15px) scale(1.1); }
          50% { transform: translateY(-5px) scale(0.9); }
          75% { transform: translateY(-20px) scale(1.05); }
        }

        .empty-state-content {
          text-align: center;
          max-width: 700px;
          padding: var(--space-8);
          position: relative;
          z-index: 1;
        }

        .hero-section {
          margin-bottom: var(--space-10);
        }

        .mascot-container {
          position: relative;
          display: inline-block;
          margin-bottom: var(--space-6);
        }

        .mascot-image {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid var(--brand);
          box-shadow: var(--shadow-lg);
          animation: gentle-bounce 3s ease-in-out infinite;
          object-fit: cover;
        }

        .mascot-sparkle {
          position: absolute;
          top: -5px;
          right: -5px;
          background-color: var(--brand);
          color: white;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-md);
          animation: sparkle-pulse 2s ease-in-out infinite;
        }

        .mascot-wave {
          position: absolute;
          top: -10px;
          left: -10px;
          font-size: 24px;
          animation: wave 2s ease-in-out infinite;
        }

        .quick-actions {
          display: flex;
          gap: var(--space-4);
          justify-content: center;
          margin-top: var(--space-6);
          flex-wrap: wrap;
        }

        .primary-cta-btn {
          background: linear-gradient(135deg, var(--brand) 0%, var(--brand-600) 100%);
          border: none;
          box-shadow: var(--shadow-lg);
          animation: subtle-glow 2s ease-in-out infinite alternate;
        }

        .secondary-cta-btn {
          border: 2px solid var(--brand);
          color: var(--brand);
          background: transparent;
        }

        .secondary-cta-btn:hover {
          background: var(--brand);
          color: white;
          transform: translateY(-2px);
        }

        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes sparkle-pulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.1) rotate(180deg); }
        }

        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }

        .hero-title {
          font-size: var(--text-4xl);
          font-weight: var(--font-bold);
          color: var(--text);
          margin: 0 0 var(--space-4) 0;
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: var(--text-lg);
          color: var(--text-muted);
          margin: 0;
          line-height: 1.5;
          max-width: 500px;
          margin: 0 auto;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-6);
          margin-bottom: var(--space-10);
        }

        .benefit-card {
          background-color: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(21, 181, 107, 0.2);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          transition: all var(--transition-fast);
          position: relative;
          overflow: hidden;
        }

        [data-theme="dark"] .benefit-card {
          background-color: rgba(0, 0, 0, 0.3);
          border-color: var(--border);
        }

        .benefit-card:hover,
        .benefit-card.hovered {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--brand);
          background-color: rgba(255, 255, 255, 0.95);
        }

        [data-theme="dark"] .benefit-card:hover,
        [data-theme="dark"] .benefit-card.hovered {
          background-color: rgba(0, 0, 0, 0.5);
        }

        .benefit-highlight {
          font-size: var(--text-sm);
          color: var(--brand);
          font-weight: var(--font-semibold);
          margin-top: var(--space-2);
          opacity: 0;
          transform: translateY(10px);
          transition: all var(--transition-fast);
        }

        .benefit-card:hover .benefit-highlight,
        .benefit-card.hovered .benefit-highlight {
          opacity: 1;
          transform: translateY(0);
        }

        .benefit-icon {
          width: 48px;
          height: 48px;
          background-color: var(--brand);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-4) auto;
        }

        .benefit-card h3 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .benefit-card p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }

        .features-showcase {
          background-color: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(21, 181, 107, 0.2);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          margin-bottom: var(--space-8);
        }

        [data-theme="dark"] .features-showcase {
          background-color: rgba(0, 0, 0, 0.2);
          border-color: var(--border);
        }

        .showcase-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-4) 0;
          text-align: center;
        }

        .features-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background-color: rgba(255, 255, 255, 0.8);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        [data-theme="dark"] .feature-item {
          background-color: rgba(0, 0, 0, 0.3);
        }

        .feature-item:hover {
          transform: translateX(4px);
          background-color: rgba(255, 255, 255, 0.95);
        }

        [data-theme="dark"] .feature-item:hover {
          background-color: rgba(0, 0, 0, 0.5);
        }

        .feature-icon {
          width: 32px;
          height: 32px;
          background-color: var(--brand);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .feature-item span {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        .cta-section {
          margin-bottom: var(--space-8);
        }

        .cta-buttons {
          display: flex;
          gap: var(--space-4);
          justify-content: center;
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
        }

        .create-plan-btn {
          font-size: var(--text-lg);
          padding: var(--space-5) var(--space-10);
          animation: subtle-glow 2s ease-in-out infinite alternate;
          border-radius: var(--radius-xl);
          font-weight: var(--font-semibold);
          position: relative;
          overflow: hidden;
        }

        .demo-btn {
          font-size: var(--text-lg);
          padding: var(--space-5) var(--space-10);
          border-radius: var(--radius-xl);
          font-weight: var(--font-semibold);
        }

        .create-plan-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }

        .create-plan-btn:hover::before {
          left: 100%;
        }

        @keyframes subtle-glow {
          from { box-shadow: var(--shadow-md); }
          to { box-shadow: var(--shadow-lg), 0 0 20px rgba(21, 181, 107, 0.3); }
        }

        .cta-subtitle {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
          font-style: italic;
        }

        .quick-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
          padding: var(--space-4) var(--space-6);
          background-color: rgba(255, 255, 255, 0.6);
          border-radius: var(--radius-lg);
          border: 1px solid rgba(21, 181, 107, 0.2);
        }

        [data-theme="dark"] .quick-stats {
          background-color: rgba(0, 0, 0, 0.2);
          border-color: var(--border);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1);
        }

        .stat-number {
          font-size: var(--text-lg);
          font-weight: var(--font-bold);
          color: var(--brand);
        }

        .stat-label {
          font-size: var(--text-xs);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-divider {
          color: var(--text-muted);
          font-weight: var(--font-bold);
        }

        .quick-tips {
          background-color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(21, 181, 107, 0.2);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          margin-bottom: var(--space-8);
        }

        [data-theme="dark"] .quick-tips {
          background-color: rgba(0, 0, 0, 0.3);
          border-color: var(--border);
        }

        .tips-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-4) 0;
          text-align: center;
        }

        .tips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
        }

        .tip-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background-color: rgba(255, 255, 255, 0.8);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
        }

        [data-theme="dark"] .tip-item {
          background-color: rgba(0, 0, 0, 0.3);
        }

        .tip-item:hover {
          transform: translateX(4px);
          background-color: rgba(255, 255, 255, 0.95);
        }

        [data-theme="dark"] .tip-item:hover {
          background-color: rgba(0, 0, 0, 0.5);
        }

        @media (max-width: 768px) {
          .empty-state-content {
            padding: var(--space-6);
          }

          .hero-title {
            font-size: var(--text-3xl);
          }

          .hero-subtitle {
            font-size: var(--text-base);
          }

          .benefits-grid {
            grid-template-columns: 1fr;
            gap: var(--space-4);
          }

          .tips-grid {
            grid-template-columns: 1fr;
            gap: var(--space-2);
          }

          .quick-stats {
            flex-wrap: wrap;
            gap: var(--space-3);
          }

          .create-plan-btn {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .mascot-image {
            width: 100px;
            height: 100px;
          }

          .hero-title {
            font-size: var(--text-2xl);
          }

          .stat-item {
            min-width: 60px;
          }

          .tip-item {
            font-size: var(--text-xs);
            padding: var(--space-2);
          }
        }
      `}</style>
    </div>
  )
}

function getFloatingIcon(index: number): React.ReactNode {
  const icons = [
    <Calendar key={index} size={20} />,
    <ChefHat key={index} size={18} />,
    <Heart key={index} size={16} />,
    <Sparkles key={index} size={22} />,
    <Zap key={index} size={18} />,
    <Target key={index} size={16} />,
    <Users key={index} size={18} />,
    <Clock key={index} size={16} />,
    '🍎',
    '🥗',
    '🍳',
    '🥑'
  ]
  
  return icons[index % icons.length]
}
