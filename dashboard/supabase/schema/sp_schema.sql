-- Nourish Dashboard core schema
-- Generated to align with consolidated RLS policies and helper functions
-- Tables are ordered to satisfy foreign key dependencies and cascading deletes

------------------------------------------------------------------------------
-- User profile and personalization domain
------------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  date_of_birth date,
  gender text,
  height_cm numeric(5, 2),
  weight_kg numeric(6, 2),
  onboarding_complete boolean NOT NULL DEFAULT false,
  child uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  subscription text NOT NULL DEFAULT 'free',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_child_unique
  ON public.profiles (child)
  WHERE child IS NOT NULL;

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  dietary_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooking_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_persona jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  height_cm numeric(5, 2),
  weight_kg numeric(6, 2),
  body_fat_percentage numeric(5, 2),
  lean_mass_kg numeric(6, 2),
  notes text,
  CONSTRAINT chk_user_body_metrics_non_negative
    CHECK (
      COALESCE(height_cm, 0) >= 0 AND
      COALESCE(weight_kg, 0) >= 0 AND
      COALESCE(body_fat_percentage, 0) >= 0 AND
      COALESCE(lean_mass_kg, 0) >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_user_body_metrics_user_recorded
  ON public.user_body_metrics (user_id, recorded_at DESC);

CREATE TABLE public.nutrition_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  calories_kcal integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  fiber_g integer,
  strategy text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_nutrition_goals_non_negative
    CHECK (
      COALESCE(calories_kcal, 0) >= 0 AND
      COALESCE(protein_g, 0) >= 0 AND
      COALESCE(carbs_g, 0) >= 0 AND
      COALESCE(fat_g, 0) >= 0 AND
      COALESCE(fiber_g, 0) >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user
  ON public.nutrition_goals (user_id, created_at DESC);

------------------------------------------------------------------------------
-- Subscription catalog (referenced by households)
------------------------------------------------------------------------------

CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true
);

------------------------------------------------------------------------------
-- Household and subscription domain
------------------------------------------------------------------------------

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_households_created_by
  ON public.households (created_by);

CREATE TABLE public.household_members (
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id),
  CONSTRAINT chk_household_member_role
    CHECK (role = ANY (ARRAY['owner','admin','member','child'])),
  CONSTRAINT chk_household_member_status
    CHECK (status = ANY (ARRAY['invited','active','removed']))
);

CREATE INDEX IF NOT EXISTS idx_household_members_user
  ON public.household_members (user_id);

CREATE TABLE public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_household_invite_status
    CHECK (status = ANY (ARRAY['pending','accepted','expired','revoked'])),
  CONSTRAINT uq_household_invite_token UNIQUE (token)
);

