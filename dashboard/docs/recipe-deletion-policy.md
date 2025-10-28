# Recipe Deletion Policy

This document outlines the comprehensive policy for deleting recipes in the Nourish Dashboard application, ensuring data integrity and preventing orphaned data.

## Overview

When a recipe is deleted, the system must clean up all related data to maintain database integrity and prevent redundant data. The deletion policy handles multiple related tables and provides safety checks to prevent data loss.

## Database Relationships

### Tables with CASCADE DELETE
These tables are automatically cleaned up when a recipe is deleted:

- **`recipe_ingredients`** - Ingredient associations with quantities and units
- **`recipe_tags`** - Custom tags associated with the recipe  
- **`recipe_nutrition`** - Nutritional information per serving

### Tables with SET NULL
These tables have their recipe references set to NULL:

- **`nutrition_logs`** - User nutrition logs that reference the recipe

### Tables with Usage Checks
These tables prevent deletion if the recipe is in use:

- **`meal_plan_items`** - Recipes used in meal plans cannot be deleted

## Deletion Process

### 1. Pre-deletion Validation

Before allowing deletion, the system checks:

- **Authentication**: User must be logged in
- **Ownership**: Users can only delete their own recipes
- **Usage**: Recipe cannot be deleted if used in meal plans
- **Existence**: Recipe must exist in the database

### 2. Deletion Steps

When a recipe is deleted, the following steps occur in order:

1. **Delete recipe ingredients** - Remove all ingredient associations
2. **Delete recipe tags** - Remove all custom tags
3. **Delete recipe nutrition** - Remove nutritional data
4. **Update nutrition logs** - Set recipe_id to NULL (preserves user data)
5. **Delete the recipe** - Remove the main recipe record

### 3. Safety Mechanisms

- **Meal Plan Protection**: Recipes used in meal plans cannot be deleted
- **User Data Preservation**: Nutrition logs are preserved with NULL recipe references
- **Transaction Safety**: All deletions happen in a single transaction
- **Permission Checks**: Only recipe owners can delete their recipes

## API Functions

### `delete_recipe_completely(recipe_id)`
Safely deletes a recipe and all related data.

**Parameters:**
- `recipe_id` (uuid): The ID of the recipe to delete

**Returns:**
- `boolean`: True if deletion was successful

**Errors:**
- `Authentication required`: User not logged in
- `Recipe not found`: Recipe doesn't exist
- `You can only delete your own recipes`: Permission denied
- `Cannot delete recipe: it is currently used in meal plans`: Usage conflict

### `can_delete_recipe(recipe_id)`
Checks if a recipe can be safely deleted.

**Returns:**
```json
{
  "can_delete": boolean,
  "reason": string,
  "meal_plan_usage": number,
  "nutrition_log_usage": number
}
```

### `get_recipe_deletion_impact(recipe_id)`
Returns detailed information about deletion impact.

**Returns:**
```json
{
  "recipe_title": string,
  "ingredients_to_delete": number,
  "tags_to_delete": number,
  "nutrition_records_to_delete": number,
  "meal_plan_usage": number,
  "nutrition_log_usage": number,
  "total_related_records": number
}
```

## Frontend Integration

### RecipeDeletionDialog Component

The `RecipeDeletionDialog` component provides a safe deletion interface with:

- **Pre-deletion validation**: Checks if recipe can be deleted
- **Impact preview**: Shows what data will be affected
- **Usage warnings**: Alerts about meal plan usage
- **Confirmation**: Requires explicit user confirmation
- **Loading states**: Shows progress during deletion

### Usage Example

```tsx
import { RecipeDeletionDialog, useRecipeDeletion } from '@/components/RecipeDeletionDialog'

function RecipeList() {
  const { 
    isDialogOpen, 
    selectedRecipe, 
    openDeletionDialog, 
    closeDeletionDialog, 
    handleRecipeDeleted 
  } = useRecipeDeletion()

  const handleDeleteClick = (recipeId: string, recipeTitle: string) => {
    openDeletionDialog(recipeId, recipeTitle)
  }

  return (
    <>
      {/* Your recipe list */}
      <button onClick={() => handleDeleteClick(recipe.id, recipe.title)}>
        Delete Recipe
      </button>

      <RecipeDeletionDialog
        isOpen={isDialogOpen}
        onClose={closeDeletionDialog}
        recipeId={selectedRecipe?.id || ''}
        recipeTitle={selectedRecipe?.title || ''}
        onDeleted={handleRecipeDeleted}
      />
    </>
  )
}
```

## Error Handling

### Common Error Scenarios

1. **Recipe in Meal Plans**
   - **Error**: "Cannot delete recipe: it is currently used in meal plans"
   - **Solution**: Remove recipe from meal plans first

2. **Permission Denied**
   - **Error**: "You can only delete your own recipes"
   - **Solution**: Only recipe owners can delete

3. **Recipe Not Found**
   - **Error**: "Recipe not found"
   - **Solution**: Recipe may have been already deleted

4. **Authentication Required**
   - **Error**: "Authentication required"
   - **Solution**: User must be logged in

## Data Integrity Guarantees

- **No Orphaned Data**: All related records are properly cleaned up
- **User Data Preservation**: Nutrition logs are preserved with NULL references
- **Referential Integrity**: Foreign key constraints prevent invalid references
- **Transaction Safety**: All operations are atomic (all succeed or all fail)

## Migration

To apply the deletion policy to your database:

1. Run the migration: `supabase/migrations/create_recipe_deletion_policy.sql`
2. Update your recipe service to use the new functions
3. Implement the `RecipeDeletionDialog` component in your UI
4. Test the deletion flow with various scenarios

## Testing Scenarios

### Test Cases

1. **Successful Deletion**
   - Delete recipe with no meal plan usage
   - Verify all related data is cleaned up
   - Check nutrition logs have NULL recipe_id

2. **Blocked Deletion**
   - Try to delete recipe used in meal plans
   - Verify deletion is prevented
   - Check appropriate error message

3. **Permission Testing**
   - Try to delete another user's recipe
   - Verify permission denied
   - Check error handling

4. **Data Integrity**
   - Delete recipe with complex relationships
   - Verify no orphaned data remains
   - Check foreign key constraints

## Best Practices

1. **Always check deletion eligibility** before showing delete button
2. **Show deletion impact** to users before confirmation
3. **Provide clear error messages** for blocked deletions
4. **Preserve user data** when possible (nutrition logs)
5. **Use transactions** for atomic operations
6. **Log deletion events** for audit purposes

## Security Considerations

- **Row Level Security**: RLS policies prevent unauthorized access
- **User Isolation**: Users can only delete their own recipes
- **Permission Validation**: Server-side validation of ownership
- **Audit Trail**: Consider logging deletion events for compliance

This deletion policy ensures that recipe deletion is safe, comprehensive, and maintains data integrity throughout the application.
