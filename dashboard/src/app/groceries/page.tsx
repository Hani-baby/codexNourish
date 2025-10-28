import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Tabs from '../../components/ui/Tabs'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import AnimatedCard, { createStaggeredDelay } from '../../components/ui/AnimatedCard'
import { Plus, Filter, ShoppingCart, DollarSign, Package, TrendingUp, X, Target, Archive } from 'lucide-react'
import { getUserGroceryLists } from '../../lib/grocery-service'
import { mockGroceryList } from '../../lib/mockData' // Fallback for demo when real data is not available
import EnhancedGroceryListGenerator from '../../components/grocery/EnhancedGroceryListGenerator'
import EnhancedGroceryListViewer from '../../components/grocery/EnhancedGroceryListViewer'
import PantryInventoryManager from '../../components/grocery/PantryInventoryManager'
import { EnhancedGroceryList } from '../../lib/enhanced-grocery-service'

const tabs = [
  { id: 'generator', label: 'Generate List' },
  { id: 'current', label: 'Current List' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'history', label: 'History' }
]

const categories = ['Produce', 'Protein', 'Dairy', 'Pantry']

export default function Groceries() {
  const [activeTab, setActiveTab] = useState('generator')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    new Set(mockGroceryList.filter(item => item.checked).map(item => item.id))
  )
  const [showSuggestion, setShowSuggestion] = useState(true)
  const [currentGroceryList, setCurrentGroceryList] = useState<EnhancedGroceryList | null>(null)
  const [householdId, setHouseholdId] = useState<string>('demo-household-123') // This would come from auth context

  const toggleCheck = (itemId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const groupedItems = categories.reduce((acc, category) => {
    acc[category] = mockGroceryList.filter(item => item.category === category)
    return acc
  }, {} as Record<string, typeof mockGroceryList>)

  const totalItems = mockGroceryList.length
  const checkedCount = checkedItems.size
  const totalCost = mockGroceryList.reduce((sum, item) => sum + item.price, 0)

  return (
    <div className="groceries-page">
      {/* Action Bar */}
      <div className="action-bar">
        <div className="action-buttons">
          <Button variant="outline" leftIcon={<Filter size={16} />}>
            Filters
          </Button>
          <Button leftIcon={<Plus size={16} />}>
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <StatCard
          title="Items to Buy"
          value={`${totalItems - checkedCount}/${totalItems}`}
          delta={{ value: -3, label: 'vs last week', trend: 'down' }}
          icon={<ShoppingCart size={20} />}
        />
        <StatCard
          title="Estimated Cost"
          value={`$${totalCost.toFixed(2)}`}
          delta={{ value: 8, label: 'vs last week', trend: 'up' }}
          icon={<DollarSign size={20} />}
        />
        <StatCard
          title="Upcoming Orders"
          value="2"
          delta={{ value: 1, label: 'this week', trend: 'up' }}
          icon={<Package size={20} />}
        />
        <StatCard
          title="This Month's Spend"
          value="$347"
          delta={{ value: -12, label: 'vs last month', trend: 'down' }}
          icon={<TrendingUp size={20} />}
        />
      </div>

      {/* Smart Suggestion Banner */}
      {showSuggestion && (
        <div className="suggestion-banner">
          <div className="suggestion-content">
                            <div className="suggestion-mascot">
                  <img src="/images/mascot.png" alt="Nourish Mascot" />
                </div>
            <div className="suggestion-text">
              <h3>Smart Suggestion</h3>
              <p>Based on your meal plan, you're running low on protein sources. Consider lentils or chickpeas.</p>
            </div>
          </div>
          <div className="suggestion-actions">
            <Button size="sm" variant="outline">Add Lentils</Button>
            <Button size="sm" variant="outline">Add Chickpeas</Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setShowSuggestion(false)}
              leftIcon={<X size={14} />}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        defaultTab="generator"
        onTabChange={setActiveTab}
        variant="underline"
      />

      {/* Generate List Tab */}
      {activeTab === 'generator' && (
        <EnhancedGroceryListGenerator
          householdId={householdId}
          onGroceryListGenerated={(groceryList) => {
            setCurrentGroceryList(groceryList)
            setActiveTab('current')
          }}
        />
      )}

      {/* Current List */}
      {activeTab === 'current' && (
        <div className="current-list-container">
          {currentGroceryList ? (
            <EnhancedGroceryListViewer
              groceryList={currentGroceryList}
              onItemStatusUpdate={(ingredientId, status) => {
                console.log('Item status updated:', ingredientId, status)
                // Handle item status updates
              }}
              onInstacartOpen={() => {
                console.log('Instacart opened')
                // Track Instacart integration usage
              }}
            />
          ) : (
            <div className="empty-list-state">
              <Card>
                <CardContent className="text-center py-12">
                  <Target className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Grocery List Yet</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Generate an enhanced grocery list from your meal plan to get started with smart shopping.
                  </p>
                  <Button onClick={() => setActiveTab('generator')}>
                    <Target className="w-4 h-4 mr-2" />
                    Generate Grocery List
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Pantry Tab */}
      {activeTab === 'pantry' && (
        <PantryInventoryManager householdId={householdId} />
      )}


      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="history-section">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="w-5 h-5" />
                Grocery List History
              </CardTitle>
              <CardDescription>View and recreate your previous grocery lists</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="empty-history-state">
                <div className="text-center py-8">
                  <Archive className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No History Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Your grocery list history will appear here once you start generating lists.
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('generator')}>
                    Generate Your First List
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <style jsx>{`
        .groceries-page {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .action-bar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: var(--space-4);
        }

        .action-buttons {
          display: flex;
          gap: var(--space-3);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .suggestion-banner {
          background: linear-gradient(135deg, var(--brand-100) 0%, var(--accent) 100%);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-6);
        }

        [data-theme="dark"] .suggestion-banner {
          background: linear-gradient(135deg, rgba(21, 181, 107, 0.1) 0%, rgba(255, 176, 32, 0.1) 100%);
        }

        .suggestion-content {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          flex: 1;
        }

        .suggestion-mascot {
          width: 32px;
          height: 32px;
          animation: bounce 2s infinite;
        }

        .suggestion-mascot img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }

        .suggestion-text h3 {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
        }

        .suggestion-text p {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }

        .suggestion-actions {
          display: flex;
          gap: var(--space-2);
          flex-shrink: 0;
        }

        .current-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--space-6);
        }

        .category-card {
          height: fit-content;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .grocery-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3);
          background-color: var(--panel-2);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .grocery-item:hover {
          background-color: var(--hover-bg);
        }

        .item-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
        }

        .item-checkbox {
          width: 18px;
          height: 18px;
          accent-color: var(--brand);
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .item-name {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
          transition: all var(--transition-fast);
        }

        .item-name.checked {
          text-decoration: line-through;
          color: var(--text-muted);
        }

        .item-quantity {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .item-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .item-price {
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          color: var(--text);
        }

        .integration-placeholder {
          display: flex;
          justify-content: center;
          padding: var(--space-12);
        }

        .placeholder-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-4);
          text-align: center;
          max-width: 400px;
        }

        .placeholder-content svg {
          color: var(--text-muted);
        }

        .placeholder-content h3 {
          font-size: var(--text-xl);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .placeholder-content p {
          font-size: var(--text-base);
          color: var(--text-muted);
          margin: 0;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .history-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--space-4);
        }

        @media (max-width: 767px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions {
            justify-content: stretch;
          }

          .suggestion-banner {
            flex-direction: column;
            text-align: center;
          }

          .suggestion-actions {
            flex-wrap: wrap;
            justify-content: center;
          }

          .current-list {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .history-header {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  )
}
