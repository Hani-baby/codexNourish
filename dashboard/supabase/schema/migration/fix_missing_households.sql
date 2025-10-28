-- Migration Script: Fix Missing Households
-- Purpose: Ensure all users have household memberships
-- Date: 2025-10-09

-- Step 1: Find users without household memberships and create households for them
DO $$
DECLARE
  user_record RECORD;
  new_household_id uuid;
  users_fixed INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting household membership fix...';
  
  -- Loop through all users who don't have an active household membership
  FOR user_record IN 
    SELECT DISTINCT au.id, au.email, p.display_name
    FROM auth.users au
    LEFT JOIN profiles p ON p.id = au.id
    LEFT JOIN household_members hm ON hm.user_id = au.id AND hm.status = 'active'
    WHERE hm.household_id IS NULL
  LOOP
    RAISE NOTICE 'Processing user: % (%)', user_record.email, user_record.id;
    
    BEGIN
      -- Create a household for this user
      INSERT INTO public.households (name, created_by)
      VALUES (
        COALESCE(user_record.display_name || '''s Household', 'My Household'),
        user_record.id
      )
      RETURNING id INTO new_household_id;
      
      RAISE NOTICE '  ✓ Created household: %', new_household_id;
      
      -- Add user as owner in household_members table
      INSERT INTO public.household_members (household_id, user_id, role, status)
      VALUES (new_household_id, user_record.id, 'owner', 'active');
      
      RAISE NOTICE '  ✓ Added user to household_members as owner';
      
      -- Create free tier subscription for this household
      INSERT INTO public.household_subscriptions (household_id, status, meta)
      VALUES (
        new_household_id, 
        'active',
        jsonb_build_object(
          'tier', 'free',
          'created_by_migration', true,
          'migration_date', NOW()
        )
      );
      
      RAISE NOTICE '  ✓ Created free tier subscription';
      
      users_fixed := users_fixed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '  ✗ Failed to fix user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migration complete. Fixed % users.', users_fixed;
END $$;

-- Step 2: Verification queries
-- Check if any users still don't have households
SELECT 
  COUNT(*) as users_without_households,
  'Users still missing household memberships' as description
FROM auth.users au
LEFT JOIN household_members hm ON hm.user_id = au.id AND hm.status = 'active'
WHERE hm.household_id IS NULL;

-- Summary of household memberships
SELECT 
  hm.role,
  hm.status,
  COUNT(*) as count
FROM household_members hm
GROUP BY hm.role, hm.status
ORDER BY hm.role, hm.status;

-- Summary of household subscriptions
SELECT 
  meta->>'tier' as tier,
  status,
  COUNT(*) as count
FROM household_subscriptions
GROUP BY meta->>'tier', status
ORDER BY tier, status;

