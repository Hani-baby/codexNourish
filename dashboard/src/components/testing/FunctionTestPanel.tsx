'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { LoaderIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'
import { createMealPlan, createMealPlanWithProgress } from '@/lib/meal-plan-service'
import { generateAIRecipe } from '@/lib/recipe-service'
import { generateGroceryListFromMealPlan } from '@/lib/grocery-service'

interface TestResult {
  function: string
  status: 'pending' | 'success' | 'error'
  message: string
  data?: any
}

export function FunctionTestPanel() {
  const [results, setResults] = useState<TestResult[]>([])
  const [testing, setTesting] = useState(false)
  
  // Test data
  const [mealPlanData, setMealPlanData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    preferences: 'Healthy, Mediterranean-inspired meals'
  })

  const [recipeData, setRecipeData] = useState({
    title: 'Grilled Salmon with Quinoa',
    description: 'A healthy, protein-rich dinner with omega-3 fatty acids',
    mealType: 'dinner'
  })

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result])
  }

  const testMealPlanGeneration = async () => {
    addResult({
      function: 'Meal Plan Generation (orchestrator)',
      status: 'pending',
      message: 'Testing comprehensive meal plan generation...'
    })

    try {
      const mealPlan = await createMealPlanWithProgress({
        meal_plan_range: {
          start_date: mealPlanData.startDate,
          end_date: mealPlanData.endDate
        },
        user_preferences: mealPlanData.preferences,
        use_preferences: true
      }, (update) => {
        // Update the result with progress
        setResults(prev => prev.map(result => 
          result.function === 'Meal Plan Generation (meal-builder)' && result.status === 'pending'
            ? { ...result, message: update.message }
            : result
        ))
      })

      addResult({
        function: 'Meal Plan Generation (orchestrator)',
        status: 'success',
        message: `Successfully created comprehensive meal plan: ${mealPlan.title}`,
        data: mealPlan
      })
    } catch (error: any) {
      addResult({
        function: 'Meal Plan Generation (orchestrator)',
        status: 'error',
        message: `Failed: ${error.message}`
      })
    }
  }

  const testRecipeGeneration = async () => {
    addResult({
      function: 'Recipe Generation',
      status: 'pending',
      message: 'Testing recipe generation...'
    })

    try {
      const recipe = await generateAIRecipe({
        title: recipeData.title,
        description: recipeData.description,
        meal_type: recipeData.mealType
      })

      addResult({
        function: 'Recipe Generation',
        status: 'success',
        message: `Successfully created recipe: ${recipe.title}`,
        data: recipe
      })
    } catch (error: any) {
      addResult({
        function: 'Recipe Generation',
        status: 'error',
        message: `Failed: ${error.message}`
      })
    }
  }

  const testRecipeAssignerTools = async () => {
    addResult({
      function: 'Recipe Assigner Tools',
      status: 'pending',
      message: 'Testing new tool-based recipe assignment...'
    })

    try {
      // Test the recipe assigner with a simple meal plan
      const testDraft = {
        meal_plan_range: {
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        user_preferences: 'Healthy meals, no nuts, vegetarian-friendly',
        use_preferences: true
      }
      
      const result = await createMealPlanWithProgress(testDraft, (update) => {
        setResults(prev => prev.map(result => 
          result.function === 'Recipe Assigner Tools' && result.status === 'pending'
            ? { ...result, message: update.message }
            : result
        ))
      })
      
      // Check if the result contains recipe assignments
      const hasAssignments = result.assignments && result.assignments.length > 0
      const hasAiToolsSource = result.assignments?.some((a: any) => a.source === 'ai_tools')
      
      addResult({
        function: 'Recipe Assigner Tools',
        status: 'success',
        message: `Recipe assignment completed. Found ${result.assignments?.length || 0} assignments. AI tools used: ${hasAiToolsSource ? 'Yes' : 'No'}`,
        data: {
          assignments: result.assignments,
          hasAiToolsSource,
          totalAssignments: result.assignments?.length || 0
        }
      })
    } catch (error: any) {
      addResult({
        function: 'Recipe Assigner Tools',
        status: 'error',
        message: `Failed: ${error.message}`
      })
    }
  }

  const testNourishPlanner = async () => {
    addResult({
      function: 'Nourish Planner (structure only)',
      status: 'pending',
      message: 'Testing meal plan structure generation...'
    })

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nourish-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          preferences: {
            user_settings: {
              dietary_restrictions: ['vegetarian'],
              allergies: [],
              cuisine_preferences: ['mediterranean'],
              cooking_skill_level: 'intermediate',
              meal_prep_time: '30 minutes'
            },
            nutrition_goals: {
              daily_calories: 2000,
              protein_grams: 150
            },
            session_preferences: mealPlanData.preferences
          },
          meal_plan_range: {
            start_date: mealPlanData.startDate,
            end_date: mealPlanData.endDate
          }
        })
      })

      const result = await response.json()

      if (response.ok) {
        addResult({
          function: 'Nourish Planner (structure only)',
          status: 'success',
          message: `Successfully generated meal plan structure with ${result.total_days} days`,
          data: result
        })
      } else {
        addResult({
          function: 'Nourish Planner (structure only)',
          status: 'error',
          message: `Failed: ${result.error || 'Unknown error'}`
        })
      }
    } catch (error: any) {
      addResult({
        function: 'Nourish Planner (structure only)',
        status: 'error',
        message: `Failed: ${error.message}`
      })
    }
  }

  const testGroceryListGeneration = async () => {
    addResult({
      function: 'Grocery List Generation',
      status: 'pending',
      message: 'Testing grocery list generation...'
    })

    try {
      // First create a meal plan, then generate grocery list
      const mealPlan = await createMealPlan({
        meal_plan_range: {
          start_date: mealPlanData.startDate,
          end_date: mealPlanData.endDate
        },
        user_preferences: mealPlanData.preferences,
        use_preferences: true
      })

      const groceryList = await generateGroceryListFromMealPlan(mealPlan.id)

      addResult({
        function: 'Grocery List Generation',
        status: 'success',
        message: `Successfully created grocery list with ${groceryList.grocery_list_id}`,
        data: groceryList
      })
    } catch (error: any) {
      addResult({
        function: 'Grocery List Generation',
        status: 'error',
        message: `Failed: ${error.message}`
      })
    }
  }

  const runAllTests = async () => {
    setTesting(true)
    setResults([])

    await testNourishPlanner()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await testMealPlanGeneration()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await testRecipeGeneration()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await testRecipeAssignerTools()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await testGroceryListGeneration()

    setTesting(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <LoaderIcon className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircleIcon className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Testing</Badge>
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Supabase Function Integration Test</CardTitle>
          <CardDescription>
            Test the connection between UI components and Supabase functions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Controls */}
          <div className="flex gap-4">
            <Button 
              onClick={runAllTests} 
              disabled={testing}
              className="flex-1"
            >
              {testing ? 'Running Tests...' : 'Run All Tests'}
            </Button>
            <Button 
              onClick={() => setResults([])} 
              variant="outline"
              disabled={testing}
            >
              Clear Results
            </Button>
          </div>

          {/* Individual Test Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Button 
              onClick={testNourishPlanner} 
              disabled={testing}
              variant="outline"
            >
              Test Nourish Planner
            </Button>
            <Button 
              onClick={testMealPlanGeneration} 
              disabled={testing}
              variant="outline"
            >
              Test Meal Builder
            </Button>
            <Button 
              onClick={testRecipeGeneration} 
              disabled={testing}
              variant="outline"
            >
              Test Recipe
            </Button>
            <Button 
              onClick={testRecipeAssignerTools} 
              disabled={testing}
              variant="outline"
            >
              Test Recipe Assigner Tools
            </Button>
            <Button 
              onClick={testGroceryListGeneration} 
              disabled={testing}
              variant="outline"
            >
              Test Grocery List
            </Button>
          </div>

          {/* Test Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Meal Plan Test Data</h3>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={mealPlanData.startDate}
                  onChange={(e) => setMealPlanData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={mealPlanData.endDate}
                  onChange={(e) => setMealPlanData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferences">Preferences</Label>
                <Textarea
                  id="preferences"
                  value={mealPlanData.preferences}
                  onChange={(e) => setMealPlanData(prev => ({ ...prev, preferences: e.target.value }))}
                  placeholder="Describe your meal preferences..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Recipe Test Data</h3>
              <div className="space-y-2">
                <Label htmlFor="recipeTitle">Recipe Title</Label>
                <Input
                  id="recipeTitle"
                  value={recipeData.title}
                  onChange={(e) => setRecipeData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipeDescription">Description</Label>
                <Textarea
                  id="recipeDescription"
                  value={recipeData.description}
                  onChange={(e) => setRecipeData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mealType">Meal Type</Label>
                <Input
                  id="mealType"
                  value={recipeData.mealType}
                  onChange={(e) => setRecipeData(prev => ({ ...prev, mealType: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Test Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Test Results</h3>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          <span className="font-medium">{result.function}</span>
                        </div>
                        {getStatusBadge(result.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                      {result.data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View Response Data
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
