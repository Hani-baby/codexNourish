# Chef Nourish System User

This migration creates a special system user for Chef Nourish, the AI-powered meal planning assistant.

## What It Does

- Creates a system user in `auth.users` with a generated UUID
- Uses the email `chef.nourish@system.local` as a unique identifier
- Creates a corresponding profile in `public.profiles`
- Marks the user as a system/AI user in metadata
- Cannot be logged into (random, unguessable password)

## Why Dynamic UUID?

Instead of hardcoding a UUID like `00000000-0000-4000-8000-000000000001`, we:
1. Let Supabase generate the UUID automatically
2. Look up Chef Nourish by email (`chef.nourish@system.local`) 
3. Cache the UUID in memory for performance

## How to Run

1. Copy the SQL from `create_chef_nourish_system_user.sql`
2. Run it in your Supabase dashboard SQL Editor
3. Verify by checking the output - you'll see Chef Nourish's actual UUID

## How It Works in Code

The `recipes-ai` Edge Function automatically looks up Chef Nourish's UUID the first time it's needed:

```typescript
const getChefNourishUserId = async (): Promise<string> => {
  if (chefNourishUserIdCache) {
    return chefNourishUserIdCache; // Fast: uses cached UUID
  }
  
  // First call: looks up by email
  const result = await pool.query({
    text: `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
    args: ['chef.nourish@system.local']
  });
  
  chefNourishUserIdCache = result.rows[0].id as string;
  return chefNourishUserIdCache;
};
```

Then when creating recipes, it uses this UUID:

```typescript
const chefNourishId = await getChefNourishUserId();
// Use chefNourishId as created_by for AI-generated recipes
```

## Benefits

✅ **No hardcoded UUIDs** - Works with any Supabase project  
✅ **Cacheable** - Only looks up once per function instance  
✅ **Safe** - Can't be logged into  
✅ **Discoverable** - Can query by email if needed  

