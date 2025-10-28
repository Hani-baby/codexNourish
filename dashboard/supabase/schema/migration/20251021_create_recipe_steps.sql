-- Creates the recipe_steps table so individual step inserts succeed.
-- Run with: supabase db push

set check_function_bodies = off;

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  step_number int not null check (step_number > 0),
  instruction text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipe_steps_recipe_id
  on public.recipe_steps (recipe_id);

create index if not exists idx_recipe_steps_recipe_step_number
  on public.recipe_steps (recipe_id, step_number);

comment on table public.recipe_steps is 'Stores individual instructions for each recipe.';
comment on column public.recipe_steps.step_number is '1-based ordering of steps for display.';
comment on column public.recipe_steps.instruction is 'The human-readable instruction text.';

