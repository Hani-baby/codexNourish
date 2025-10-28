import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { 
  ShoppingCart, 
  Package, 
  CheckCircle2,
  Circle,
  AlertTriangle,
  Info,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  SortAsc,
  Clock,
  MapPin
} from 'lucide-react'
import { 
  EnhancedGroceryList, 
  AggregatedGroceryItem,
  updateGroceryListItemStatus 
} from '../../lib/enhanced-grocery-service'
import { formatQuantityForDisplay } from '../../lib/unit-conversion-service'

interface Props {
  groceryList: EnhancedGroceryList
  onItemStatusUpdate?: (ingredientId: string, status: string) => void
  onInstacartOpen?: () => void
}

type FilterType = 'all' | 'needed' | 'pantry' | 'high-priority'
type SortType = 'name' | 'priority' | 'category' | 'quantity'

export default function EnhancedGroceryListViewer({ 
  groceryList, 
  onItemStatusUpdate,
  onInstacartOpen 
}: Props) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortType>('priority')
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set())
  const [showPantryItems, setShowPantryItems] = useState(true)

  const toggleItemCheck = (ingredientId: string) => {
    const newCheckedItems = new Set(checkedItems)
    if (newCheckedItems.has(ingredientId)) {
      newCheckedItems.delete(ingredientId)
    } else {
      newCheckedItems.add(ingredientId)
    }
    setCheckedItems(newCheckedItems)
    onItemStatusUpdate?.(ingredientId, newCheckedItems.has(ingredientId) ? 'in_cart' : 'needed')
  }

  const toggleDetails = (ingredientId: string) => {
    const newShowDetails = new Set(showDetails)
    if (newShowDetails.has(ingredientId)) {
      newShowDetails.delete(ingredientId)
    } else {
      newShowDetails.add(ingredientId)
    }
    setShowDetails(newShowDetails)
  }

  // Filter items based on selected filter
  const filteredItems = groceryList.items.filter(item => {
    if (!showPantryItems && item.pantry_status === 'sufficient') return false
    
    switch (filter) {
      case 'needed':
        return item.pantry_status === 'none' || item.pantry_status === 'partial'
      case 'pantry':
        return item.pantry_status === 'sufficient'
      case 'high-priority':
        return item.priority === 'high'
      default:
        return true
    }
  })

  // Sort items based on selected sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.ingredient_name.localeCompare(b.ingredient_name)
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      case 'category':
        return (a.category || '').localeCompare(b.category || '')
      case 'quantity':
        return b.display_quantity - a.display_quantity
      default:
        return 0
    }
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getPantryStatusIcon = (status: string) => {
    switch (status) {
      case 'sufficient':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      default:
        return <Circle className="w-4 h-4 text-gray-400" />
    }
  }

  const checkedCount = checkedItems.size
  const totalNeededItems = groceryList.items.filter(item => 
    item.pantry_status === 'none' || item.pantry_status === 'partial'
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {groceryList.title}
            </CardTitle>
            {groceryList.instacart_cart_url && (
              <Button
                variant="outline"
                onClick={() => {
                  window.open(groceryList.instacart_cart_url, '_blank')
                  onInstacartOpen?.()
                }}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open in Instacart
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Shopping Progress</span>
              <span>{checkedCount} / {totalNeededItems} items</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${totalNeededItems > 0 ? (checkedCount / totalNeededItems) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="font-semibold text-lg">{groceryList.total_items}</div>
              <div className="text-gray-600">Total Items</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-green-600">{groceryList.pantry_savings_count}</div>
              <div className="text-gray-600">In Pantry</div>
            </div>
            <div>
              <div className="font-semibold text-lg">${groceryList.total_estimated_cost?.toFixed(2) || '0.00'}</div>
              <div className="text-gray-600">Est. Cost</div>
            </div>
            <div>
              <div className="font-semibold text-lg">
                {groceryList.metadata.instacart_integration.match_success_rate 
                  ? `${Math.round(groceryList.metadata.instacart_integration.match_success_rate * 100)}%`
                  : 'N/A'
                }
              </div>
              <div className="text-gray-600">Match Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Items</option>
                <option value="needed">Need to Buy</option>
                <option value="pantry">In Pantry</option>
                <option value="high-priority">High Priority</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4" />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="priority">Priority</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="quantity">Quantity</option>
              </select>
            </div>

            {/* Show Pantry Toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showPantryItems}
                onChange={(e) => setShowPantryItems(e.target.checked)}
                className="rounded"
              />
              Show pantry items
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-3">
        {sortedItems.map(item => (
          <Card key={item.ingredient_id} className="transition-all hover:shadow-md">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleItemCheck(item.ingredient_id)}
                  className="mt-1 flex-shrink-0"
                  disabled={item.pantry_status === 'sufficient'}
                >
                  {checkedItems.has(item.ingredient_id) ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`font-medium ${checkedItems.has(item.ingredient_id) ? 'line-through text-gray-500' : ''}`}>
                        {item.ingredient_name}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-semibold text-blue-600">
                          {formatQuantityForDisplay(item.display_quantity, item.display_unit)}
                        </span>
                        
                        {/* Priority Badge */}
                        <Badge className={`text-xs ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </Badge>
                        
                        {/* Category Badge */}
                        {item.category && (
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Pantry Status & Actions */}
                    <div className="flex items-center gap-2">
                      {getPantryStatusIcon(item.pantry_status)}
                      <button
                        onClick={() => toggleDetails(item.ingredient_id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {showDetails.has(item.ingredient_id) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Pantry Status Info */}
                  {item.pantry_status !== 'none' && (
                    <div className="mt-2 text-sm">
                      {item.pantry_status === 'sufficient' && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Available in pantry</span>
                        </div>
                      )}
                      {item.pantry_status === 'partial' && (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Partially available - need more</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <div className="mt-2 text-sm text-gray-600 flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{item.notes}</span>
                    </div>
                  )}

                  {/* Detailed View */}
                  {showDetails.has(item.ingredient_id) && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-3">
                      {/* Used in Recipes */}
                      {item.used_in_recipes.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm mb-2">Used in recipes:</h4>
                          <div className="space-y-1">
                            {item.used_in_recipes.map((recipe, index) => (
                              <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                <span>{recipe.recipe_title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {recipe.meal_date} - {recipe.meal_type}
                                </Badge>
                                <span className="text-xs">
                                  ({formatQuantityForDisplay(recipe.quantity, recipe.unit)})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quantity Breakdown */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {item.total_needed_g && (
                          <div>
                            <span className="font-medium">Total needed:</span>
                            <span className="ml-1">{item.total_needed_g}g</span>
                          </div>
                        )}
                        {item.total_needed_ml && (
                          <div>
                            <span className="font-medium">Total needed:</span>
                            <span className="ml-1">{item.total_needed_ml}ml</span>
                          </div>
                        )}
                        {item.pantry_available_g && (
                          <div>
                            <span className="font-medium">In pantry:</span>
                            <span className="ml-1">{item.pantry_available_g}g</span>
                          </div>
                        )}
                        {item.pantry_available_ml && (
                          <div>
                            <span className="font-medium">In pantry:</span>
                            <span className="ml-1">{item.pantry_available_ml}ml</span>
                          </div>
                        )}
                        {item.deficit_g && (
                          <div>
                            <span className="font-medium">Need to buy:</span>
                            <span className="ml-1 text-red-600">{item.deficit_g}g</span>
                          </div>
                        )}
                        {item.deficit_ml && (
                          <div>
                            <span className="font-medium">Need to buy:</span>
                            <span className="ml-1 text-red-600">{item.deficit_ml}ml</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {sortedItems.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'No items in this grocery list' 
                : `No items match the current filter: ${filter}`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
