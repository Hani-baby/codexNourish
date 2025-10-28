# RLS Infinite Recursion Fix

## Problem Summary
The application was experiencing "infinite recursion detected in policy for relation 'household_members'" errors when fetching meal plans and other household-related data.

## Root Cause Analysis

### Primary Issue: Self-Referential Profiles Policy
The `profiles` table had a policy that queried itself:

```sql
CREATE POLICY "Family members can view parent profile" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT child 
      FROM profiles  -- ⚠️ Querying profiles from profiles policy!
      WHERE id = auth.uid() 
        AND child IS NOT NULL
    )
  );
```

### Recursion Chain
1. User fetches `meal_plans`
2. `meal_plans` RLS policy queries `profiles` table: `WHERE child = auth.uid()`
3. `profiles` RLS policy queries `profiles` table **again** (self-reference)
4. Infinite loop! 💥

### Secondary Issues
- Multiple tables querying `profiles` table (which had self-recursion)
- `household_members` policies had remnants of problematic queries
- Complex cross-table dependencies created circular references

## Solution

### Core Principle
**NEVER query a table from within its own RLS policies**

### Changes Made

#### 1. Fixed `profiles` RLS Policies
**File:** `supabase/migrations/fix_profiles_rls_policies.sql`

**Changes:**
- ❌ Removed self-referential "Family members can view parent profile" policy
- ✅ Simplified to only allow users to view/manage their own profile
- ✅ Added service role bypass for backend operations

**Result:** Users can only access their own profile. Family member access must be handled in application layer.

#### 2. Fixed `household_members` RLS Policies
**File:** `supabase/migrations/add_household_members_rls_policies.sql`

**Changes:**
- ❌ Removed `user_id = auth.uid()` self-referential check
- ❌ Removed all queries to `profiles` table
- ✅ Uses ONLY `households` table for authorization
- ✅ Only household owners can manage household members

#### 3. Fixed `households` RLS Policies
**File:** `supabase/migrations/add_household_rls_policies.sql`

**Changes:**
- ❌ Removed queries to `profiles` table
- ✅ Uses ONLY direct user relationships (`created_by = auth.uid()`)
- ✅ Simplified to owner-only access

#### 4. Fixed `meal_plans` RLS Policies
**File:** `supabase/migrations/fix_meal_plans_rls_policies.sql`

**Changes:**
- ❌ Removed all queries to `profiles` table
- ✅ Uses ONLY `households` table for authorization
- ✅ Checks household ownership via `households.created_by`

#### 5. Fixed `meal_plan_drafts` RLS Policies
**File:** `supabase/migrations/secure_meal_plan_drafts_rls_policies.sql`

**Changes:**
- ❌ Removed all queries to `profiles` table
- ✅ Uses ONLY `households` table for authorization
- ✅ Simplified household membership checks

#### 6. Fixed `meal_plan_items` RLS Policies
**File:** `supabase/migrations/fix_meal_plan_items_rls_policies.sql`

**Changes:**
- ❌ Removed all queries to `profiles` table
- ✅ Uses `households` table through `meal_plans` join
- ✅ Maintains referential integrity while avoiding recursion

## Migration Instructions

### Step 1: Backup Current Policies
```sql
-- Run this in Supabase SQL Editor to document current state
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'households', 'household_members', 'meal_plans', 'meal_plan_drafts', 'meal_plan_items');
```

### Step 2: Apply Fixes in Order
Run these migration files in order:

1. `fix_profiles_rls_policies.sql` - Fix the root cause
2. `add_household_members_rls_policies.sql` - Fix household members
3. `add_household_rls_policies.sql` - Fix households
4. `fix_meal_plans_rls_policies.sql` - Fix meal plans
5. `secure_meal_plan_drafts_rls_policies.sql` - Fix drafts
6. `fix_meal_plan_items_rls_policies.sql` - Fix items

### Step 3: Verify
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'households', 'household_members', 'meal_plans', 'meal_plan_drafts', 'meal_plan_items');

-- Check policies don't reference problematic tables
SELECT tablename, policyname, qual
FROM pg_policies 
WHERE schemaname = 'public'
AND (qual LIKE '%FROM profiles%' OR qual LIKE '%household_members%');
```

### Step 4: Test
1. Try fetching meal plans as a regular user
2. Test household operations
3. Verify no "infinite recursion" errors occur

## Trade-offs & Limitations

### What Was Simplified
1. **Profile Access**: Users can now only view their own profile
2. **Household Access**: Only household owners can manage households
3. **Family Member Access**: Family members no longer have automatic access through RLS

### How to Handle in Application Layer
For features requiring family member access:
- Use **service role** in backend functions
- Implement access control in application logic
- Use Edge Functions with service role credentials

### Example: Family Member Access
```typescript
// In your Edge Function (runs with service role)
const { data: household } = await supabase
  .from('households')
  .select('*')
  .eq('id', householdId)
  .single();

// Check family member relationship in application code
const { data: profile } = await supabase
  .from('profiles')
  .select('child')
  .eq('id', userId)
  .single();

if (profile.child === household.created_by) {
  // Allow family member access
}
```

## Key Takeaways

### ✅ Do's
- Keep RLS policies simple and non-recursive
- Use service role for complex authorization logic
- Reference only external tables, never the same table
- Add `auth.uid() IS NULL` for service role bypass

### ❌ Don'ts
- Never query a table from within its own RLS policy
- Avoid circular dependencies between table policies
- Don't use complex joins in RLS policies
- Don't rely on RLS for all business logic

## Verification Checklist

- [ ] No "infinite recursion" errors when fetching data
- [ ] Household owners can access their data
- [ ] Service role functions work properly
- [ ] Regular users have appropriate access
- [ ] No queries to `profiles` in RLS policies
- [ ] No self-referential queries in any RLS policy
- [ ] All policies include service role bypass

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Avoiding Infinite Recursion in RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#avoiding-infinite-recursion)

---

**Date Fixed:** October 1, 2025  
**Severity:** Critical - Application Breaking  
**Status:** ✅ Resolved

