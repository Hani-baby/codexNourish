-- Verification Script: Household Integrity Checks
-- Purpose: Verify all users have proper household setup
-- Date: 2025-10-09

-- Check 1: Users without household memberships
SELECT 
  au.id as user_id,
  au.email,
  p.display_name,
  'Missing household membership' as issue
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
LEFT JOIN household_members hm ON hm.user_id = au.id AND hm.status = 'active'
WHERE hm.household_id IS NULL
ORDER BY au.created_at DESC;

-- Check 2: Households without subscriptions
SELECT 
  h.id as household_id,
  h.name,
  h.created_by,
  'Missing subscription record' as issue
FROM households h
LEFT JOIN household_subscriptions hs ON hs.household_id = h.id
WHERE hs.id IS NULL
ORDER BY h.created_at DESC;

-- Check 3: Household members without valid users
SELECT 
  hm.household_id,
  hm.user_id,
  hm.role,
  hm.status,
  'User does not exist in auth.users' as issue
FROM household_members hm
LEFT JOIN auth.users au ON au.id = hm.user_id
WHERE au.id IS NULL;

-- Check 4: Households with too many active members (future family plan enforcement)
SELECT 
  h.id as household_id,
  h.name,
  COUNT(hm.user_id) as member_count,
  hs.meta->>'tier' as tier,
  'Too many members for tier' as issue
FROM households h
JOIN household_members hm ON hm.household_id = h.id AND hm.status = 'active'
LEFT JOIN household_subscriptions hs ON hs.household_id = h.id
GROUP BY h.id, h.name, hs.meta
HAVING 
  (hs.meta->>'tier' IN ('free', 'individual') AND COUNT(hm.user_id) > 1) OR
  (hs.meta->>'tier' = 'family' AND COUNT(hm.user_id) > 6);

-- Check 5: Summary statistics
SELECT 
  'Total Users' as metric,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Users with Households' as metric,
  COUNT(DISTINCT hm.user_id) as count
FROM household_members hm
WHERE hm.status = 'active'
UNION ALL
SELECT 
  'Total Households' as metric,
  COUNT(*) as count
FROM households
UNION ALL
SELECT 
  'Households with Subscriptions' as metric,
  COUNT(DISTINCT hs.household_id) as count
FROM household_subscriptions hs;

-- Check 6: Subscription tier distribution
SELECT 
  COALESCE(hs.meta->>'tier', 'no_tier') as tier,
  hs.status,
  COUNT(*) as household_count
FROM household_subscriptions hs
GROUP BY hs.meta->>'tier', hs.status
ORDER BY tier, status;

-- Check 7: Users with multiple household memberships (for dual access feature)
SELECT 
  hm.user_id,
  au.email,
  COUNT(hm.household_id) as household_count,
  array_agg(hm.role ORDER BY hm.joined_at) as roles
FROM household_members hm
JOIN auth.users au ON au.id = hm.user_id
WHERE hm.status = 'active'
GROUP BY hm.user_id, au.email
HAVING COUNT(hm.household_id) > 1;

