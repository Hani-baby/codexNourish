-- ============================================
-- Script to Check and Fix Stuck Jobs
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Check for stuck jobs
SELECT 
  '=== STUCK JOBS ===' as section,
  id,
  job_type,
  status,
  progress,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_stuck,
  error_message,
  meta->'retry_count' as retry_count
FROM async_jobs
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '3 minutes'
ORDER BY created_at DESC;

-- 2. Check recent failed jobs
SELECT 
  '=== RECENT FAILED JOBS ===' as section,
  id,
  job_type,
  error_message,
  created_at,
  meta->'retry_count' as retry_count,
  meta->'last_error' as last_error
FROM async_jobs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check drafts with partial assignments
SELECT 
  '=== DRAFTS WITH PARTIAL RECIPES ===' as section,
  mpd.id,
  mpd.status,
  mpd.job_id,
  mpd.created_at,
  jsonb_array_length(mpd.items) as total_items,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(mpd.items) as item 
    WHERE item->>'recipe_id' IS NOT NULL
  ) as items_with_recipes,
  aj.status as job_status,
  aj.progress as job_progress
FROM meal_plan_drafts mpd
LEFT JOIN async_jobs aj ON aj.id = mpd.job_id
WHERE mpd.status IN ('pending', 'processing')
  AND mpd.created_at > NOW() - INTERVAL '1 hour'
ORDER BY mpd.created_at DESC;

-- 4. Get detailed view of the most recent stuck job
SELECT 
  '=== MOST RECENT STUCK JOB DETAILS ===' as section,
  id,
  job_type,
  status,
  progress,
  payload,
  meta,
  error_message,
  result,
  created_at,
  updated_at,
  completed_at
FROM async_jobs
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '3 minutes'
ORDER BY created_at DESC
LIMIT 1;

-- ============================================
-- AFTER REVIEWING THE ABOVE, IF YOU WANT TO RESET STUCK JOBS:
-- Uncomment and run this section
-- ============================================

/*
-- 5. Reset stuck jobs to failed state
UPDATE async_jobs
SET 
  status = 'failed',
  error_message = 'Manual reset: Job timed out and was stuck in processing state',
  updated_at = NOW(),
  completed_at = NOW(),
  meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
    'manually_reset', true,
    'reset_at', NOW()::text,
    'reset_reason', 'timeout_recovery'
  )
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '3 minutes'
RETURNING 
  id,
  job_type,
  created_at,
  'RESET TO FAILED' as action;
*/

-- ============================================
-- 6. Check system health
-- ============================================

SELECT 
  '=== JOB SYSTEM HEALTH (Last Hour) ===' as section,
  status,
  COUNT(*) as count,
  AVG(progress) as avg_progress,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_count
FROM async_jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND job_type = 'meal_plan_generation'
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'completed' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'pending' THEN 3
    WHEN 'failed' THEN 4
  END;

