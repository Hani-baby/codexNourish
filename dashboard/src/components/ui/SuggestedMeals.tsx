import React from 'react'
import { Clock, Zap } from 'lucide-react'

interface SuggestedMeal {
  id: string
  name: string
  calories: number
  time: string
  difficulty: string
  image: string
  tags: string[]
}

interface SuggestedMealsProps {
  meals: SuggestedMeal[]
  onMealClick?: (meal: SuggestedMeal) => void
}

export default function SuggestedMeals({ meals, onMealClick }: SuggestedMealsProps) {
  return (
    <div className="suggested-meals">
      <div className="suggested-header">
        <h3 className="suggested-title">Chef Nourish suggests these meals</h3>
        <p className="suggested-subtitle">Quick and delicious options for today</p>
      </div>
      
      <div className="meals-grid">
        {meals.map((meal) => (
          <div 
            key={meal.id} 
            className="meal-card"
            onClick={() => onMealClick?.(meal)}
          >
            <div className="meal-image">
              <img src={meal.image} alt={meal.name} />
              <div className="meal-overlay">
                <div className="meal-difficulty">{meal.difficulty}</div>
              </div>
            </div>
            
            <div className="meal-content">
              <h4 className="meal-name">{meal.name}</h4>
              
              <div className="meal-meta">
                <div className="meal-time">
                  <Clock size={14} />
                  <span>{meal.time}</span>
                </div>
                <div className="meal-calories">
                  <Zap size={14} />
                  <span>{meal.calories} cal</span>
                </div>
              </div>
              
              <div className="meal-tags">
                {meal.tags.map((tag, index) => (
                  <span key={index} className="meal-tag">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .suggested-meals {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .suggested-header {
          text-align: center;
        }

        .suggested-title {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-2) 0;
        }

        .suggested-subtitle {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .meals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--space-4);
        }

        .meal-card {
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .meal-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
          border-color: var(--brand);
        }

        .meal-image {
          position: relative;
          height: 160px;
          overflow: hidden;
        }

        .meal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform var(--transition-fast);
        }

        .meal-card:hover .meal-image img {
          transform: scale(1.05);
        }

        .meal-overlay {
          position: absolute;
          top: var(--space-3);
          right: var(--space-3);
        }

        .meal-difficulty {
          background-color: var(--brand);
          color: white;
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          text-transform: uppercase;
        }

        .meal-content {
          padding: var(--space-4);
        }

        .meal-name {
          font-size: var(--text-base);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-3) 0;
          line-height: 1.3;
        }

        .meal-meta {
          display: flex;
          gap: var(--space-4);
          margin-bottom: var(--space-3);
        }

        .meal-time,
        .meal-calories {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .meal-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .meal-tag {
          background-color: var(--brand-100);
          color: var(--brand);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
        }

        [data-theme="dark"] .meal-tag {
          background-color: rgba(21, 181, 107, 0.1);
        }

        @media (max-width: 767px) {
          .meals-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
