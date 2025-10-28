-- Allow free-form measurement units while retaining links to canonical units.

ALTER TABLE public.recipe_ingredients
  RENAME COLUMN unit TO unit_id;

ALTER TABLE public.recipe_ingredients
  ADD COLUMN unit_name text;

-- Backfill free-form unit names from the canonical table when an id exists.
UPDATE public.recipe_ingredients ri
SET unit_name = u.label
FROM public.units u
WHERE ri.unit_id = u.id
  AND ri.unit_name IS NULL;

-- Ensure any provided unit name is not blank (units remain optional).
ALTER TABLE public.recipe_ingredients
  ADD CONSTRAINT chk_recipe_ingredients_unit_name
  CHECK (
    unit_name IS NULL OR length(trim(unit_name)) > 0
  );
