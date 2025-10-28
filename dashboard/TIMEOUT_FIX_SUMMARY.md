# Edge Function Timeout Fix Summary

## Problem
The system was experiencing shutdowns at item 10 because:
1. **No timeouts on API calls** - OpenAI and recipes-ai calls could hang indefinitely
2. **Sequential processing** - Items processed one-by-one with cumulative time exceeding Edge Function limits (60s default)
3. **No progress saving** - If a timeout occurred, all progress was lost

## Fixes Applied

### 1. Hardened External Timeouts
- `recipe-assigner` and `recipes-ai` still guard OpenAI/HTTP calls with `AbortController` (25–30 s limits), preventing runaway waits.
- Revision helpers inherit the same timeout + graceful fallback behaviour to avoid long tail retries.

### 2. Resumable Recipe Assignment (Edge Function)
- Draft items are cloned once and mutated in-place for the entire run; we no longer stream partial slices back to the database.
- Each pass persists the **full** draft (only when changes occurred) and returns a structured payload:
  - `status: 'partial' | 'completed'`
  - `stats` (`totalItems`, `totalAssigned`, `remaining`, `assignedThisRun`, `elapsedMs`, `nextItemIndex`)
  - `has_more` + `resume_hint` with the next item index.
- A safety buffer (5 s) ends the run before the 60 s ceiling, so progress is saved and handed off cleanly.
- Response now exposes `progress_ratio` for callers that want to track completion percentage.

### 3. Multi‑Pass Coordination in the Orchestrator
- After generating the draft the orchestrator now loops, invoking the assigner until `has_more` is false.
- Progress is updated after every pass (`80 → 98`) based on `stats.totalAssigned / totalItems`, keeping async jobs warm.
- Meta fields (`recipe_assignment`) capture the latest run summary, including resume hints and assignment counts.
- Guard rails:
  - `MAX_ASSIGNER_RUNS = 6` prevents infinite loops.
  - If two consecutive passes report no new assignments, the orchestrator fails fast with a stall error.

### 4. Improved Observability
- Structured logs for each assigner pass (`status`, `assigned_this_run`, `remaining`, `has_more`).
- Job meta retains `assignment_summary` so support teams can verify progress from `async_jobs.meta`.
- HTTP responses from the assigner include enough context to drive external monitors or dashboards.

### 5. Async Recipe Callback Bridge
- `recipe-assigner` now tags every generation request with `draft_id` + `draft_item_index`, records pending items, and pauses completion until callbacks arrive.
- `recipes-ai` forwards those identifiers and performs a fire-and-forget callback once persistence succeeds, so long-running generations no longer block the edge runtime.
- Callback requests patch the waiting draft item in-place, ignore duplicates, and rely on draft metadata so concurrent households never collide.


## Database Queries to Check System State

### Check for Stuck Jobs
```sql
-- Find jobs that are stuck in 'processing' state
SELECT 
  id,
  job_type,
  status,
  progress,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update,
  meta
FROM async_jobs
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

### Check Job Progress
```sql
-- View recent job history
SELECT 
  id,
  job_type,
  status,
  progress,
  error_message,
  created_at,
  completed_at,
  EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)) as duration_seconds
FROM async_jobs
WHERE job_type = 'meal_plan_generation'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Draft Status
```sql
-- Find drafts with partial recipe assignments
SELECT 
  id,
  status,
  created_at,
  updated_at,
  jsonb_array_length(items) as total_items,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(items) as item 
    WHERE item->>'recipe_id' IS NOT NULL
  ) as items_with_recipes,
  job_id
FROM meal_plan_drafts
WHERE status IN ('pending', 'processing')
ORDER BY created_at DESC
LIMIT 10;
```

### Reset Stuck Jobs (if needed)
```sql
-- Reset stuck jobs to 'failed' state
-- CAUTION: Only run this after confirming jobs are truly stuck
UPDATE async_jobs
SET 
  status = 'failed',
  error_message = 'Reset due to timeout - process stuck',
  updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '5 minutes'
RETURNING id, job_type, created_at;
```

### View Logs for Specific Job
```sql
-- Check metadata for a specific job
SELECT 
  id,
  status,
  progress,
  meta,
  error_message,
  result
FROM async_jobs
WHERE id = 'YOUR_JOB_ID_HERE';
```

## Next Steps

1. **Check Current State**
   - Run the "Check for Stuck Jobs" query
   - If you find stuck jobs, note their IDs

2. **Check Draft Progress**
   - Run the "Check Draft Status" query
   - See how many items have recipes assigned

3. **Reset if Needed**
   - If jobs are confirmed stuck, run the reset query
   - This will mark them as failed and free up the system

4. **Test New Request**
   - After resetting, try creating a new meal plan
   - Monitor the logs to see timing information
   - Each item should complete in 5-10 seconds now

5. **Monitor Performance**
   - Watch for timeout errors in logs
   - If items still take too long, may need to optimize AI calls further
   - Consider processing fewer items per request (split into multiple jobs)

## Performance Expectations

With the new timeouts:
- Each item should process in 5-30 seconds
- Maximum 10-12 items can be processed in one Edge Function call
- If you have more than 12 items, you may need to implement batch processing

## Recommended Limits

To stay within Edge Function timeout (60s):
- **Ideal**: 7-8 items per meal plan
- **Maximum**: 10-12 items per meal plan
- **Beyond 12**: Implement job queuing/splitting

## Future Improvements

1. **Parallel Processing** - Process multiple items simultaneously (up to 3-4 at once)
2. **Job Splitting** - Break large meal plans into multiple smaller jobs
3. **Caching** - Cache frequently used recipes to speed up matching
4. **Background Workers** - Move to longer-running workers for large plans


