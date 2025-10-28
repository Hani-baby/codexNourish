-- Schema Updates: Subscription System Enhancement
-- Purpose: Add tier tracking and helper functions for subscription management
-- Date: 2025-10-09

------------------------------------------------------------------------------
-- 1. Update household_subscriptions table to include tier
------------------------------------------------------------------------------

-- Add tier column if it doesn't exist (stored in meta for now, can be migrated to column later)
-- The tier is stored in meta jsonb as meta->>'tier'

-- Add index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_household_subscriptions_tier 
  ON public.household_subscriptions ((meta->>'tier'));

-- Add index for household_id lookups
CREATE INDEX IF NOT EXISTS idx_household_subscriptions_household_id 
  ON public.household_subscriptions (household_id);

------------------------------------------------------------------------------
-- 2. Seed subscription plans
------------------------------------------------------------------------------

-- Insert or update subscription plans
INSERT INTO public.subscription_plans (slug, name, description, price_cents, billing_interval, features, is_active)
VALUES 
  (
    'free',
    'Free Plan',
    'Perfect for getting started with basic meal planning',
    0,
    'monthly',
    jsonb_build_object(
      'ai_meal_plans_per_period', 0.5, -- once every 2 months
      'max_meal_plan_days', 7,
      'recipe_access_limit', 21,
      'grocery_lists', false,
      'instacart_integration', false,
      'community_access', false,
      'ai_chef', false,
      'max_household_members', 1
    ),
    true
  ),
  (
    'individual',
    'Individual Pro',
    'For personal nutrition optimization with unlimited features',
    999, -- $9.99
    'monthly',
    jsonb_build_object(
      'ai_meal_plans_per_period', 999, -- unlimited
      'max_meal_plan_days', 365,
      'recipe_access_limit', 999999, -- unlimited
      'grocery_lists', true,
      'instacart_integration', true,
      'community_access', true,
      'ai_chef', true,
      'max_household_members', 1
    ),
    true
  ),
  (
    'family',
    'Family Plan',
    'Perfect for families and households with up to 6 members',
    1999, -- $19.99
    'monthly',
    jsonb_build_object(
      'ai_meal_plans_per_period', 999, -- unlimited
      'max_meal_plan_days', 365,
      'recipe_access_limit', 999999, -- unlimited
      'grocery_lists', true,
      'instacart_integration', true,
      'community_access', true,
      'ai_chef', true,
      'max_household_members', 6
    ),
    true
  )
ON CONFLICT (slug) 
DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

------------------------------------------------------------------------------
-- 3. Helper Functions
------------------------------------------------------------------------------

-- Function: Get household's current tier
CREATE OR REPLACE FUNCTION public.get_household_tier(p_household_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT hs.meta->>'tier'
  INTO v_tier
  FROM public.household_subscriptions hs
  WHERE hs.household_id = p_household_id
    AND hs.status = 'active'
  ORDER BY hs.created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_tier, 'free');
END;
$$;

-- Function: Get subscription plan features
CREATE OR REPLACE FUNCTION public.get_plan_features(p_tier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_features jsonb;
BEGIN
  SELECT sp.features
  INTO v_features
  FROM public.subscription_plans sp
  WHERE sp.slug = p_tier
    AND sp.is_active = true;
  
  RETURN COALESCE(v_features, '{}'::jsonb);
END;
$$;

-- Function: Check if user can generate AI meal plan
CREATE OR REPLACE FUNCTION public.can_generate_meal_plan(
  p_user_id uuid,
  p_household_id uuid,
  p_plan_duration_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_features jsonb;
  v_last_generation timestamptz;
  v_days_since_last integer;
  v_max_days integer;
  v_can_generate boolean := false;
  v_reason text := '';
BEGIN
  -- Get household tier
  v_tier := public.get_household_tier(p_household_id);
  v_features := public.get_plan_features(v_tier);
  
  -- Get max allowed days for plan
  v_max_days := (v_features->>'max_meal_plan_days')::integer;
  
  -- Check if plan duration exceeds limit
  IF p_plan_duration_days > v_max_days THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Plan duration (%s days) exceeds tier limit (%s days)', p_plan_duration_days, v_max_days),
      'tier', v_tier,
      'max_days', v_max_days
    );
  END IF;
  
  -- For free tier, check last generation date
  IF v_tier = 'free' THEN
    -- Get last AI-generated meal plan
    SELECT MAX(mp.created_at)
    INTO v_last_generation
    FROM public.meal_plans mp
    WHERE mp.household_id = p_household_id
      AND mp.generated_by = 'ai';
    
    IF v_last_generation IS NOT NULL THEN
      v_days_since_last := EXTRACT(DAY FROM NOW() - v_last_generation)::integer;
      
      -- Free tier: once every 60 days (2 months)
      IF v_days_since_last < 60 THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'reason', format('Free tier allows AI generation once per 60 days. Last generation was %s days ago.', v_days_since_last),
          'tier', v_tier,
          'days_until_next', 60 - v_days_since_last,
          'last_generation', v_last_generation
        );
      END IF;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'Plan generation allowed',
    'tier', v_tier,
    'max_days', v_max_days
  );
