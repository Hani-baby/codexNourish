# recipes-ai: Pure Recipe Generator

## Overview
`recipes-ai` is a **pure generator tool** that creates compliant recipes from meal requests with strict constraint validation. It does not orchestrate, call other services, or update drafts.

**Version:** 2.0 (Refactored)  
**Status:** ✅ Production Ready

---

## Quick Start

### Request
```typescript
POST /functions/v1/recipes-ai

{
  "title": "Grilled Chicken Salad",
  "meal_type": "lunch",
  "servings": 2,
  "constraints": {
    "required_dietary": ["high-protein", "low-carb"],
    "blocked_ingredients": ["dairy", "gluten"],
    "blocked_tags": ["fried"],
    "max_prep_min": 15,
    "max_cook_min": 20
  },
  "cuisine": "mediterranean",
  "user_id": "user-uuid",
  "household_id": "household-uuid",
  "idempotency_key": "unique-key-123"
}
```

### Response (Success)
```json
{
  "success": true,
  "recipe_id": "recipe-uuid",
  "slug": "grilled-chicken-salad",
  "title": "Grilled Chicken Salad"
}
```

### Response (Failure)
```json
{
  "success": false,
  "error": "Recipe violates constraints",
  "error_type": "CONSTRAINT_VIOLATION",
  "violations": [
    "Blocked ingredient detected: dairy (found: parmesan cheese)",
    "Required dietary tag missing: low-carb"
  ]
}
```

---

## Key Features

### ✅ What It Does
- Generates recipes via OpenAI with strict JSON schema
- Validates constraints pre-persist (fail fast)
- Persists recipe + ingredients + steps + tags + nutrition (atomic transaction)
- Returns recipe_id on success
- Supports idempotency (duplicate request detection)
- Provides dry-run mode (validate without persisting)
- Includes provenance metadata for audit trails