CREATE TABLE public.household_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'inactive',
  renewal_date date,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.household_preference_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.session_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_session_preferences_household_created
  ON public.session_preferences (household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_preferences_expires
  ON public.session_preferences (expires_at)
  WHERE expires_at IS NOT NULL;

------------------------------------------------------------------------------
-- Ingredient and recipe domain
------------------------------------------------------------------------------

CREATE TABLE public.units (
  id text PRIMARY KEY,
  label text NOT NULL,
  unit_type text NOT NULL,
  conversion_to_grams numeric(18,6),
  conversion_to_milliliters numeric(18,6)
);

CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  default_unit text REFERENCES public.units (id) ON DELETE SET NULL,
  pantry_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

create table public.recipes (
  id uuid not null default gen_random_uuid (),
  created_by uuid null,
  title text not null,
  slug text not null,
  summary text null,
  instructions text null,
  image_url text null,
  source_url text null,
  prep_min integer null,
  cook_min integer null,
  servings numeric not null default 1,
  dietary_tags text[] not null default '{}'::text[],
  cuisine text[] null,
  is_public boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  inspired uuid null,
  constraint recipes_pkey primary key (id),
  constraint recipes_slug_key unique (slug),
  constraint recipes_created_by_fkey foreign KEY (created_by) references auth.users (id) on delete CASCADE,
  constraint recipes_inspired_fkey foreign KEY (inspired) references profiles (id),
  constraint chk_recipe_prep_min check (
    (
      (prep_min is null)
      or (prep_min >= 0)
    )
  ),
  constraint chk_recipe_servings check ((servings > (0)::numeric)),
  constraint chk_recipe_cook_min check (
    (
      (cook_min is null)
      or (cook_min >= 0)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_recipes_created_by on public.recipes using btree (created_by) TABLESPACE pg_default;


CREATE TABLE public.recipe_ingredients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
    ingredient_id uuid REFERENCES public.ingredients (id) ON DELETE RESTRICT,
    ingredient_name text NOT NULL,
    quantity numeric,
    unit_id text REFERENCES public.units (id) ON DELETE SET NULL,
    unit_name text,
    preparation text,
    notes text,
    order_index integer NOT NULL DEFAULT 0,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT chk_recipe_ingredient_quantity CHECK (quantity IS NULL OR quantity > 0),
    CONSTRAINT chk_recipe_ingredients_identifier CHECK (
      ingredient_id IS NOT NULL
      OR (ingredient_name IS NOT NULL AND length(trim(ingredient_name)) > 0)
    ),
    CONSTRAINT chk_recipe_ingredients_unit_name CHECK (
      unit_name IS NULL OR length(trim(unit_name)) > 0
    )
  );

  CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON public.recipe_ingredients (recipe_id);

CREATE TABLE public.recipe_nutrition (
  recipe_id uuid PRIMARY KEY REFERENCES public.recipes (id) ON DELETE CASCADE,
  calories_kcal integer,
  protein_g numeric(10,2),
  carbs_g numeric(10,2),
  fat_g numeric(10,2),
  fiber_g numeric(10,2),
  sugar_g numeric(10,2),
  sodium_mg integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.recipe_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    rating integer NOT NULL,
    review text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_recipe_rating_range CHECK (rating BETWEEN 1 AND 5)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_ratings_unique
    ON public.recipe_ratings (recipe_id, user_id);

CREATE TABLE public.recipe_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id uuid NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
    step_number integer NOT NULL CHECK (step_number > 0),
    instruction text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
    ON public.recipe_steps (recipe_id);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_steps_recipe_step_number
    ON public.recipe_steps (recipe_id, step_number);

  ------------------------------------------------------------------------------
  -- Async jobs (used by All Service functions)
  ------------------------------------------------------------------------------
  create table public.async_jobs (
    id uuid not null default gen_random_uuid (),
  user_id uuid null,
  job_type text not null,
  status text not null default 'pending'::text,
  progress integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  result jsonb null,
  error text null,
  queued_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  version integer not null default 1,
  meta jsonb not null default '{}'::jsonb,
  constraint async_jobs_pkey primary key (id),
  constraint async_jobs_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint chk_async_job_status check (
    (
      status = any (
        array[
          'pending'::text,
          'processing'::text,
          'completed'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint chk_async_jobs_progress_range check (
    (
      (progress >= 0)
      and (progress <= 100)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_async_jobs_user_status on public.async_jobs using btree (user_id, status, queued_at desc) TABLESPACE pg_default;

create index IF not exists idx_async_jobs_user_status_queued on public.async_jobs using btree (user_id, status, queued_at desc) TABLESPACE pg_default;

create index IF not exists idx_async_jobs_job_type on public.async_jobs using btree (job_type, status) TABLESPACE pg_default;

create index IF not exists idx_async_jobs_active on public.async_jobs using btree (id, status, updated_at) TABLESPACE pg_default
where
  (
    status = any (array['pending'::text, 'processing'::text])
  );

create trigger trg_async_jobs_terminal_state BEFORE
update on async_jobs for EACH row
execute FUNCTION prevent_terminal_job_updates ();

create trigger trg_async_jobs_version BEFORE
update on async_jobs for EACH row
execute FUNCTION increment_async_job_version ();

------------------------------------------------------------------------------
-- Meal planning domain
------------------------------------------------------------------------------

CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  scope text NOT NULL,
  generated_by text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_meal_plan_date_order CHECK (end_date >= start_date),
  CONSTRAINT chk_meal_plan_scope CHECK (scope = ANY (ARRAY['daily','weekly','monthly'])),
  CONSTRAINT chk_meal_plan_generated_by CHECK (generated_by = ANY (ARRAY['ai','template','manual']))
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_household
  ON public.meal_plans (household_id, start_date DESC);

CREATE TABLE public.meal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid NOT NULL REFERENCES public.meal_plans (id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_type text NOT NULL,
  recipe_id uuid REFERENCES public.recipes (id) ON DELETE SET NULL,
  external_item_name text,
  servings numeric NOT NULL DEFAULT 1,
  notes text,
  position integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_meal_plan_item_servings CHECK (servings > 0),
  CONSTRAINT chk_meal_plan_item_meal_type
    CHECK (meal_type = ANY (ARRAY['breakfast','lunch','dinner','snack','dessert']))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plan_item_slot
  ON public.meal_plan_items (meal_plan_id, date, meal_type);

CREATE TABLE public.meal_plan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid NOT NULL REFERENCES public.meal_plans (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_type text NOT NULL,
  completion_status text NOT NULL DEFAULT 'pending',
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_meal_plan_progress_status
    CHECK (completion_status = ANY (ARRAY['pending','completed','skipped']))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plan_progress_unique
  ON public.meal_plan_progress (meal_plan_id, user_id, date, meal_type);

CREATE TABLE public.meal_plan_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.async_jobs (id) ON DELETE SET NULL,
  plan_title text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  scope text NOT NULL DEFAULT 'weekly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  meals_per_day integer NOT NULL,
  slots text[] NOT NULL,
  freeform_prompt text,
  status text NOT NULL DEFAULT 'generating',
  progress_message text,
  error_message text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_totals jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_context jsonb,
  raw_ai_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT chk_meal_plan_draft_date_order CHECK (end_date >= start_date),
  CONSTRAINT chk_meal_plan_draft_scope CHECK (scope = ANY (ARRAY['daily','weekly','monthly'])),
  CONSTRAINT chk_meal_plan_draft_status CHECK (status = ANY (ARRAY['generating','completed','failed','expired','converted'])),
  CONSTRAINT chk_meals_per_day_range CHECK (meals_per_day BETWEEN 1 AND 6)
);

CREATE INDEX IF NOT EXISTS idx_meal_plan_drafts_user_status
  ON public.meal_plan_drafts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_meal_plan_drafts_household_created
  ON public.meal_plan_drafts (household_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meal_plan_drafts_expires
  ON public.meal_plan_drafts (expires_at)
  WHERE status <> 'converted';

------------------------------------------------------------------------------
-- Nutrition logging (depends on meal_plan_items)
------------------------------------------------------------------------------

CREATE TABLE public.nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  meal_plan_item_id uuid REFERENCES public.meal_plan_items (id) ON DELETE SET NULL,
  logged_for date NOT NULL DEFAULT CURRENT_DATE,
  calories_kcal integer,
  protein_g numeric(10,2),
  carbs_g numeric(10,2),
  fat_g numeric(10,2),
  fiber_g numeric(10,2),
  sugar_g numeric(10,2),
  sodium_mg integer,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date
  ON public.nutrition_logs (user_id, logged_for DESC);

------------------------------------------------------------------------------
-- Grocery and pantry domain
------------------------------------------------------------------------------

CREATE TABLE public.grocery_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  vendor text,
  created_by uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  ordered_at timestamptz,
  purchased_at timestamptz,
  meal_plan_ids uuid[] NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_grocery_list_status
    CHECK (status = ANY (ARRAY['draft','ordered','purchased','archived'])),
  CONSTRAINT chk_grocery_list_meal_plan_ids
    CHECK (
      meal_plan_ids IS NOT NULL
      AND cardinality(meal_plan_ids) >= 1
    )
);

CREATE INDEX IF NOT EXISTS idx_grocery_lists_household_status
  ON public.grocery_lists (household_id, status);

CREATE INDEX IF NOT EXISTS idx_grocery_lists_meal_plan_ids
  ON public.grocery_lists
  USING GIN (meal_plan_ids);

CREATE TABLE public.grocery_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_id uuid NOT NULL REFERENCES public.grocery_lists (id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients (id) ON DELETE RESTRICT,
  recipe_id uuid REFERENCES public.recipes (id) ON DELETE SET NULL,
  meal_plan_item_id uuid REFERENCES public.meal_plan_items (id) ON DELETE SET NULL,
  quantity numeric,
  unit text REFERENCES public.units (id) ON DELETE SET NULL,
  display_name text,
  notes text,
  priority text NOT NULL DEFAULT 'medium',
  is_purchased boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_grocery_item_priority
    CHECK (priority = ANY (ARRAY['low','medium','high']))
);

CREATE INDEX IF NOT EXISTS idx_grocery_list_items_list
  ON public.grocery_list_items (grocery_list_id);

CREATE TABLE public.ingredient_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients (id) ON DELETE RESTRICT,
  on_hand_qty_g numeric,
  on_hand_qty_ml numeric,
  unit text REFERENCES public.units (id) ON DELETE SET NULL,
  expiry_date date,
  last_audited_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_inventory_unique
  ON public.ingredient_inventory (household_id, ingredient_id);

CREATE TABLE public.shopping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_id uuid REFERENCES public.grocery_lists (id) ON DELETE SET NULL,
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  total_cost_cents integer,
  receipt_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

------------------------------------------------------------------------------
-- Conversational AI domain
------------------------------------------------------------------------------

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  CONSTRAINT chk_ai_conversation_status
    CHECK (status = ANY (ARRAY['active','archived']))
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner
  ON public.ai_conversations (owner_user_id, created_at DESC);

CREATE TABLE public.ai_conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT chk_ai_conversation_participant_role
    CHECK (role = ANY (ARRAY['viewer','editor']))
);

CREATE TABLE public.ai_conversation_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  context_type text NOT NULL,
  context_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_ai_message_role
    CHECK (role = ANY (ARRAY['system','assistant','user']))
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages (conversation_id, created_at);

CREATE TABLE public.ai_media_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.ai_messages (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  media_type text NOT NULL,
  media_url text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations (id) ON DELETE SET NULL,
  provider text NOT NULL,
  model text NOT NULL,
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  billed_amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_ledger_user_created
  ON public.ai_cost_ledger (user_id, created_at DESC);

------------------------------------------------------------------------------
-- Support indexes for frequent lookups
------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan_date
  ON public.meal_plan_items (meal_plan_id, date);

CREATE INDEX IF NOT EXISTS idx_grocery_list_items_ingredient
  ON public.grocery_list_items (ingredient_id)
  WHERE ingredient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingredient_inventory_expiry
  ON public.ingredient_inventory (expiry_date)
  WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_meal_plan_item
  ON public.nutrition_logs (meal_plan_item_id)
  WHERE meal_plan_item_id IS NOT NULL;

------------------------------------------------------------------------------
-- End of schema definition
------------------------------------------------------------------------------
