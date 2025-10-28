-- RLS Policies for Household and Subscription System
-- Purpose: Allow users to read their household memberships and subscriptions
-- Date: 2025-10-09

------------------------------------------------------------------------------
-- Enable RLS on all tables (if not already enabled)
------------------------------------------------------------------------------

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_preference_snapshot ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- Household Members Policies
------------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own household memberships" ON public.household_members;
DROP POLICY IF EXISTS "Users can view members in their households" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert themselves as household members" ON public.household_members;
DROP POLICY IF EXISTS "Household owners can manage members" ON public.household_members;

-- Allow users to view their own household memberships
CREATE POLICY "Users can view their own household memberships"
ON public.household_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to view other members in households they belong to
CREATE POLICY "Users can view members in their households"
ON public.household_members
FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Allow users to insert themselves as household members (for new household creation)
CREATE POLICY "Users can insert themselves as household members"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow household owners/admins to manage members
CREATE POLICY "Household owners can manage members"
ON public.household_members
FOR ALL
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

------------------------------------------------------------------------------
-- Households Policies
------------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their households" ON public.households;
DROP POLICY IF EXISTS "Users can create households" ON public.households;
DROP POLICY IF EXISTS "Household owners can update their household" ON public.households;

-- Allow users to view households they're members of
CREATE POLICY "Users can view their households"
ON public.households
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Allow users to create households
CREATE POLICY "Users can create households"
ON public.households
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Allow household owners to update their household
CREATE POLICY "Household owners can update their household"
ON public.households
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
    AND status = 'active'
  )
);

------------------------------------------------------------------------------
-- Household Subscriptions Policies
------------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their household subscriptions" ON public.household_subscriptions;
DROP POLICY IF EXISTS "Users can manage their household subscriptions" ON public.household_subscriptions;

-- Allow users to view subscriptions for households they're members of
CREATE POLICY "Users can view their household subscriptions"
ON public.household_subscriptions
FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Allow household owners to manage subscriptions
CREATE POLICY "Users can manage their household subscriptions"
ON public.household_subscriptions
FOR ALL
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

------------------------------------------------------------------------------
-- Household Invites Policies
------------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view invites to their email" ON public.household_invites;
DROP POLICY IF EXISTS "Household members can view invites" ON public.household_invites;
DROP POLICY IF EXISTS "Household owners can manage invites" ON public.household_invites;

-- Allow users to view invites sent to their email
CREATE POLICY "Users can view invites to their email"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
  invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Allow household members to view invites for their household
CREATE POLICY "Household members can view invites"
ON public.household_invites
FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Allow household owners to manage invites
CREATE POLICY "Household owners can manage invites"
ON public.household_invites
FOR ALL
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

------------------------------------------------------------------------------
-- Household Preference Snapshot Policies
------------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their household preferences" ON public.household_preference_snapshot;
DROP POLICY IF EXISTS "Household owners can manage preferences" ON public.household_preference_snapshot;

-- Allow users to view preferences for households they're members of
CREATE POLICY "Users can view their household preferences"
ON public.household_preference_snapshot
FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Allow household owners to manage preferences
CREATE POLICY "Household owners can manage preferences"
ON public.household_preference_snapshot
FOR ALL
TO authenticated
USING (
  household_id IN (
    SELECT household_id 
    FROM public.household_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

------------------------------------------------------------------------------
-- Grant necessary permissions
------------------------------------------------------------------------------

-- Grant access to authenticated users
GRANT SELECT ON public.household_members TO authenticated;
GRANT INSERT ON public.household_members TO authenticated;
GRANT UPDATE ON public.household_members TO authenticated;
GRANT DELETE ON public.household_members TO authenticated;

GRANT SELECT ON public.households TO authenticated;
GRANT INSERT ON public.households TO authenticated;
GRANT UPDATE ON public.households TO authenticated;

GRANT SELECT ON public.household_subscriptions TO authenticated;
GRANT INSERT ON public.household_subscriptions TO authenticated;
GRANT UPDATE ON public.household_subscriptions TO authenticated;

GRANT SELECT ON public.household_invites TO authenticated;
GRANT INSERT ON public.household_invites TO authenticated;
GRANT UPDATE ON public.household_invites TO authenticated;
GRANT DELETE ON public.household_invites TO authenticated;

GRANT SELECT ON public.household_preference_snapshot TO authenticated;
GRANT INSERT ON public.household_preference_snapshot TO authenticated;

-- Grant full access to service_role (for edge functions)
GRANT ALL ON public.household_members TO service_role;
GRANT ALL ON public.households TO service_role;
GRANT ALL ON public.household_subscriptions TO service_role;
GRANT ALL ON public.household_invites TO service_role;
GRANT ALL ON public.household_preference_snapshot TO service_role;

------------------------------------------------------------------------------
-- Success notification
------------------------------------------------------------------------------

DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies created successfully for household system';
  RAISE NOTICE '✓ Policies allow users to view their own household memberships';
  RAISE NOTICE '✓ Policies allow household owners to manage their households';
  RAISE NOTICE '✓ Service role has full access for edge functions';
END $$;

