# recipes-ai Refactoring Summary

## Overview
Transformed `recipes-ai` from an orchestrator/callback-based system into a **pure generator tool** that creates and persists compliant recipes without touching drafts or calling other services.

---

## Key Changes

### 1. **New Role**
> A pure generator tool: given a meal request + constraints, create and persist a compliant recipe and return recipe_id. It does not call other services and does not update drafts.

### 2. **Removed Components**
- ❌ **Callback mechanism** (`callbackAssigner`) - No longer calls back to `recipe-assigner`
- ❌ **Draft semantics** - Removed `draft_id` and `draft_item_index` from input/output
- ❌ **Internal orchestration** - No match/revise/re-validate loops (belongs to Planner)
- ❌ **Tool schemas** - Moved to Planner only

---

## Input/Output Contract

### Input (from Planner)
```typescript
interface RecipeAiRequestBody {
  // Core request
  title: string;
  meal_type: string;
  servings: number;
  
  // Constraints (NEW)
  constraints: {
    required_dietary: string[];        // Must be present
    blocked_ingredients: string[];     // Must NOT be present
    blocked_tags: string[];            // Must NOT be present
    max_prep_min?: number;             // Optional time limit
    max_cook_min?: number;             // Optional time limit
    budget_per_serving_cents?: number; // Optional budget (not enforced yet)
  };
  
  // Optional context
  cuisine?: string | null;
  household_preferences?: HouseholdPreferenceAggregate;
  session_preferences?: SessionPreferences;
  
  // Identity
  user_id?: string | null;           // For 'inspired' field
  household_id: string;
  
  // Control (NEW)
  idempotency_key: string;           // Required for retry safety
  job_id?: string;                   // Optional job tracking
  dry_run?: boolean;                 // Return without persisting
}
```

### Output (to Planner)

**Success:**
```typescript
{
  success: true,
  recipe_id: string,
  slug: string,
  title: string,
  idempotent?: boolean  // If returned from cache
}
```

**Failure:**
```typescript
{
  success: false,
  error: string,
  error_type: "SCHEMA_VALIDATION_ERROR" 
            | "CONSTRAINT_VIOLATION" 
            | "IDEMPOTENT_DUPLICATE"
            | "PROVIDER_TIMEOUT"
            | "PROVIDER_ERROR"
            | "DB_PERSIST_ERROR"
            | "VALIDATION_ERROR",
  violations?: string[]  // For CONSTRAINT_VIOLATION
}
```

**Dry Run:**
```typescript
{
  success: true,
  dry_run: true,
  recipe: PersistableRecipe,
  provenance: {
    model: string,
    temperature: number,
    prompt_hash: string
  }
}
```

---

## Behavioral Changes

### 1. **Synchronous-First Approach**
- Aims to generate and persist within 25-30s budget
- No async queuing (removed slow path)
- Returns directly with success/failure

### 2. **Idempotency Support**
- Accepts `idempotency_key` (required)
- Checks for duplicate requests before generating
- Returns existing `recipe_id` if found (with `idempotent: true`)
- **Note:** Current implementation is placeholder - proper implementation requires adding `idempotency_key` column to `recipes` table

### 3. **Pre-Persist Constraint Validation**
- Validates **before** persisting to database
- Checks:
  - ✅ All `required_dietary` tags present
  - ❌ No `blocked_ingredients` in recipe
  - ❌ No `blocked_tags` in recipe tags or dietary_tags
  - ⏱️ Prep/cook time within limits (if specified)
- Returns `CONSTRAINT_VIOLATION` error with detailed `violations[]` array if failed

### 4. **Enhanced AI Prompts**
- System prompt explicitly mentions constraints
- User prompt includes critical constraints summary
- Emphasizes strict adherence to blocked ingredients/tags

### 5. **No Draft Mutations**
- Never touches `meal_plan_drafts` table
- Only returns `recipe_id` - Planner handles assignment

### 6. **Ownership & Visibility**
- `created_by` = CHEFNOURISH UUID (from env)
- `inspired` = user_id (or null)
- `is_public` = true (library recipes)

---

## Error Taxonomy

Consistent error types for Planner to branch on:

| Error Type | Description | HTTP Status |
|------------|-------------|-------------|
| `SCHEMA_VALIDATION_ERROR` | OpenAI response didn't match schema | 422 |
| `CONSTRAINT_VIOLATION` | Recipe violates hard constraints | 400 |
| `IDEMPOTENT_DUPLICATE` | Request already processed | 200 (with existing recipe_id) |
| `PROVIDER_TIMEOUT` | OpenAI API timeout | 504 |
| `PROVIDER_ERROR` | OpenAI API error | 502 |
| `DB_PERSIST_ERROR` | Database insertion failed | 500 |
| `VALIDATION_ERROR` | Input validation failed | 400 |

---

## Enhanced Logging

All log entries now include:

```typescript
{
  stage: "recipes_ai.generate" | "recipes_ai.idempotency_check" 
       | "recipes_ai.ai_complete" | "recipes_ai.constraint_violation" 
       | "recipes_ai.dry_run" | "recipes_ai.complete" | "recipes_ai.error",
  job_id: string | null,
  idempotency_key: string,
  metrics?: {
    total_latency_ms: number,
    ai_latency_ms: number,
    persist_latency_ms: number
  },
  error_type?: RecipeErrorType,
  violations?: string[]
}
```

---

## Optional Features Implemented

### 1. **Dry Run Mode**
Set `dry_run: true` to:
- Validate constraints
- Generate recipe structure
- Return full `PersistableRecipe` object
- **Skip** database persistence
- Include provenance metadata

### 2. **Provenance Metadata**
Stored in `recipe_nutrition.meta`:
```typescript
{
  generated_by: "recipes-ai",
  model: "gpt-4.1-mini",
  requested_meal_type: string,
  idempotency_key: string,
  job_id: string | null,
  constraints: RecipeConstraints,
  provenance: {
    model: string,
    temperature: 0.8,
    generated_at: ISO8601
  }
}
```

---

## What Was Kept

✅ **Structured prompts** - System + user prompts with clear instructions  
✅ **Strict JSON schema** - Using OpenAI Responses API with `strict: true`  
✅ **Slug uniqueness** - `ensureUniqueSlug` with retry logic  
✅ **Normalization** - Lowercase arrays, slug sanitization  
✅ **Single-transaction persistence** - Recipe + tags + ingredients + steps + nutrition  
✅ **Solid logging** - Structured JSON logs with correlation IDs  
✅ **Allergen enrichment** - Converts allergens to `contains:*` dietary tags  
✅ **Pre-persist validation** - Title ≥3 chars, ≥1 ingredient, ≥1 step, servings > 0  

---

## What Was Moved to Planner

🔄 **Decision logic:**
- When to call `recipes-ai`
- When to retry on failure
- When to validate again
- When to finalize the plan
- How to handle unmatched items

🔄 **Draft management:**
- Updating `meal_plan_drafts`
- Assigning recipes to draft items
- Tracking generation progress

🔄 **Tool schemas:**
- OpenAI function/tool schemas
- Orchestration between services

---

## Migration Notes for Planner

1. **New Input Format:**
   - Replace `dietary_tags` with `constraints.required_dietary`
   - Add `constraints.blocked_ingredients` and `constraints.blocked_tags`
   - Always provide `idempotency_key`
   - Optionally provide `job_id` for tracking

2. **Handle New Error Types:**
   - Branch on `error_type` instead of parsing error messages
   - Display `violations[]` array for constraint violations
   - Retry on `PROVIDER_TIMEOUT` and `PROVIDER_ERROR`
   - Don't retry on `CONSTRAINT_VIOLATION` or `SCHEMA_VALIDATION_ERROR`

3. **Response Handling:**
   - Check `idempotent: true` to detect cache hits
   - Use `recipe_id` to assign to draft items
   - Parse `error_type` for decision logic

4. **No More Callbacks:**
   - Planner must poll or wait for response
   - No callback URL needed
   - Synchronous request/response only

---

## Future Enhancements (TODO)

1. **Idempotency Table:**
   - Add `idempotency_key` column to `recipes` table with unique index
   - Implement efficient lookup instead of scanning recent recipes

2. **Budget Constraints:**
   - Implement `budget_per_serving_cents` validation
   - Require ingredient cost data

3. **Visibility Control:**
   - Add `visibility: "public" | "private"` parameter
   - Support private user recipes

4. **Prompt Hash:**
   - Calculate actual hash of normalized prompt for provenance
   - Currently using placeholder UUID

5. **Token Usage Tracking:**
   - Extract token counts from OpenAI response
   - Log in metrics for cost analysis

---

## Testing Recommendations

### Unit Tests
- Constraint validation with various violation combinations
- Idempotency check (once implemented)
- Error taxonomy classification
- Input normalization

### Integration Tests
- End-to-end generation with valid constraints
- Constraint violation rejection
- Dry run mode
- Idempotent request handling
- Timeout handling

### Load Tests
- Concurrent requests with same `idempotency_key`
- High-volume generation under time budget
- Database persistence under load

---

## Breaking Changes

⚠️ **API Changes:**
- `draft_id` and `draft_item_index` removed from input
- `constraints` object now required (was `dietary_tags` array)
- `idempotency_key` now required
- Output no longer triggers callbacks

⚠️ **Behavior Changes:**
- No longer updates `meal_plan_drafts`
- No retry/revision loops internally
- Fails fast on constraint violations
- Synchronous only (no async job queuing)

---

## Summary

The refactored `recipes-ai` is now a **stateless, pure function** that:
1. Accepts a meal request with strict constraints
2. Generates a compliant recipe via OpenAI
3. Validates constraints pre-persist
4. Persists to database (unless dry_run)
5. Returns recipe_id with consistent error taxonomy

All orchestration, retry logic, and draft management now belongs to the **Planner**, creating clear separation of concerns and easier testing/debugging.


