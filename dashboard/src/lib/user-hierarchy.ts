import { supabase } from './supabase'

export interface UserHierarchy {
  userId: string
  effectiveUserId: string // The ID to use for data access (master for family, self for individual)
  isFamilyTier: boolean
  isChildUser: boolean
  masterUserId?: string
}

/**
 * Get the effective user ID for data access based on the family tier system
 * 
 * For family tier:
 * - Child users use the master user's ID for permissions
 * - Master users use their own ID
 * 
 * For individual tier:
 * - Users use their own ID directly
 */
export async function getUserHierarchy(userId?: string): Promise<UserHierarchy> {
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = userId || user?.id
  
  if (!currentUserId) {
    throw new Error('No authenticated user')
  }

  // Get the user's profile to check for child relationship
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, child')
    .eq('id', currentUserId)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    // Fallback to individual tier behavior
    return {
      userId: currentUserId,
      effectiveUserId: currentUserId,
      isFamilyTier: false,
      isChildUser: false
    }
  }

  // Check if this user has a child (is a master user)
  const isChildUser = !!profile.child
  
  if (isChildUser) {
    // This is a child user, use the master user's ID for data access
    return {
      userId: currentUserId,
      effectiveUserId: profile.child, // Use master's ID for permissions
      isFamilyTier: true,
      isChildUser: true,
      masterUserId: profile.child
    }
  } else {
    // Check if this user is a master by looking for any profiles that reference them as child
    const { data: childProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('child', currentUserId)
      .limit(1)

    const isFamilyTier = (childProfiles && childProfiles.length > 0)

    return {
      userId: currentUserId,
      effectiveUserId: currentUserId, // Master users use their own ID
      isFamilyTier,
      isChildUser: false
    }
  }
}

/**
 * Get the effective user ID for a specific user (helper function)
 */
export async function getEffectiveUserId(userId?: string): Promise<string> {
  const hierarchy = await getUserHierarchy(userId)
  return hierarchy.effectiveUserId
}

/**
 * Check if the current user can access data for a specific user ID
 * This handles both individual and family tier permissions
 */
export async function canAccessUserData(targetUserId: string, currentUserId?: string): Promise<boolean> {
  const currentHierarchy = await getUserHierarchy(currentUserId)
  const targetHierarchy = await getUserHierarchy(targetUserId)

  // Same user
  if (currentHierarchy.userId === targetUserId) {
    return true
  }

  // Same effective user (family tier)
  if (currentHierarchy.effectiveUserId === targetHierarchy.effectiveUserId) {
    return true
  }

  // Master can access child data
  if (currentHierarchy.userId === targetHierarchy.masterUserId) {
    return true
  }

  // Child can access master data
  if (currentHierarchy.masterUserId === targetUserId) {
    return true
  }

  return false
}