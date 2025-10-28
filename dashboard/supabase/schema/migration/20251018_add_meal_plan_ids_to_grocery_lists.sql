-- Migration: Add meal_plan_ids array to grocery_lists
-- Purpose: Track which meal plans contribute to a grocery list (supporting multi-plan aggregation)
-- Date: 2025-10-18

BEGIN;

ALTER TABLE public.grocery_lists
  ADD COLUMN IF NOT EXISTS meal_plan_ids uuid[];

-- Populate from linked meal plan items when available.
WITH plan_agg AS (
  SELECT
    gl.id AS grocery_list_id,
    array_agg(DISTINCT mpi.meal_plan_id) FILTER (
      WHERE mpi.meal_plan_id IS NOT NULL
    ) AS meal_plan_ids
  FROM public.grocery_lists gl
  LEFT JOIN public.grocery_list_items gli
    ON gli.grocery_list_id = gl.id
  LEFT JOIN public.meal_plan_items mpi
    ON mpi.id = gli.meal_plan_item_id
  GROUP BY gl.id
)
UPDATE public.grocery_lists gl
SET meal_plan_ids = plan_agg.meal_plan_ids
FROM plan_agg
WHERE gl.id = plan_agg.grocery_list_id
  AND plan_agg.meal_plan_ids IS NOT NULL
  AND cardinality(plan_agg.meal_plan_ids) > 0;

-- Fallback to legacy metadata for single-plan lists (if present).
UPDATE public.grocery_lists
SET meal_plan_ids = ARRAY[(meta->>'meal_plan_id')::uuid]
WHERE meal_plan_ids IS NULL
  AND meta ? 'meal_plan_id'
  AND meta->>'meal_plan_id' IS NOT NULL;

-- Ensure remaining rows link to an existing meal plan by selecting the most recent option.
WITH missing AS (
  SELECT
    gl.id,
    (
      SELECT id
      FROM public.meal_plans mp
      WHERE mp.household_id = gl.household_id
      ORDER BY mp.start_date DESC, mp.created_at DESC
      LIMIT 1
    ) AS fallback_plan_id
  FROM public.grocery_lists gl
  WHERE gl.meal_plan_ids IS NULL
),
resolved AS (
  UPDATE public.grocery_lists gl
  SET meal_plan_ids = ARRAY[missing.fallback_plan_id]::uuid[]
  FROM missing
  WHERE gl.id = missing.id
    AND missing.fallback_plan_id IS NOT NULL
  RETURNING gl.id
)
UPDATE public.grocery_lists gl
SET meal_plan_ids = ARRAY[
  (
    SELECT mp.id
    FROM public.meal_plans mp
    ORDER BY mp.created_at DESC
    LIMIT 1
  )
]::uuid[]
WHERE gl.meal_plan_ids IS NULL
  AND EXISTS (SELECT 1 FROM public.meal_plans);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.grocery_lists WHERE meal_plan_ids IS NULL
  ) THEN
    RAISE EXCEPTION 'Unable to backfill meal_plan_ids for all grocery lists. Please review data manually.';
  END IF;
END $$;

ALTER TABLE public.grocery_lists
  ALTER COLUMN meal_plan_ids SET NOT NULL,
  ADD CONSTRAINT chk_grocery_list_meal_plan_ids
    CHECK (cardinality(meal_plan_ids) >= 1);

CREATE INDEX IF NOT EXISTS idx_grocery_lists_meal_plan_ids
  ON public.grocery_lists
  USING GIN (meal_plan_ids);

COMMIT;
