-- FIXED RLS Policies for Household System
-- Purpose: Simpler policies that avoid circular dependencies
-- Date: 2025-10-09
-- Issue: Previous policies caused recursive lookups resulting in 500 errors

------------------------------------------------------------------------------
-- IMPORTANT: Drop ALL existing policies first to avoid conflicts
------------------------------------------------------------------------------

-- household_members policies
DROP POLICY IF EXISTS "Household members delete" ON public.household_members;
DROP POLICY IF EXISTS "Household members insert" ON public.household_members;
DROP POLICY IF EXISTS "Household members read" ON public.household_members;
DROP POLICY IF EXISTS "Household members update" ON public.household_members;
DROP POLICY IF EXISTS "Household owners can manage members" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert themselves as household members" ON public.household_members;
DROP POLICY IF EXISTS "Users can view members in their households" ON public.household_members;
DROP POLICY IF EXISTS "Users can view their own household memberships" ON public.household_members;

-- households policies
DROP POLICY IF EXISTS "Households create" ON public.households;
DROP POLICY IF EXISTS "Households delete" ON public.households;
DROP POLICY IF EXISTS "Households update" ON public.households;
DROP POLICY IF EXISTS "Households view" ON public.households;
DROP POLICY IF EXISTS "Users can create households" ON public.households;
DROP POLICY IF EXISTS "Household owners can update their household" ON public.households;
DROP POLICY IF EXISTS "Users can view their households" ON public.households;

-- household_subscriptions policies  
DROP POLICY IF EXISTS "Users can view their household subscriptions" ON public.household_subscriptions;
DROP POLICY IF EXISTS "Users can manage their household subscriptions" ON public.household_subscriptions;

------------------------------------------------------------------------------
-- SIMPLIFIED household_members policies (NO RECURSION)
------------------------------------------------------------------------------

-- Simple: Users can see ALL their own membership records
CREATE POLICY "allow_own_member_records"
ON public.household_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Simple: Users can insert themselves as members
CREATE POLICY "allow_self_insert"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Simple: Users can update their own membership records
CREATE POLICY "allow_self_update"
ON public.household_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

------------------------------------------------------------------------------
-- SIMPLIFIED households policies
------------------------------------------------------------------------------

-- Users can view households they created
CREATE POLICY "allow_view_own_households"
ON public.households
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Users can create new households
CREATE POLICY "allow_create_households"
ON public.households
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Users can update households they created
CREATE POLICY "allow_update_own_households"
ON public.households
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

------------------------------------------------------------------------------
-- SIMPLIFIED household_subscriptions policies
------------------------------------------------------------------------------

-- Allow viewing subscriptions for households the user created
CREATE POLICY "allow_view_own_subscriptions"
ON public.household_subscriptions
FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT id FROM public.households WHERE created_by = auth.uid()
  )
);

-- Allow managing subscriptions for households the user created
CREATE POLICY "allow_manage_own_subscriptions"
ON public.household_subscriptions
FOR ALL
TO authenticated
USING (
  household_id IN (
    SELECT id FROM public.households WHERE created_by = auth.uid()
  )
)
WITH CHECK (
  household_id IN (
    SELECT id FROM public.households WHERE created_by = auth.uid()
  )
);

------------------------------------------------------------------------------
-- Grant permissions (unchanged)
------------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_subscriptions TO authenticated;

-- Service role gets full access (bypasses RLS)
GRANT ALL ON public.household_members TO service_role;
GRANT ALL ON public.households TO service_role;
GRANT ALL ON public.household_subscriptions TO service_role;

------------------------------------------------------------------------------
-- Success notification
------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ FIXED RLS policies applied successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '- Removed circular policy dependencies';
  RAISE NOTICE '- Simplified household_members SELECT policy';
  RAISE NOTICE '- Users can now query their own memberships';
  RAISE NOTICE '- No more 500 Internal Server Error';
  RAISE NOTICE '';
  RAISE NOTICE 'Test with:';
  RAISE NOTICE 'SELECT * FROM household_members WHERE user_id = auth.uid();';
  RAISE NOTICE '';
END $$;

