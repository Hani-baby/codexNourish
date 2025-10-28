# Supabase Edge Functions Secrets Configuration

## Required Secrets

Set these secrets using the Supabase CLI:

```bash
# OpenAI API Key (required for AI features)
supabase secrets set OPENAI_API_KEY=sk-...

# Supabase Configuration
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SUPABASE_ANON_KEY=eyJ...
```

## Getting the Values

### OPENAI_API_KEY
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Ensure you have access to GPT-4o-mini and DALL-E 3

### SUPABASE_URL
1. Go to your Supabase Dashboard
2. Project Settings > API
3. Copy the "Project URL"

### SUPABASE_SERVICE_ROLE_KEY
1. Go to your Supabase Dashboard
2. Project Settings > API
3. Copy the "service_role" key (keep this secret!)

### SUPABASE_ANON_KEY
1. Go to your Supabase Dashboard
2. Project Settings > API
3. Copy the "anon" key

## Verify Secrets

```bash
supabase secrets list
```

## Update a Secret

```bash
supabase secrets set OPENAI_API_KEY=sk-new-key
```

## Remove a Secret

```bash
supabase secrets unset OPENAI_API_KEY
```

