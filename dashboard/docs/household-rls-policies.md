# Household RLS Policies Documentation

## Overview

This document explains the Row Level Security (RLS) policies implemented for household-related tables to ensure proper access control while maintaining functionality for service operations and avoiding infinite recursion issues.

## Tables Covered

### 1. households
**Purpose**: Stores household information and ownership

**Previous State**: RLS was disabled to prevent infinite recursion
**Current State**: RLS enabled with secure, non-recursive policies

**Policies**:
- **View**: Users can view households they created or belong to (via profiles.child)
- **Create**: Users can create households (becomes owner)
- **Update**: Users can update households they created
- **Delete**: Users can delete households they created
- **Service Role**: All operations allow service role access (when auth.uid() is null)

### 2. household_members
**Purpose**: Manages household membership and roles

**Previous State**: RLS was disabled to prevent infinite recursion
**Current State**: RLS enabled with secure, non-recursive policies

**Policies**:
- **View**: Users can view members of households they belong to
- **Create**: Users can add members to households they own
- **Update**: Users can update members of households they own
- **Delete**: Users can remove members from households they own
- **Service Role**: All operations allow service role access (when auth.uid() is null)

### 3. household_invites
**Purpose**: Manages household invitations

**Previous State**: No RLS policies
**Current State**: RLS enabled with secure policies

**Policies**:
- **View**: Users can view invites for households they own or their own invites
- **Create**: Users can create invites for households they own
- **Update**: Users can update invites for households they own
- **Delete**: Users can delete invites for households they own
- **Service Role**: All operations allow service role access (when auth.uid() is null)

## Infinite Recursion Prevention

### The Problem
The original issue was circular dependencies:
1. `households` policies referenced `household_members`
2. `household_members` policies referenced `households`
3. This created infinite recursion during policy evaluation

### The Solution
Our policies avoid this by:
1. **Direct Relationships**: Using `households.created_by` and `profiles.child` instead of circular references
2. **Non-Recursive Queries**: Policies don't reference each other
3. **Service Role Support**: All policies allow service role operations

## Security Considerations

### What These Policies Protect Against

1. **Cross-Household Access**: Users cannot access other households' data
2. **Unauthorized Member Management**: Users cannot manage members of households they don't own
3. **Invite Manipulation**: Users cannot manipulate invites for households they don't own
4. **Data Leakage**: Prevents accidental exposure of household data

### What These Policies Allow

1. **Service Functions**: Backend functions can operate with service role permissions
2. **Household Ownership**: Owners can manage their households and members
3. **Family Access**: Family members (via profiles.child) can access shared household data
4. **Invite System**: Proper invite management for household invitations

## Access Patterns

### Household Owner (created_by)
- ✅ Full access to household data
- ✅ Can manage household members
- ✅ Can create/update/delete invites
- ✅ Can update household information

### Family Member (profiles.child)
- ✅ Can view household data
- ✅ Can view household members
- ✅ Can view household invites
- ❌ Cannot manage members (only owner can)
- ❌ Cannot manage invites (only owner can)

### Service Role
- ✅ Full access for backend operations
- ✅ Can create/update/delete all records
- ✅ Bypasses all user restrictions

## Implementation Files

- `supabase/migrations/add_household_rls_policies.sql` - Adds RLS to households
- `supabase/migrations/add_household_members_rls_policies.sql` - Adds RLS to household_members
- `supabase/migrations/add_household_invites_rls_policies.sql` - Adds RLS to household_invites

## Migration Order

1. Apply `add_household_rls_policies.sql` first
2. Apply `add_household_members_rls_policies.sql` second
3. Apply `add_household_invites_rls_policies.sql` third
4. Test functionality after each migration

## Testing Recommendations

1. **Household Access**: Verify users can only access their own households
2. **Member Management**: Test that only owners can manage members
3. **Invite System**: Ensure proper invite access control
4. **Service Functions**: Test that backend functions still work
5. **Family Access**: Verify family members can access shared data

## Rollback Plan

If issues arise:
1. **households**: `ALTER TABLE public.households DISABLE ROW LEVEL SECURITY;`
2. **household_members**: `ALTER TABLE public.household_members DISABLE ROW LEVEL SECURITY;`
3. **household_invites**: `ALTER TABLE public.household_invites DISABLE ROW LEVEL SECURITY;`

## Security Benefits

- **Data Isolation**: Users can only access their own household data
- **Role-Based Access**: Proper separation between owners and family members
- **Service Compatibility**: Backend functions continue to work
- **No Infinite Recursion**: Policies are designed to avoid circular dependencies
- **Audit Trail**: All access is properly logged through RLS

## Key Design Decisions

1. **Non-Recursive Policies**: Avoid circular references between tables
2. **Service Role Support**: All policies allow service role operations
3. **Family Member Support**: Use profiles.child relationship for family access
4. **Owner Privileges**: Clear distinction between owner and member permissions
5. **Invite Security**: Proper access control for invitation system
