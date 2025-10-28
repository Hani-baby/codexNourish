import { supabase } from './supabase'

export interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  household_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'invited' | 'active' | 'removed'
  joined_at: string
}

// Ensure user has a household (create one if they don't)
export async function ensureUserHasHousehold(userId: string): Promise<string> {
  // Check if user is already in a household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (membership) {
    return membership.household_id
  }

  // Create a default household for the user
  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({
      name: 'My Household',
      created_by: userId
    })
    .select()
    .single()

  if (householdError) throw householdError

  // Add user as owner of the household
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: userId,
      role: 'owner',
      status: 'active'
    })

  if (memberError) throw memberError

  return household.id
}

// Get user's household
export async function getUserHousehold(userId: string): Promise<Household | null> {
  const { data: membership } = await supabase
    .from('household_members')
    .select(`
      household_id,
      households (
        id,
        name,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (!membership || !membership.households) {
    return null
  }

  return membership.households as any
}

// Get household members
export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return data || []
}

// Fix existing users without households
export async function fixUsersWithoutHouseholds(): Promise<{ fixed: number; errors: string[] }> {
  const errors: string[] = []
  let fixed = 0

  try {
    // Get all users who don't have an active household membership
    const { data: usersWithoutHouseholds, error } = await supabase
      .from('profiles')
      .select(`
        id,
        household_members!left (
          household_id,
          status
        )
      `)
      .is('household_members.household_id', null)

    if (error) {
      errors.push(`Failed to fetch users: ${error.message}`)
      return { fixed, errors }
    }

    console.log(`Found ${usersWithoutHouseholds?.length || 0} users without households`)

    // Create households for each user
    for (const user of usersWithoutHouseholds || []) {
      try {
        await ensureUserHasHousehold(user.id)
        fixed++
        console.log(`✅ Created household for user: ${user.id}`)
      } catch (error) {
        const errorMsg = `Failed to create household for user ${user.id}: ${error}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    return { fixed, errors }
  } catch (error) {
    errors.push(`Unexpected error: ${error}`)
    return { fixed, errors }
  }
}