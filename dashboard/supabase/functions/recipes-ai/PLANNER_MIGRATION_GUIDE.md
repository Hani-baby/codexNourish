# Planner Migration Guide: recipes-ai v2

## Quick Summary
`recipes-ai` is now a **pure generator tool** that:
- ✅ Creates and persists recipes with strict constraint validation
- ✅ Returns recipe_id on success
- ❌ No longer calls back to `recipe-assigner`
- ❌ No longer touches `meal_plan_drafts`
- ❌ No internal retry/revision loops

**You (Planner) must now handle:** orchestration, draft updates, retries, and assigning recipes to draft items.

---

## Step-by-Step Migration

### 1. Update Your Request Format

**OLD (deprecated):**
```typescript
{
  title: "Pasta Primavera",
  description: "Fresh vegetables...",
  meal_type: "dinner",
  servings: 4,
  dietary_tags: ["vegetarian", "low-carb"],
  cuisine: "italian",
  user_id: "user-123",
  household_id: "household-456",
  draft_id: "draft-789",          // ❌ REMOVED
  draft_item_index: 2              // ❌ REMOVED
}
```

**NEW (required):**
```typescript
{
  title: "Pasta Primavera",
  meal_type: "dinner",
  servings: 4,
  
  // NEW: Explicit constraints object
  constraints: {
    required_dietary: ["vegetarian", "low-carb"],
    blocked_ingredients: ["peanuts", "shellfish"],
    blocked_tags: ["spicy", "fried"],
    max_prep_min: 30,               // Optional
    max_cook_min: 45                // Optional
  },
  
  cuisine: "italian",
  user_id: "user-123",               // Optional (for 'inspired' field)
  household_id: "household-456",
  
  // NEW: Idempotency support
  idempotency_key: "job-789-item-2-retry-0",  // REQUIRED
  job_id: "job-789",                           // Optional (for tracking)
  
  // NEW: Optional features
  dry_run: false,                    // Set true to validate without persisting
  
  // Optional: Planner should pass these if available
  household_preferences: {...},
  session_preferences: {...}
}
```

### 2. Build Constraints from User Data

```typescript
function buildConstraints(draftItem, householdPrefs): RecipeConstraints {
  return {
    // All dietary tags from household
    required_dietary: [
      ...householdPrefs.combined.dietary_patterns,
      ...draftItem.required_tags || []
    ],
    
    // Combine allergies + excluded ingredients
    blocked_ingredients: [
      ...householdPrefs.combined.allergies,
      ...householdPrefs.combined.excluded_ingredients,
      ...draftItem.blocked_ingredients || []
    ],
    
    // Tags to avoid
    blocked_tags: [
      ...householdPrefs.combined.dislikes.map(d => d.toLowerCase()),
      ...draftItem.blocked_tags || []
    ],
    
    // Time limits from preferences or draft
    max_prep_min: draftItem.max_prep_min || householdPrefs.combined.max_prep_min,
    max_cook_min: draftItem.max_cook_min || householdPrefs.combined.max_cook_min
  };
}
```

### 3. Generate Idempotency Key

```typescript
function generateIdempotencyKey(jobId: string, itemIndex: number, retryCount: number): string {
  // Include all factors that make this request unique
  return `${jobId}-item-${itemIndex}-retry-${retryCount}`;
}

// Alternative: hash-based for true idempotency
function generateIdempotencyKeyFromRequest(req: RecipeRequest): string {
  const normalized = JSON.stringify({
    title: req.title,
    constraints: req.constraints,
    servings: req.servings,
    // ... other fields that affect output
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}
```

### 4. Handle Response Types

```typescript
interface RecipeGenerationResult {
  success: boolean;
  recipe_id?: string;
  slug?: string;
  title?: string;
  error?: string;
  error_type?: string;
  violations?: string[];
  idempotent?: boolean;
}

async function callRecipesAi(request: RecipeRequest): Promise<RecipeGenerationResult> {
  const response = await fetch(`${supabaseUrl}/functions/v1/recipes-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(request),
  });
  
  return await response.json();
}

