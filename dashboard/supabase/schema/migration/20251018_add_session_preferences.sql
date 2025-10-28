-- Migration: Add session_preferences table
-- Purpose: Support temporary planning preferences per household/user session
-- Date: 2025-10-18

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_session_preferences_household_created
  ON public.session_preferences (household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_preferences_expires
  ON public.session_preferences (expires_at)
  WHERE expires_at IS NOT NULL;

COMMIT;
