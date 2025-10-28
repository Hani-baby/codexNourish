-- Allow AI generated recipes to store free-form ingredient names while keeping
-- links to canonical ingredients when available.

ALTER TABLE public.recipe_ingredients
  ADD COLUMN ingredient_name text,
  ADD COLUMN order_index integer NOT NULL DEFAULT 0,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.recipe_ingredients
  ALTER COLUMN ingredient_id DROP NOT NULL;

-- Backfill ingredient_name from the canonical ingredient table when possible.
UPDATE public.recipe_ingredients ri
SET ingredient_name = i.name
FROM public.ingredients i
WHERE ri.ingredient_id = i.id
  AND ri.ingredient_name IS NULL;

-- Ensure existing rows have some label; this should be rare but keeps the next
-- constraint addition from failing.
UPDATE public.recipe_ingredients
SET ingredient_name = 'Unknown ingredient'
WHERE ingredient_name IS NULL;

ALTER TABLE public.recipe_ingredients
  ALTER COLUMN ingredient_name SET NOT NULL;

ALTER TABLE public.recipe_ingredients
  ALTER COLUMN quantity DROP NOT NULL;

ALTER TABLE public.recipe_ingredients
  DROP CONSTRAINT IF EXISTS chk_recipe_ingredient_quantity;

ALTER TABLE public.recipe_ingredients
  ADD CONSTRAINT chk_recipe_ingredient_quantity
  CHECK (quantity IS NULL OR quantity > 0);

ALTER TABLE public.recipe_ingredients
  ADD CONSTRAINT chk_recipe_ingredients_identifier
  CHECK (
    ingredient_id IS NOT NULL
    OR (ingredient_name IS NOT NULL AND length(trim(ingredient_name)) > 0)
  );