async function handleRecipeGeneration(draftItem, jobId, retryCount = 0) {
  const idempotencyKey = generateIdempotencyKey(jobId, draftItem.index, retryCount);
  
  const request = {
    title: draftItem.title,
    meal_type: draftItem.meal_type,
    servings: draftItem.servings,
    constraints: buildConstraints(draftItem, householdPrefs),
    cuisine: draftItem.cuisine,
    user_id: draftItem.user_id,
    household_id: draftItem.household_id,
    idempotency_key: idempotencyKey,
    job_id: jobId,
    household_preferences: householdPrefs,
    session_preferences: sessionPrefs,
  };
  
  const result = await callRecipesAi(request);
  
  if (result.success) {
    // Success - update draft with recipe_id
    await updateDraftItem(draftItem.id, {
      recipe_id: result.recipe_id,
      status: 'completed',
      slug: result.slug
    });
    
    if (result.idempotent) {
      logger.info('Used cached recipe', { 
        idempotency_key: idempotencyKey,
        recipe_id: result.recipe_id 
      });
    }
    
    return result;
  } else {
    // Handle errors based on type
    return handleError(result, draftItem, jobId, retryCount);
  }
}
```

### 5. Implement Error Handling with Retry Logic

```typescript
async function handleError(
  result: RecipeGenerationResult, 
  draftItem, 
  jobId: string, 
  retryCount: number
) {
  const { error_type, error, violations } = result;
  
  switch (error_type) {
    case 'CONSTRAINT_VIOLATION':
      // Hard failure - don't retry, log violations
      logger.error('Recipe constraints cannot be satisfied', {
        draft_item_id: draftItem.id,
        violations,
      });
      await updateDraftItem(draftItem.id, {
        status: 'failed',
        error_type: 'constraint_violation',
        error_details: { violations }
      });
      return { success: false, reason: 'constraints_unsatisfiable' };
    
    case 'SCHEMA_VALIDATION_ERROR':
      // AI model issue - don't retry immediately
      logger.error('AI generated invalid schema', { error });
      await updateDraftItem(draftItem.id, {
        status: 'failed',
        error_type: 'schema_error',
      });
      return { success: false, reason: 'schema_error' };
    
    case 'PROVIDER_TIMEOUT':
    case 'PROVIDER_ERROR':
      // Transient - retry with backoff
      if (retryCount < 3) {
        const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await sleep(backoffMs);
        logger.info('Retrying after provider error', { 
          retry_count: retryCount + 1,
          backoff_ms: backoffMs 
        });
        return handleRecipeGeneration(draftItem, jobId, retryCount + 1);
      } else {
        await updateDraftItem(draftItem.id, {
          status: 'failed',
          error_type: 'provider_error',
        });
        return { success: false, reason: 'max_retries_exceeded' };
      }
    
    case 'DB_PERSIST_ERROR':
      // Database issue - may be transient, retry once
      if (retryCount === 0) {
        await sleep(2000);
        return handleRecipeGeneration(draftItem, jobId, 1);
      }
      await updateDraftItem(draftItem.id, {
        status: 'failed',
        error_type: 'db_error',
      });
      return { success: false, reason: 'database_error' };
    
    case 'VALIDATION_ERROR':
      // Input error - don't retry, fix input
      logger.error('Invalid request to recipes-ai', { error });
      await updateDraftItem(draftItem.id, {
        status: 'failed',
        error_type: 'validation_error',
      });
      return { success: false, reason: 'invalid_input' };
    
    default:
      // Unknown error - log and fail
      logger.error('Unknown error from recipes-ai', { error, error_type });
      await updateDraftItem(draftItem.id, {
        status: 'failed',
        error_type: 'unknown',
      });
      return { success: false, reason: 'unknown_error' };
  }
}
```

### 6. Update Draft Management

```typescript
// YOU now handle draft updates (recipes-ai doesn't call back)
async function updateDraftItem(itemId: string, updates: {
  recipe_id?: string;
  slug?: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed';
  error_type?: string;
  error_details?: any;
}) {
  const { error } = await supabaseAdmin
    .from('meal_plan_drafts')
    .update(updates)
    .eq('id', itemId);
  
  if (error) {
    logger.error('Failed to update draft item', { itemId, error });
    throw error;
  }
}
```

---

## Common Patterns

### Pattern 1: Generate Recipe for Draft Item

```typescript
async function generateRecipeForDraftItem(draftItemId: string, jobId: string) {
  // 1. Fetch draft item
  const draftItem = await fetchDraftItem(draftItemId);
  
  // 2. Mark as generating
  await updateDraftItem(draftItemId, { status: 'generating' });
  
  // 3. Call recipes-ai (includes retry logic)
  const result = await handleRecipeGeneration(draftItem, jobId);
  
  // 4. Status already updated in handleRecipeGeneration
  return result;
}
```

### Pattern 2: Batch Generation with Concurrency Control

```typescript
async function generateRecipesForDraft(draftId: string, jobId: string) {
  const draftItems = await fetchDraftItems(draftId);
  
  // Process with concurrency limit (e.g., 3 at a time)
  const results = await pLimit(3, draftItems, async (item) => {
    return generateRecipeForDraftItem(item.id, jobId);
  });
  
  // Check if all succeeded
  const allSuccess = results.every(r => r.success);
  
  if (allSuccess) {
    await finalizeDraft(draftId);
  } else {
    await handlePartialFailure(draftId, results);
  }
  
  return { success: allSuccess, results };
}
```

### Pattern 3: Dry Run for Validation

```typescript
async function validateConstraints(draftItem) {
  const request = {
    ...buildRecipeRequest(draftItem),
    dry_run: true,  // Don't persist
  };
  
  const result = await callRecipesAi(request);
  
  if (result.success) {
    // Constraints are satisfiable - recipe structure is valid
    return { valid: true, recipe: result.recipe };
  } else if (result.error_type === 'CONSTRAINT_VIOLATION') {
    // Show user which constraints can't be met
    return { valid: false, violations: result.violations };
  }
  
  return { valid: false, error: result.error };
}
```

---

## Testing Your Integration

### 1. Unit Test: Request Building

```typescript
test('buildConstraints aggregates all sources', () => {
  const draftItem = {
    required_tags: ['gluten-free'],
    blocked_ingredients: ['soy'],
    max_prep_min: 20,
  };
  
  const householdPrefs = {
    combined: {
      dietary_patterns: ['vegetarian'],
      allergies: ['peanuts'],
      excluded_ingredients: ['cilantro'],
    }
  };
  
  const constraints = buildConstraints(draftItem, householdPrefs);
  
  expect(constraints.required_dietary).toContain('vegetarian');
  expect(constraints.required_dietary).toContain('gluten-free');
  expect(constraints.blocked_ingredients).toContain('peanuts');
  expect(constraints.blocked_ingredients).toContain('soy');
  expect(constraints.blocked_ingredients).toContain('cilantro');
  expect(constraints.max_prep_min).toBe(20);
});
```

### 2. Integration Test: Success Path

```typescript
test('generates recipe and updates draft', async () => {
  const draftItem = { /* ... */ };
  const jobId = 'test-job-123';
  
  const result = await generateRecipeForDraftItem(draftItem.id, jobId);
  
  expect(result.success).toBe(true);
  expect(result.recipe_id).toBeDefined();
  
  const updated = await fetchDraftItem(draftItem.id);
  expect(updated.status).toBe('completed');
  expect(updated.recipe_id).toBe(result.recipe_id);
});
```

### 3. Integration Test: Constraint Violation

```typescript
test('handles constraint violation gracefully', async () => {
  const draftItem = {
    title: 'Peanut Butter Cookies',
    constraints: {
      blocked_ingredients: ['peanuts'],  // Conflict!
      required_dietary: [],
      blocked_tags: []
    }
  };
  
  const result = await generateRecipeForDraftItem(draftItem.id, jobId);
  
  expect(result.success).toBe(false);
  expect(result.reason).toBe('constraints_unsatisfiable');
  
  const updated = await fetchDraftItem(draftItem.id);
  expect(updated.status).toBe('failed');
  expect(updated.error_type).toBe('constraint_violation');
});
```

### 4. Integration Test: Idempotency

```typescript
test('returns same recipe for duplicate requests', async () => {
  const request = { /* ... same request ... */ };
  
  const result1 = await callRecipesAi(request);
  const result2 = await callRecipesAi(request);  // Same idempotency_key
  
  expect(result1.success).toBe(true);
  expect(result2.success).toBe(true);
  expect(result2.idempotent).toBe(true);
  expect(result1.recipe_id).toBe(result2.recipe_id);
});
```

---

## Rollback Plan

If you need to roll back to the old version:

1. **Revert to old request format** (with `draft_id`, `draft_item_index`)
2. **Remove constraint validation** in Planner
3. **Remove retry logic** (old version had internal retries)
4. **Remove idempotency_key generation**

However, **we recommend migrating forward** because:
- ✅ Better separation of concerns
- ✅ Easier testing and debugging
- ✅ More control over orchestration
- ✅ Clearer error handling
- ✅ Built-in constraint validation

---

## Support & Questions

If you encounter issues:

1. Check the logs for `stage: "recipes_ai.*"` entries
2. Review `error_type` in failed responses
3. Verify `idempotency_key` format and uniqueness
4. Check constraint format matches examples
5. Confirm `household_preferences` structure if passed

**Common Issues:**

| Issue | Solution |
|-------|----------|
| Missing `idempotency_key` | Add required field to request |
| Constraint violations | Review `violations[]` array in response |
| Timeouts | Implement retry with backoff |
| Schema errors | Check AI model health, may need retry |
| Idempotency not working | Ensure exact same `idempotency_key` for retries |

---

## What's Next

Once you've migrated:

1. **Monitor error rates** by `error_type`
2. **Track latency metrics** (now included in logs)
3. **Optimize retry logic** based on observed failure patterns
4. **Implement smart fallbacks** (e.g., suggest recipe from library if generation fails)
5. **Add user-facing error messages** for each `error_type`

Good luck! 🚀


