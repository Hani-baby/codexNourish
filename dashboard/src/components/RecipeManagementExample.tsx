import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Eye } from 'lucide-react'
import { RecipeDeletionDialog, useRecipeDeletion } from './RecipeDeletionDialog'

// Example recipe interface
interface Recipe {
  id: string
  title: string
  description?: string
  prep_time?: number
  cook_time?: number
  servings: number
  difficulty?: 'easy' | 'medium' | 'hard'
  cuisine?: string
  tags?: string[]
  created_at: string
}

interface RecipeManagementExampleProps {
  recipes: Recipe[]
  onEditRecipe: (recipeId: string) => void
  onViewRecipe: (recipeId: string) => void
  onRefreshRecipes: () => void
}

export function RecipeManagementExample({
  recipes,
  onEditRecipe,
  onViewRecipe,
  onRefreshRecipes
}: RecipeManagementExampleProps) {
  const {
    isDialogOpen,
    selectedRecipe,
    openDeletionDialog,
    closeDeletionDialog,
    handleRecipeDeleted
  } = useRecipeDeletion()

  const handleDeleteClick = (recipe: Recipe) => {
    openDeletionDialog(recipe.id, recipe.title)
  }

  const handleRecipeDeletedSuccessfully = () => {
    handleRecipeDeleted()
    onRefreshRecipes() // Refresh the recipe list
  }

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'N/A'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Recipes</h2>
        <Badge variant="outline">{recipes.length} recipes</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => (
          <Card key={recipe.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg line-clamp-2">{recipe.title}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewRecipe(recipe.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditRecipe(recipe.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(recipe)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {recipe.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {recipe.description}
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prep Time:</span>
                  <span>{formatTime(recipe.prep_time)}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cook Time:</span>
                  <span>{formatTime(recipe.cook_time)}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Servings:</span>
                  <span>{recipe.servings}</span>
                </div>
                
                {recipe.difficulty && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Difficulty:</span>
                    <Badge className={getDifficultyColor(recipe.difficulty)}>
                      {recipe.difficulty}
                    </Badge>
                  </div>
                )}
                
                {recipe.cuisine && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cuisine:</span>
                    <Badge variant="outline">{recipe.cuisine}</Badge>
                  </div>
                )}
              </div>

              {recipe.tags && recipe.tags.length > 0 && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {recipe.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{recipe.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Created {new Date(recipe.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recipes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-lg font-medium">No recipes yet</h3>
            <p className="text-sm">Start by creating your first recipe!</p>
          </div>
        </div>
      )}

      {/* Recipe Deletion Dialog */}
      <RecipeDeletionDialog
        isOpen={isDialogOpen}
        onClose={closeDeletionDialog}
        recipeId={selectedRecipe?.id || ''}
        recipeTitle={selectedRecipe?.title || ''}
        onDeleted={handleRecipeDeletedSuccessfully}
      />
    </div>
  )
}

// Example usage in a parent component
export function RecipeManagementPage() {
  const [recipes, setRecipes] = React.useState<Recipe[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Mock data for demonstration
  React.useEffect(() => {
    // Simulate loading recipes
    const mockRecipes: Recipe[] = [
      {
        id: '1',
        title: 'Mediterranean Quinoa Bowl',
        description: 'A healthy and delicious bowl packed with Mediterranean flavors',
        prep_time: 15,
        cook_time: 25,
        servings: 4,
        difficulty: 'easy',
        cuisine: 'Mediterranean',
        tags: ['healthy', 'vegetarian', 'quick'],
        created_at: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        title: 'Grilled Salmon with Asparagus',
        description: 'Perfectly grilled salmon with fresh asparagus and herbs',
        prep_time: 10,
        cook_time: 20,
        servings: 2,
        difficulty: 'medium',
        cuisine: 'American',
        tags: ['protein', 'low-carb', 'gluten-free'],
        created_at: '2024-01-14T15:30:00Z'
      }
    ]
    
    setTimeout(() => {
      setRecipes(mockRecipes)
      setIsLoading(false)
    }, 1000)
  }, [])

  const handleEditRecipe = (recipeId: string) => {
    console.log('Edit recipe:', recipeId)
    // Navigate to edit page or open edit modal
  }

  const handleViewRecipe = (recipeId: string) => {
    console.log('View recipe:', recipeId)
    // Navigate to recipe detail page
  }

  const handleRefreshRecipes = () => {
    console.log('Refreshing recipes...')
    // Reload recipes from API
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading recipes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <RecipeManagementExample
        recipes={recipes}
        onEditRecipe={handleEditRecipe}
        onViewRecipe={handleViewRecipe}
        onRefreshRecipes={handleRefreshRecipes}
      />
    </div>
  )
}