### ❌ What It Doesn't Do
- Call other services (no callbacks to `recipe-assigner`)
- Update `meal_plan_drafts` table
- Retry/revise internally (Planner's responsibility)
- Implement tool schemas (Planner's responsibility)
- Orchestrate multi-step workflows

---

## API Reference

### Input Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Recipe title (≥3 chars) |
| `meal_type` | string | ✅ | Meal type (breakfast, lunch, dinner, snack) |
| `servings` | number | ✅ | Number of servings (>0) |
| `constraints` | object | ✅ | Constraint object (see below) |
| `cuisine` | string? | ❌ | Cuisine type (e.g., "italian") |
| `user_id` | string? | ❌ | User UUID (for `inspired` field) |
| `household_id` | string | ✅ | Household UUID |
| `idempotency_key` | string | ✅ | Unique key for retry safety |
| `job_id` | string? | ❌ | Optional job tracking ID |
| `dry_run` | boolean? | ❌ | Return without persisting (default: false) |
| `household_preferences` | object? | ❌ | Household preferences (fetched if missing) |
| `session_preferences` | object? | ❌ | Session preferences |

### Constraints Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `required_dietary` | string[] | ✅ | Dietary tags that MUST be present |
| `blocked_ingredients` | string[] | ✅ | Ingredients that MUST NOT appear |
| `blocked_tags` | string[] | ✅ | Tags that MUST NOT appear |
| `max_prep_min` | number? | ❌ | Maximum prep time in minutes |
| `max_cook_min` | number? | ❌ | Maximum cook time in minutes |
| `budget_per_serving_cents` | number? | ❌ | Budget per serving (not enforced yet) |

### Output Schema (Success)

| Field | Type | Description |
|-------|------|-------------|
| `success` | true | Always true on success |
| `recipe_id` | string | UUID of created recipe |
| `slug` | string | URL-friendly slug |
| `title` | string | Recipe title |
| `idempotent` | boolean? | True if returned from cache |

### Output Schema (Failure)

| Field | Type | Description |
|-------|------|-------------|
| `success` | false | Always false on failure |
| `error` | string | Human-readable error message |
| `error_type` | string | Error category (see Error Types) |
| `violations` | string[]? | Constraint violations (if applicable) |

---

## Error Types

| Type | HTTP Status | Description | Retry? |
|------|-------------|-------------|--------|
| `CONSTRAINT_VIOLATION` | 400 | Recipe violates hard constraints | ❌ No |
| `SCHEMA_VALIDATION_ERROR` | 422 | AI response didn't match schema | ⚠️ Maybe |
| `VALIDATION_ERROR` | 400 | Invalid input | ❌ No |
| `PROVIDER_TIMEOUT` | 504 | OpenAI API timeout | ✅ Yes |
| `PROVIDER_ERROR` | 502 | OpenAI API error | ✅ Yes |
| `DB_PERSIST_ERROR` | 500 | Database error | ⚠️ Maybe |
| `IDEMPOTENT_DUPLICATE` | 200 | Duplicate request (returns existing recipe) | - |

---

## Constraint Validation

Validation occurs **before** database persistence. If any constraint is violated, the function returns `CONSTRAINT_VIOLATION` with detailed `violations[]` array.

### Validation Rules

1. **Required Dietary Tags:** All tags in `required_dietary[]` must appear in `recipe.dietary_tags[]`
2. **Blocked Ingredients:** No ingredient name can contain (or be contained by) any string in `blocked_ingredients[]`
3. **Blocked Tags:** No tag in `blocked_tags[]` can appear in `recipe.tags[]` or `recipe.dietary_tags[]`
4. **Time Limits:** `recipe.prep_min ≤ max_prep_min` and `recipe.cook_min ≤ max_cook_min` (if specified)

### Example Violations

```json
{
  "violations": [
    "Blocked ingredient detected: peanuts (found: peanut butter)",
    "Required dietary tag missing: vegan",
    "Prep time 35min exceeds maximum 30min"
  ]
}
```

---

## Idempotency

The function supports idempotent requests via the `idempotency_key` parameter.

### How It Works
1. Include a unique `idempotency_key` in your request
2. If the same key is used again, the function returns the existing recipe
3. Response includes `idempotent: true` to indicate cache hit

### Key Generation Strategy

**Retry-based:**
```typescript
`${jobId}-item-${itemIndex}-retry-${retryCount}`
```

**Hash-based (recommended):**
```typescript
sha256(JSON.stringify(normalizedRequest)).slice(0, 32)
```

### Current Limitation
⚠️ Idempotency check is currently a placeholder. For production use, add an `idempotency_key` column with unique index to the `recipes` table.

---

## Dry Run Mode

Set `dry_run: true` to validate and generate the recipe structure without persisting to the database.

### Use Cases
- Preview recipe before committing
- Validate constraints without side effects
- Test AI model output quality
- Debug constraint violations

### Response
```json
{
  "success": true,
  "dry_run": true,
  "recipe": {
    "base": { /* full recipe base data */ },
    "tags": [ /* tags */ ],
    "ingredients": [ /* ingredients */ ],
    "steps": [ /* steps */ ],
    "nutrition": { /* nutrition data */ }
  },
  "provenance": {
    "model": "gpt-4.1-mini",
    "temperature": 0.8,
    "prompt_hash": "abc123..."
  }
}
```

---

## Provenance & Metadata

Every generated recipe includes audit metadata in `recipe_nutrition.meta`:

```json
{
  "generated_by": "recipes-ai",
  "model": "gpt-4.1-mini",
  "requested_meal_type": "lunch",
  "idempotency_key": "job-789-item-0-retry-0",
  "job_id": "job-789",
  "constraints": { /* full constraints object */ },
  "provenance": {
    "model": "gpt-4.1-mini",
    "temperature": 0.8,
    "generated_at": "2025-01-15T10:30:00.000Z"
  }
}
```

---

## Logging & Observability

All logs include:

| Field | Description |
|-------|-------------|
| `stage` | Pipeline stage (e.g., `recipes_ai.generate`) |
| `job_id` | Job tracking ID (if provided) |
| `idempotency_key` | Request idempotency key |
| `metrics` | Latency breakdown (ai, persist, total) |
| `error_type` | Error category (on failure) |
| `violations` | Constraint violations (if applicable) |

### Log Stages

- `recipes_ai.generate` - Request received
- `recipes_ai.idempotency_check` - Checking for duplicates
- `recipes_ai.ai_complete` - AI generation complete
- `recipes_ai.constraint_violation` - Constraint validation failed
- `recipes_ai.dry_run` - Dry run mode (no persist)
- `recipes_ai.complete` - Recipe persisted successfully
- `recipes_ai.error` - Error occurred

---

## Performance

### Timeouts
- OpenAI API: 30 seconds
- Function: ~35 seconds total

### Typical Latency
- AI generation: 5-15 seconds
- Constraint validation: <100ms
- Database persistence: 200-500ms
- **Total:** 6-16 seconds

### Recommendations
- Call with 3-5 concurrent requests max (avoid rate limits)
- Implement exponential backoff for retries
- Use idempotency for safe retries

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (admin) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `OPENAI_RECIPE_MODEL` | ❌ | Model name (default: gpt-4.1-mini) |
| `CHEFNOURISH` | ✅ | Chef Nourish user UUID |
| `SUPABASE_DB_URL` | ❌ | Postgres connection string (optional) |

---

## Testing

### Test Files
- `example-request.json` - Sample request
- `example-response-success.json` - Success response
- `example-response-constraint-violation.json` - Constraint violation
- `example-response-idempotent.json` - Idempotent response
- `example-response-dry-run.json` - Dry run response

### Integration Test Example

```typescript
test('generates recipe with constraints', async () => {
  const response = await fetch(`${url}/functions/v1/recipes-ai`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      title: 'Test Recipe',
      meal_type: 'dinner',
      servings: 4,
      constraints: {
        required_dietary: ['vegetarian'],
        blocked_ingredients: ['meat'],
        blocked_tags: [],
      },
      household_id: 'test-household',
      idempotency_key: crypto.randomUUID(),
    }),
  });
  
  const result = await response.json();
  expect(result.success).toBe(true);
  expect(result.recipe_id).toBeDefined();
});
```

---

## Migration from v1

See [PLANNER_MIGRATION_GUIDE.md](./PLANNER_MIGRATION_GUIDE.md) for detailed migration instructions.

### Breaking Changes
- ❌ `draft_id` and `draft_item_index` removed
- ❌ No callbacks to `recipe-assigner`
- ✅ `constraints` object required
- ✅ `idempotency_key` required
- ✅ New error taxonomy

---

## Architecture Decisions

### Why No Internal Retries?
- Planner has better context for retry decisions
- Simplifies testing and debugging
- Clearer separation of concerns

### Why Pre-Persist Validation?
- Fail fast on constraint violations
- Avoid wasted database writes
- Clear error messages for Planner

### Why Idempotency?
- Safe retries without duplicate recipes
- Better reliability in distributed systems
- Easier to implement retry logic in Planner

---

## Future Enhancements

### Planned
- [ ] Idempotency table with indexed lookup
- [ ] Budget constraint enforcement (requires ingredient pricing data)
- [ ] Token usage tracking and cost analysis
- [ ] Recipe similarity detection (avoid near-duplicates)
- [ ] Multi-cuisine fusion support

### Under Consideration
- [ ] Private recipe visibility control
- [ ] Recipe versioning (v2, v3, etc.)
- [ ] Nutrition calculation validation via third-party API
- [ ] Image generation via DALL-E

---

## Support

For questions or issues:

1. Check logs for `stage: "recipes_ai.*"` entries
2. Review error_type and violations in failed responses
3. Verify request format matches examples
4. Consult [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md) for detailed changes

---

## License & Credits

**Part of:** Nourish Meal Planning Platform  
**Maintained by:** Codex Team  
**Last Updated:** 2025-01-15