END;
$$;

-- Function: Check if user can access grocery lists
CREATE OR REPLACE FUNCTION public.can_access_grocery_lists(p_household_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_features jsonb;
BEGIN
  v_tier := public.get_household_tier(p_household_id);
  v_features := public.get_plan_features(v_tier);
  
  RETURN COALESCE((v_features->>'grocery_lists')::boolean, false);
END;
$$;

-- Function: Check if user can access Instacart integration
CREATE OR REPLACE FUNCTION public.can_access_instacart(p_household_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_features jsonb;
BEGIN
  v_tier := public.get_household_tier(p_household_id);
  v_features := public.get_plan_features(v_tier);
  
  RETURN COALESCE((v_features->>'instacart_integration')::boolean, false);
END;
$$;

-- Function: Check if user can access AI Chef
CREATE OR REPLACE FUNCTION public.can_access_ai_chef(p_household_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_features jsonb;
BEGIN
  v_tier := public.get_household_tier(p_household_id);
  v_features := public.get_plan_features(v_tier);
  
  RETURN COALESCE((v_features->>'ai_chef')::boolean, false);
END;
$$;

-- Function: Get recipe access limit for household
CREATE OR REPLACE FUNCTION public.get_recipe_limit(p_household_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_features jsonb;
BEGIN
  v_tier := public.get_household_tier(p_household_id);
  v_features := public.get_plan_features(v_tier);
  
  RETURN COALESCE((v_features->>'recipe_access_limit')::integer, 21);
END;
$$;

-- Function: Get max household members allowed
CREATE OR REPLACE FUNCTION public.get_max_household_members(p_household_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_features jsonb;
BEGIN
  v_tier := public.get_household_tier(p_household_id);
  v_features := public.get_plan_features(v_tier);
  
  RETURN COALESCE((v_features->>'max_household_members')::integer, 1);
END;
$$;

-- Function: Check if household can add more members
CREATE OR REPLACE FUNCTION public.can_add_household_member(p_household_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count integer;
  v_max_allowed integer;
BEGIN
  -- Get current active member count
  SELECT COUNT(*)
  INTO v_current_count
  FROM public.household_members
  WHERE household_id = p_household_id
    AND status = 'active';
  
  -- Get max allowed
  v_max_allowed := public.get_max_household_members(p_household_id);
  
  IF v_current_count >= v_max_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Household has reached maximum member limit (%s/%s)', v_current_count, v_max_allowed),
      'current_count', v_current_count,
      'max_allowed', v_max_allowed
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current_count,
    'max_allowed', v_max_allowed
  );
END;
$$;

------------------------------------------------------------------------------
-- 4. Trigger to enforce household member limits
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_household_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_result jsonb;
BEGIN
  -- Only check when adding or reactivating members
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status != 'active')) THEN
    v_check_result := public.can_add_household_member(NEW.household_id);
    
    IF NOT (v_check_result->>'allowed')::boolean THEN
      RAISE EXCEPTION '%', v_check_result->>'reason';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trg_enforce_household_member_limit ON public.household_members;
CREATE TRIGGER trg_enforce_household_member_limit
  BEFORE INSERT OR UPDATE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_household_member_limit();

------------------------------------------------------------------------------
-- 5. Grant necessary permissions
------------------------------------------------------------------------------

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_household_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_features(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_generate_meal_plan(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_grocery_lists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_instacart(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_ai_chef(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recipe_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_max_household_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_household_member(uuid) TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Schema updates completed successfully!';
  RAISE NOTICE '✓ Added subscription tier indexes';
  RAISE NOTICE '✓ Seeded subscription plans (free, individual, family)';
  RAISE NOTICE '✓ Created helper functions for tier management';
  RAISE NOTICE '✓ Created trigger to enforce household member limits';
END $$;

