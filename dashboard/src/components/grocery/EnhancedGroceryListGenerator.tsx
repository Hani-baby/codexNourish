import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import GenerationView from '../ui/GenerationView'
import { 
  ShoppingCart, 
  Package, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  Settings,
  ExternalLink,
  Loader,
  RefreshCw,
  Target
} from 'lucide-react'
import { 
  generateEnhancedGroceryList, 
  GroceryListGenerationOptions,
  EnhancedGroceryList,
  generateGroceryListSummary 
} from '../../lib/enhanced-grocery-service'
import { getMealPlans } from '../../lib/data-services'

interface Props {
  householdId: string
  onGroceryListGenerated?: (groceryList: EnhancedGroceryList) => void
}

export default function EnhancedGroceryListGenerator({ householdId, onGroceryListGenerated }: Props) {
  const [mealPlans, setMealPlans] = useState<any[]>([])
  const [selectedMealPlan, setSelectedMealPlan] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerationScreen, setShowGenerationScreen] = useState(false)
  const [generatedList, setGeneratedList] = useState<EnhancedGroceryList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  
  // Advanced options state
  const [options, setOptions] = useState<Partial<GroceryListGenerationOptions>>({
    includePantryCheck: true,
    consolidateByCategory: true,
    createInstacartCart: false,
    autoOptimizeQuantities: true,
    minimumQuantityThreshold: 0.1
  })

  useEffect(() => {
    loadMealPlans()
  }, [householdId])

  const loadMealPlans = async () => {
    try {
      const { data } = await getMealPlans(householdId)
      setMealPlans(data || [])
      if (data && data.length > 0) {
        setSelectedMealPlan(data[0].id)
      }
    } catch (error) {
      console.error('Error loading meal plans:', error)
      setError('Failed to load meal plans')
    }
  }

  const handleGenerateGroceryList = async () => {
    if (!selectedMealPlan) {
      setError('Please select a meal plan')
      return
    }

    setIsGenerating(true)
    setShowGenerationScreen(true)
    setError(null)

    try {
      const generationOptions: GroceryListGenerationOptions = {
        mealPlanId: selectedMealPlan,
        householdId,
        title: `Grocery List - ${new Date().toLocaleDateString()}`,
        ...options
      }

      const groceryList = await generateEnhancedGroceryList(generationOptions)
      setGeneratedList(groceryList)
      onGroceryListGenerated?.(groceryList)
    } catch (error) {
      console.error('Error generating grocery list:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate grocery list')
    } finally {
      setIsGenerating(false)
      setShowGenerationScreen(false)
    }
  }

  const summary = generatedList ? generateGroceryListSummary(generatedList) : null

  return (
    <div className="space-y-6">
      {showGenerationScreen ? (
        <GenerationView
          isVisible={showGenerationScreen}
          title="Chef Nourish is cooking up your grocery list!"
          subtitle="Analyzing your meal plan and optimizing ingredients"
          estimatedTime="30-45 seconds"
        />
      ) : (
        <>
      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Generate Enhanced Grocery List
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meal Plan Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Meal Plan
            </label>
            <select 
              value={selectedMealPlan}
              onChange={(e) => setSelectedMealPlan(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isGenerating}
            >
              <option value="">Choose a meal plan...</option>
              {mealPlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.title} ({new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Options */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.includePantryCheck}
                onChange={(e) => setOptions(prev => ({ ...prev, includePantryCheck: e.target.checked }))}
                disabled={isGenerating}
                className="rounded"
              />
              <span className="text-sm">Check pantry inventory</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.createInstacartCart}
                onChange={(e) => setOptions(prev => ({ ...prev, createInstacartCart: e.target.checked }))}
                disabled={isGenerating}
                className="rounded"
              />
              <span className="text-sm">Create Instacart cart</span>
            </label>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <Settings className="w-4 h-4" />
            Advanced Options
          </button>

          {/* Advanced Options Panel */}
          {showAdvancedOptions && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={options.consolidateByCategory}
                    onChange={(e) => setOptions(prev => ({ ...prev, consolidateByCategory: e.target.checked }))}
                    disabled={isGenerating}
                    className="rounded"
                  />
                  <span className="text-sm">Consolidate by category</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={options.autoOptimizeQuantities}
                    onChange={(e) => setOptions(prev => ({ ...prev, autoOptimizeQuantities: e.target.checked }))}
                    disabled={isGenerating}
                    className="rounded"
                  />
                  <span className="text-sm">Auto-optimize quantities</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Minimum Quantity Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={options.minimumQuantityThreshold || 0.1}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    minimumQuantityThreshold: parseFloat(e.target.value) 
                  }))}
                  disabled={isGenerating}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Skip items below this quantity (e.g., 0.1 = 1/10 unit)
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerateGroceryList}
            disabled={!selectedMealPlan || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Generating Grocery List...
              </>
            ) : (
              <>
                <Target className="w-4 h-4 mr-2" />
                Generate Enhanced Grocery List
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {generatedList && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Grocery List Generated
              </span>
              {generatedList.instacart_cart_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(generatedList.instacart_cart_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open in Instacart
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Package className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                <div className="text-lg font-semibold text-blue-900">{summary.totalItems}</div>
                <div className="text-xs text-blue-700">Total Items</div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-600" />
                <div className="text-lg font-semibold text-green-900">{summary.pantrySavings}</div>
                <div className="text-xs text-green-700">Pantry Items</div>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <DollarSign className="w-6 h-6 mx-auto mb-1 text-yellow-600" />
                <div className="text-lg font-semibold text-yellow-900">
                  ${summary.estimatedCost.toFixed(2)}
                </div>
                <div className="text-xs text-yellow-700">Est. Cost</div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <RefreshCw className="w-6 h-6 mx-auto mb-1 text-purple-600" />
                <div className="text-lg font-semibold text-purple-900">
                  {generatedList.metadata.instacart_integration.match_success_rate 
                    ? `${Math.round(generatedList.metadata.instacart_integration.match_success_rate * 100)}%`
                    : 'N/A'
                  }
                </div>
                <div className="text-xs text-purple-700">Match Rate</div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="space-y-3">
              <h4 className="font-medium">Items by Category</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.itemsByCategory).map(([category, count]) => (
                  <Badge key={category} variant="outline">
                    {category}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Priority Breakdown */}
            <div className="space-y-3 mt-4">
              <h4 className="font-medium">Items by Priority</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.itemsByPriority).map(([priority, count]) => (
                  <Badge 
                    key={priority} 
                    variant={priority === 'high' ? 'destructive' : priority === 'medium' ? 'default' : 'secondary'}
                  >
                    {priority}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Validation Warnings */}
            {generatedList.metadata.validation_results.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {generatedList.metadata.validation_results.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success Message */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">
                ✅ Successfully generated grocery list with {summary.totalItems} items
                {summary.pantrySavings > 0 && ` (${summary.pantrySavings} items available in pantry)`}
                {generatedList.instacart_cart_id && ' and created Instacart cart'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  )
}
