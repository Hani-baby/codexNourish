import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle, Trash2, Info } from 'lucide-react'
import { canDeleteRecipe, getRecipeDeletionImpact, deleteRecipe } from '@/lib/recipe-service'

interface RecipeDeletionDialogProps {
  isOpen: boolean
  onClose: () => void
  recipeId: string
  recipeTitle: string
  onDeleted: () => void
}

interface DeletionImpact {
  recipe_title: string
  ingredients_to_delete: number
  tags_to_delete: number
  nutrition_records_to_delete: number
  meal_plan_usage: number
  nutrition_log_usage: number
  total_related_records: number
}

interface DeletionCheck {
  can_delete: boolean
  reason: string
  meal_plan_usage: number
  nutrition_log_usage: number
}

export function RecipeDeletionDialog({
  isOpen,
  onClose,
  recipeId,
  recipeTitle,
  onDeleted
}: RecipeDeletionDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [deletionCheck, setDeletionCheck] = useState<DeletionCheck | null>(null)
  const [deletionImpact, setDeletionImpact] = useState<DeletionImpact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load deletion check and impact when dialog opens
  useEffect(() => {
    if (isOpen && recipeId) {
      loadDeletionData()
    }
  }, [isOpen, recipeId])

  const loadDeletionData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const [checkResult, impactResult] = await Promise.all([
        canDeleteRecipe(recipeId),
        getRecipeDeletionImpact(recipeId)
      ])
      
      setDeletionCheck(checkResult)
      setDeletionImpact(impactResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deletion information')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletionCheck?.can_delete) return

    setIsDeleting(true)
    setError(null)

    try {
      await deleteRecipe(recipeId)
      onDeleted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete recipe')
    } finally {
      setIsDeleting(false)
    }
  }

  const canDelete = deletionCheck?.can_delete ?? false
  const hasMealPlanUsage = (deletionCheck?.meal_plan_usage ?? 0) > 0
  const hasNutritionLogUsage = (deletionCheck?.nutrition_log_usage ?? 0) > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Recipe
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{recipeTitle}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading deletion information...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && deletionCheck && deletionImpact && (
          <div className="space-y-4">
            {/* Deletion Impact Summary */}
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Deletion Impact
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span>Ingredients:</span>
                  <Badge variant="secondary">{deletionImpact.ingredients_to_delete}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Tags:</span>
                  <Badge variant="secondary">{deletionImpact.tags_to_delete}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Nutrition:</span>
                  <Badge variant="secondary">{deletionImpact.nutrition_records_to_delete}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Total Records:</span>
                  <Badge variant="outline">{deletionImpact.total_related_records}</Badge>
                </div>
              </div>
            </div>

            {/* Usage Warnings */}
            {hasMealPlanUsage && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This recipe is currently used in {deletionCheck.meal_plan_usage} meal plan(s). 
                  You must remove it from meal plans before deleting.
                </AlertDescription>
              </Alert>
            )}

            {hasNutritionLogUsage && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This recipe is referenced in {deletionCheck.nutrition_log_usage} nutrition log(s). 
                  These references will be cleared when the recipe is deleted.
                </AlertDescription>
              </Alert>
            )}

            {/* Deletion Status */}
            {!canDelete && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {deletionCheck.reason}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            className="min-w-[100px]"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Recipe
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook for easy usage
export function useRecipeDeletion() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<{
    id: string
    title: string
  } | null>(null)

  const openDeletionDialog = (recipeId: string, recipeTitle: string) => {
    setSelectedRecipe({ id: recipeId, title: recipeTitle })
    setIsDialogOpen(true)
  }

  const closeDeletionDialog = () => {
    setIsDialogOpen(false)
    setSelectedRecipe(null)
  }

  const handleRecipeDeleted = () => {
    // You can add additional logic here like refreshing the recipe list
    console.log('Recipe deleted successfully')
  }

  return {
    isDialogOpen,
    selectedRecipe,
    openDeletionDialog,
    closeDeletionDialog,
    handleRecipeDeleted
  }
}
