import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { Pool } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

import { createLogger } from "../_shared/logger.ts";
import {
  createErrorResponse,
  createJsonResponse,
  handleCors,
} from "../_shared/cors.ts";
import {
  fetchHouseholdPreferences,
  HouseholdPreferenceAggregate,
} from "../_shared/preferences.ts";
import { SessionPreferences, ValidationError } from "../_shared/types.ts";
import { RECIPE_GENERATION_SCHEMA } from "./schema.ts";

const logger = createLogger("Recipes AI", "[rx]");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
const openAiModel = Deno.env.get("OPENAI_RECIPE_MODEL") ?? "gpt-4.1-mini";
const databaseUrl =
  Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL") ?? null;

if (!supabaseUrl || !serviceRoleKey) {
  logger.error("Missing Supabase admin credentials", {}, "[er]");
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured"
  );
}

if (!openAiApiKey) {
  logger.error("OPENAI_API_KEY is not configured", {}, "[er]");
  throw new Error("OPENAI_API_KEY must be set for recipes-ai");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const pool = databaseUrl ? new Pool(databaseUrl, 3, true) : null;

// Cache for Chef Nourish's UUID
let chefNourishUserIdCache: string | null = null;

// Get Chef Nourish's user ID from Supabase secret
const getChefNourishUserId = async (): Promise<string> => {
  if (chefNourishUserIdCache) {
    return chefNourishUserIdCache;
  }

  // Read from Supabase secret
  const chefNourishId = Deno.env.get("CHEFNOURISH");
  
  if (!chefNourishId || chefNourishId.trim().length === 0) {
    logger.error('CHEFNOURISH secret is not configured');
    throw new Error('CHEFNOURISH secret must be set in Supabase project settings');
  }

  const userId = chefNourishId.trim();
  chefNourishUserIdCache = userId;
  logger.info('Chef Nourish UUID loaded from secret', { user_id: userId });
  return userId;
};

const recipeSchemaFormat = (() => {
  const type =
    typeof RECIPE_GENERATION_SCHEMA.type === "string" &&
    RECIPE_GENERATION_SCHEMA.type.trim()
      ? RECIPE_GENERATION_SCHEMA.type.trim()
      : "json_schema";
  const jsonSchema = RECIPE_GENERATION_SCHEMA.json_schema ?? {};
  const schema = jsonSchema.schema;
  if (!schema || typeof schema !== "object") {
    throw new Error(
      "recipes-ai schema definition is missing json_schema.schema"
    );
  }
  const name =
    typeof jsonSchema.name === "string" && jsonSchema.name.trim().length > 0
      ? jsonSchema.name.trim()
      : "recipe_payload";
  const strict =
    typeof jsonSchema.strict === "boolean" ? jsonSchema.strict : true;

  return Object.freeze({
    type,
    name,
    schema,
    strict,
  });
})();

const STRIP_KEYS = new Set([
  "uniqueItems", "$schema", "$id", "$defs", "definitions",
  "allOf", "anyOf", "oneOf", "not", "if", "then", "else",
  "dependentRequired", "patternProperties", "examples", "default"
]);

function sanitizeSchema(node: any): any {
  if (node && typeof node === "object") {
    if (Array.isArray(node)) return node.map(sanitizeSchema);
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (STRIP_KEYS.has(k)) continue;
      out[k] = sanitizeSchema(v);
    }
    return out;
  }
  return node;
}

interface RecipeAiRequestBody {
  title: string;
  description?: string;
  meal_type?: string;
  servings: number;
  dietary_tags?: string[];
  cuisine?: string | null;
  household_preferences?: HouseholdPreferenceAggregate;
  session_preferences?: SessionPreferences;
  user_id: string;
  household_id: string;
}

interface AiIngredient {
  ingredient_name: string;
  quantity?: number | null;
  unit_name?: string | null;
  preparation?: string | null;
  notes?: string | null;
  order_index: number;
  metadata?: Record<string, unknown> | null;
  normalized_qty_g?: number | null;
  normalized_qty_ml?: number | null;
}

interface AiStep {
  step_number?: number | null;
  instruction?: string | null;
  label?: string | null;
}

interface AiNutritionBlock {
  calories_kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  meta?: Record<string, unknown> | null;
}

interface AiRecipePayload {
  recipe: {
    title?: string | null;
    slug?: string | null;
    summary?: string | null;
    instructions?: string | null;
    image_url?: string | null;
    source_url?: string | null;
    prep_min?: number | null;
    cook_min?: number | null;
    servings?: number | null;
    dietary_tags?: string[] | null;
    cuisine?: string | null;
    is_public?: boolean | null;
    tags?: string[] | null;
    ingredients?: AiIngredient[] | null;
    steps?: AiStep[] | null;
    nutrition?: AiNutritionBlock | null;
    nutrition_per_serving?: AiNutritionBlock | null;
    serving_notes?: string[] | null;
    allergens?: string[] | null;
    meta?: Record<string, unknown> | null;
  };
}

interface PersistableRecipe {
  base: {
    created_by: string;
    inspired: string | null;
    title: string;
    slug: string;
    summary: string | null;
    instructions: string | null;
    image_url: string | null;
    source_url: string | null;
    prep_min: number | null;
    cook_min: number | null;
    servings: number;
    dietary_tags: string[];
    cuisine: string | null;
    is_public: boolean;
  };
  tags: string[];
  ingredients: Array<{
    ingredient_id: string | null;
    ingredient_name: string;
    quantity: number | null;
    unit_id: string | null;
    unit_name: string | null;
    preparation: string | null;
    notes: string | null;
    order_index: number;
    metadata: Record<string, unknown>;
  }>;
  steps: Array<{
    step_number: number;
    instruction: string;
  }>;
  nutrition: {
    calories_kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
    meta: Record<string, unknown>;
  } | null;
}

interface RecipeGenerationContext {
  request: NormalizedRecipeRequest;
  ai: AiRecipePayload["recipe"];
}

interface NormalizedRecipeRequest {
  title: string;
  description: string;
  meal_type: string;
  servings: number;
  dietary_tags: string[];
  cuisine: string | null;
  user_id: string | null;
  household_id: string;
  household_preferences: HouseholdPreferenceAggregate;
  session_preferences: SessionPreferences;
  draft_id?: string | null;
  draft_item_index?: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const ensureString = (
  source: Record<string, unknown>,
  key: string,
  options: { required?: boolean; fallback?: string } = {}
): string => {
  const { required = true, fallback } = options;
  const raw = source[key];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  if (required) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new ValidationError(`${key} is required`);
  }
  return fallback ?? "";
};

const ensurePositiveNumber = (
  source: Record<string, unknown>,
  key: string,
  options: { required?: boolean; defaultValue?: number } = {}
): number => {
  const { required = true, defaultValue } = options;
  const raw = source[key];
  if (typeof raw === "number" && !Number.isNaN(raw) && raw > 0) {
    return raw;
  }
  if (required && defaultValue === undefined) {
    throw new ValidationError(`${key} must be a positive number`);
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  return 0;
};

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      seen.add(entry.trim());
    }
  }
  return Array.from(seen);
};

const normalizeLowercaseArray = (values: string[]): string[] => {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      seen.add(normalized);
    }
  }
  return Array.from(seen);
};

const slugify = (value: string): string => {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return base.length > 0 ? base : "recipe";
};

const mergeMeta = (
  base: Record<string, unknown>,
  patch: Record<string, unknown> | null | undefined
): Record<string, unknown> => {
  return {
    ...base,
    ...(patch ?? {}),
  };
};

const isHouseholdPreferenceAggregate = (
  value: unknown
): value is HouseholdPreferenceAggregate => {
  if (!isRecord(value)) return false;
  if (!isRecord(value.combined)) return false;
  return Array.isArray(value.members);
};

const parseRequest = async (
  body: unknown
): Promise<NormalizedRecipeRequest> => {
  if (!isRecord(body)) {
    throw new ValidationError("Request payload must be a JSON object");
  }

  const title = ensureString(body, "title");
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const mealType =
    ensureString(body, "meal_type", { fallback: "unspecified" }) ||
    "unspecified";
  const servings = ensurePositiveNumber(body, "servings");
  const dietaryTags = normalizeLowercaseArray(
    ensureStringArray(body.dietary_tags)
  );
  const cuisineRaw =
    typeof body.cuisine === "string" && body.cuisine.trim().length > 0
      ? body.cuisine.trim()
      : null;
  const userIdRaw = ensureString(body, "user_id");
  
  // Log what we received
  logger.info("Received recipe generation request", {
    title,
    meal_type: mealType,
    user_id_received: userIdRaw,
    household_id: body.household_id,
  });
  
  // Treat "0" or invalid UUID as null for the inspired field
  if (userIdRaw === "0" || userIdRaw.trim().length === 0) {
    logger.warn("Received invalid user_id, treating as null", {
      received_value: userIdRaw,
      household_id: body.household_id,
    });
  }
  const userId = userIdRaw === "0" || userIdRaw.trim().length === 0 ? null : userIdRaw;
  const householdId = ensureString(body, "household_id");
  const draftId =
    typeof body.draft_id === "string" && body.draft_id.trim().length > 0
      ? body.draft_id.trim()
      : null;
  let draftItemIndex: number | null = null;
  const rawDraftIndex = (body as Record<string, unknown>).draft_item_index;
  if (
    typeof rawDraftIndex === "number" &&
    Number.isInteger(rawDraftIndex) &&
    rawDraftIndex >= 0
  ) {
    draftItemIndex = rawDraftIndex;
  } else if (
    typeof rawDraftIndex === "string" &&
    rawDraftIndex.trim().length > 0
  ) {
    const parsed = Number.parseInt(rawDraftIndex.trim(), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      draftItemIndex = parsed;
    }
  }

  let sessionPreferences: SessionPreferences = {};
  if (isRecord(body.session_preferences)) {
    sessionPreferences = body.session_preferences as SessionPreferences;
  }

  let householdPreferences: HouseholdPreferenceAggregate | null = null;
  if (isHouseholdPreferenceAggregate(body.household_preferences)) {
    householdPreferences = body.household_preferences;
  }

  if (!householdPreferences) {
    householdPreferences = await fetchHouseholdPreferences(
      supabaseAdmin,
      householdId
    );
  }

  return {
    title,
    description,
    meal_type: mealType,
    servings,
    dietary_tags: dietaryTags,
    cuisine: cuisineRaw,
    user_id: userId,
    household_id: householdId,
    household_preferences: householdPreferences,
    session_preferences: sessionPreferences,
    draft_id: draftId,
    draft_item_index: draftItemIndex,
  };
};

const callbackAssigner = async (
  recipeId: string,
  draftId: string,
  draftItemIndex: number | null,
): Promise<void> => {
  if (!draftId) {
    return
  }

  try {
    logger.info('Calling back to recipe-assigner', {
      recipe_id: recipeId,
      draft_id: draftId,
      draft_item_index: draftItemIndex,
    })

    const response = await fetch(`${supabaseUrl}/functions/v1/recipe-assigner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        draft_id: draftId,
        callback_recipe_id: recipeId,
        is_callback: true,
        draft_item_index: draftItemIndex,
      }),
    })

    if (!response.ok) {
      logger.warn('Callback to recipe-assigner failed', {
        status: response.status,
        draft_id: draftId,
      })
    } else {
      logger.info('Successfully called back to recipe-assigner', {
        draft_id: draftId,
      })
    }
  } catch (error) {
    logger.warn('Failed to callback recipe-assigner', {
      error: error instanceof Error ? error.message : String(error),
      draft_id: draftId,
    })
  }
}
const ensureUniqueSlug = async (baseSlug: string): Promise<string> => {
  const sanitized = slugify(baseSlug);
  let candidate = sanitized;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from("recipes")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw error;
    }
    if (!data) {
      return candidate;
    }
    candidate = slugify(`${sanitized}-${attempt + 2}`);
  }
  return `${sanitized}-${crypto.randomUUID().slice(0, 8)}`;
};

const joinLines = (parts: Array<string | null | undefined>) =>
  parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n");

const buildHouseholdSummary = (aggregate: HouseholdPreferenceAggregate) => {
  const combined = aggregate.combined;
  return {
    cuisines: combined.cuisines,
    dislikes: combined.dislikes,
    dietary_patterns: combined.dietary_patterns,
    excluded_ingredients: combined.excluded_ingredients,
    allergies: combined.allergies,
    convenience_level: combined.convenience_level ?? null,
    cooking_time: combined.cooking_time ?? null,
    leftovers_policy: combined.leftovers_policy ?? null,
    member_count: aggregate.members.length,
  };
};

const buildPromptPayload = (request: NormalizedRecipeRequest) => {
  return {
    title: request.title,
    description: request.description,
    meal_type: request.meal_type,
    servings: request.servings,
    dietary_tags: request.dietary_tags,
    cuisine: request.cuisine,
    household_preferences: buildHouseholdSummary(request.household_preferences),
    session_preferences: request.session_preferences,
  };
};

const callRecipeModel = async (
  request: NormalizedRecipeRequest
): Promise<{
  recipe: AiRecipePayload["recipe"];
  raw: Record<string, unknown>;
}> => {
  const systemPrompt = joinLines([
    "You are Chef Nourish, an expert recipe developer and registered dietitian.",
    "Design recipes that respect household dietary restrictions, avoid allergens, and stay family-friendly.",
    "Always use precise measurements, sequential steps, and ingredient metadata suitable for grocery planning.",
    "Return ONLY JSON matching the provided schema. Do not include markdown or commentary.",
  ]);

  const userPayload = buildPromptPayload(request);
  const schemaName = recipeSchemaFormat.name; // 'recipe_payload'
  const schemaObject = recipeSchemaFormat.schema; // your JSON Schema
  const schemaStrict = recipeSchemaFormat.strict; // true
  const wireSchema   = sanitizeSchema(schemaObject);

  logger.info("Calling OpenAI for recipe generation", {
    title: request.title,
    meal_type: request.meal_type,
    household_id: request.household_id,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: openAiModel,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Generate a complete recipe for this meal request. " +
                  "Ensure every ingredient is compatible with the preferences and allergens listed. " +
                  "Respond strictly with JSON that conforms to the attached schema.\n\n" +
                  JSON.stringify(userPayload, null, 2),
              },
            ],
          },
        ],
        text: {
          format: {
            // ---- Flat fields (some deployments expect these) ----
            type: "json_schema",
            name: schemaName,
            schema: wireSchema,
            strict: schemaStrict,

            // ---- Nested block (others expect this) ----
            json_schema: {
              name: schemaName,
              schema: wireSchema,
              strict: schemaStrict,
            },
          },
        },
        max_output_tokens: 1600,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI API call timed out after 30 seconds');
    }
    throw error;
  }

  const responseBody = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof responseBody.error === "object" &&
      responseBody.error &&
      "message" in responseBody.error
        ? String((responseBody.error as Record<string, unknown>).message)
        : `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  let payload: AiRecipePayload | null = null;

  if (isRecord(responseBody.output_parsed)) {
    payload = responseBody.output_parsed as unknown as AiRecipePayload;
  } else if (typeof responseBody.output_text === "string") {
    try {
      payload = JSON.parse(responseBody.output_text) as AiRecipePayload;
    } catch {
      // ignore parse errors and continue scanning content blocks
    }
  }

  if (!payload) {
    const output = Array.isArray(responseBody.output)
      ? responseBody.output
      : [];
    for (const block of output) {
      if (isRecord(block) && Array.isArray(block.content)) {
        for (const part of block.content) {
          if (
            isRecord(part) &&
            part.type === "output_text" &&
            typeof part.text === "string"
          ) {
            try {
              payload = JSON.parse(part.text) as AiRecipePayload;
              break;
            } catch {
              /* continue scanning other parts */
            }
          }
        }
      }
      if (payload) break;
    }
  }

  if (!payload || !payload.recipe) {
    throw new Error("OpenAI response did not include structured recipe data");
  }

  return {
    recipe: payload.recipe,
    raw: responseBody,
  };
};

const normalizeInstruction = (
  step: AiStep,
  index: number
): { step_number: number; instruction: string } | null => {
  const instructionText =
    typeof step.instruction === "string" && step.instruction.trim().length > 0
      ? step.instruction.trim()
      : "";
  if (!instructionText) {
    return null;
  }
  const label =
    typeof step.label === "string" && step.label.trim().length > 0
      ? step.label.trim()
      : null;
  const prefix = label ? `${label}: ` : "";
  const stepNumber =
    typeof step.step_number === "number" && step.step_number > 0
      ? step.step_number
      : index + 1;
  return {
    step_number: stepNumber,
    instruction: `${prefix}${instructionText}`,
  };
};

const normalizeIngredient = (
  ingredient: AiIngredient,
  index: number
): PersistableRecipe["ingredients"][number] | null => {
  const name = ingredient.ingredient_name?.trim();
  if (!name || name.length === 0) {
    return null;
  }

  const metadata: Record<string, unknown> = mergeMeta(
    {},
    ingredient.metadata ?? undefined
  );

  if (typeof ingredient.normalized_qty_g === "number") {
    metadata.normalized_qty_g = ingredient.normalized_qty_g;
  }
  if (typeof ingredient.normalized_qty_ml === "number") {
    metadata.normalized_qty_ml = ingredient.normalized_qty_ml;
  }

  return {
    // We don't use IDs from OpenAI - database will handle linking later if needed
    ingredient_id: null,
    ingredient_name: name,
    quantity:
      typeof ingredient.quantity === "number" && ingredient.quantity > 0
        ? ingredient.quantity
        : null,
    // We don't use unit IDs from OpenAI - we only use unit_name
    unit_id: null,
    unit_name:
      typeof ingredient.unit_name === "string" && ingredient.unit_name.trim()
        ? ingredient.unit_name.trim()
        : null,
    preparation:
      typeof ingredient.preparation === "string" &&
      ingredient.preparation.trim()
        ? ingredient.preparation.trim()
        : null,
    notes:
      typeof ingredient.notes === "string" && ingredient.notes.trim()
        ? ingredient.notes.trim()
        : null,
    order_index: ingredient.order_index ?? index,
    metadata,
  };
};

const buildPersistableRecipe = async (
  request: NormalizedRecipeRequest,
  aiRecipe: AiRecipePayload["recipe"]
): Promise<PersistableRecipe> => {
  // Get Chef Nourish's UUID dynamically
  const chefNourishId = await getChefNourishUserId();
  const title =
    typeof aiRecipe.title === "string" && aiRecipe.title.trim()
      ? aiRecipe.title.trim()
      : request.title;
  const slugInput =
    typeof aiRecipe.slug === "string" && aiRecipe.slug.trim().length >= 3
      ? aiRecipe.slug.trim()
      : title;
  const uniqueSlug = await ensureUniqueSlug(slugInput);

  const dietaryTags = normalizeLowercaseArray([
    ...request.dietary_tags,
    ...(Array.isArray(aiRecipe.dietary_tags) ? aiRecipe.dietary_tags : []),
  ]);

  const allergens = normalizeLowercaseArray(
    Array.isArray(aiRecipe.allergens) ? aiRecipe.allergens : []
  );
  const mergedDietaryTags = normalizeLowercaseArray([
    ...dietaryTags,
    ...allergens.map((value) => `contains:${value}`),
  ]);

  const tags = normalizeLowercaseArray([
    "ai-generated",
    request.meal_type,
    ...(Array.isArray(aiRecipe.tags) ? aiRecipe.tags : []),
  ]);

  const ingredientsRaw = Array.isArray(aiRecipe.ingredients)
    ? aiRecipe.ingredients
    : [];
  const normalizedIngredients = ingredientsRaw
    .map((entry, index) => normalizeIngredient(entry, index))
    .filter((entry): entry is PersistableRecipe["ingredients"][number] =>
      Boolean(entry)
    )
    .sort((a, b) => a.order_index - b.order_index)
    .map((entry, index) => ({ ...entry, order_index: index }));

  if (normalizedIngredients.length === 0) {
    throw new Error("AI response did not include any valid ingredients");
  }

  const stepsRaw = Array.isArray(aiRecipe.steps) ? aiRecipe.steps : [];
  const normalizedSteps = stepsRaw
    .map((step, index) => normalizeInstruction(step, index))
    .filter((entry): entry is { step_number: number; instruction: string } =>
      Boolean(entry)
    )
    .sort((a, b) => a.step_number - b.step_number)
    .map((entry, index) => ({
      step_number: index + 1,
      instruction: entry.instruction,
    }));

  if (normalizedSteps.length === 0) {
    throw new Error("AI response did not include any valid instructions");
  }

  const nutritionBlock = aiRecipe.nutrition ?? null;
  const perServingBlock = aiRecipe.nutrition_per_serving ?? null;
  const nutritionMeta: Record<string, unknown> = {
    generated_by: "recipes-ai",
    model: openAiModel,
    requested_meal_type: request.meal_type,
  };

  if (perServingBlock) {
    nutritionMeta.per_serving = perServingBlock;
  }
  if (
    Array.isArray(aiRecipe.serving_notes) &&
    aiRecipe.serving_notes.length > 0
  ) {
    nutritionMeta.serving_notes = aiRecipe.serving_notes;
  }
  if (aiRecipe.meta) {
    nutritionMeta.ai_meta = aiRecipe.meta;
  }

  const nutrition = nutritionBlock
    ? {
        calories_kcal:
          typeof nutritionBlock.calories_kcal === "number" &&
          nutritionBlock.calories_kcal >= 0
            ? Math.round(nutritionBlock.calories_kcal)
            : null,
        protein_g:
          typeof nutritionBlock.protein_g === "number" &&
          nutritionBlock.protein_g >= 0
            ? Number(nutritionBlock.protein_g)
            : null,
        carbs_g:
          typeof nutritionBlock.carbs_g === "number" &&
          nutritionBlock.carbs_g >= 0
            ? Number(nutritionBlock.carbs_g)
            : null,
        fat_g:
          typeof nutritionBlock.fat_g === "number" && nutritionBlock.fat_g >= 0
            ? Number(nutritionBlock.fat_g)
            : null,
        fiber_g:
          typeof nutritionBlock.fiber_g === "number" &&
          nutritionBlock.fiber_g >= 0
            ? Number(nutritionBlock.fiber_g)
            : null,
        sugar_g:
          typeof nutritionBlock.sugar_g === "number" &&
          nutritionBlock.sugar_g >= 0
            ? Number(nutritionBlock.sugar_g)
            : null,
        sodium_mg:
          typeof nutritionBlock.sodium_mg === "number" &&
          nutritionBlock.sodium_mg >= 0
            ? Math.round(nutritionBlock.sodium_mg)
            : null,
        meta: mergeMeta(nutritionMeta, nutritionBlock.meta),
      }
    : {
        calories_kcal: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        sugar_g: null,
        sodium_mg: null,
        meta: nutritionMeta,
      };

  return {
    base: {
      created_by: chefNourishId,
      inspired: request.user_id || null,
      title,
      slug: uniqueSlug,
      summary:
        typeof aiRecipe.summary === "string" && aiRecipe.summary.trim()
          ? aiRecipe.summary.trim()
          : request.description || null,
      instructions:
        typeof aiRecipe.instructions === "string" &&
        aiRecipe.instructions.trim()
          ? aiRecipe.instructions.trim()
          : null,
      image_url:
        typeof aiRecipe.image_url === "string" && aiRecipe.image_url.trim()
          ? aiRecipe.image_url.trim()
          : null,
      source_url:
        typeof aiRecipe.source_url === "string" && aiRecipe.source_url.trim()
          ? aiRecipe.source_url.trim()
          : null,
      prep_min:
        typeof aiRecipe.prep_min === "number" && aiRecipe.prep_min >= 0
          ? Math.round(aiRecipe.prep_min)
          : null,
      cook_min:
        typeof aiRecipe.cook_min === "number" && aiRecipe.cook_min >= 0
          ? Math.round(aiRecipe.cook_min)
          : null,
      servings:
        typeof aiRecipe.servings === "number" && aiRecipe.servings > 0
          ? aiRecipe.servings
          : request.servings,
      dietary_tags: mergedDietaryTags,
      cuisine:
        typeof aiRecipe.cuisine === "string" && aiRecipe.cuisine.trim()
          ? aiRecipe.cuisine.trim()
          : request.cuisine,
      is_public: true,
    },
    tags,
    ingredients: normalizedIngredients,
    steps: normalizedSteps,
    nutrition,
  };
};

const persistRecipe = async (
  payload: PersistableRecipe
): Promise<{ recipeId: string }> => {
  // Use Supabase client instead of raw SQL to properly handle null values
  // The Postgres deno driver (v0.17.2) converts null to "0" string in UUID columns
  // This causes "invalid input syntax for type uuid: \"0\"" errors
  logger.info("Using Supabase client for recipe persistence (handles nulls correctly)");

  const recipeInsert = await supabaseAdmin
    .from("recipes")
    .insert({
      created_by: payload.base.created_by,
      inspired: payload.base.inspired,
      title: payload.base.title,
      slug: payload.base.slug,
      summary: payload.base.summary,
      instructions: payload.base.instructions,
      image_url: payload.base.image_url,
      source_url: payload.base.source_url,
      prep_min: payload.base.prep_min,
      cook_min: payload.base.cook_min,
      servings: payload.base.servings,
      dietary_tags: payload.base.dietary_tags,
      cuisine: payload.base.cuisine,
      is_public: payload.base.is_public,
    })
    .select("id")
    .single();

  if (recipeInsert.error || !recipeInsert.data) {
    throw recipeInsert.error ?? new Error("Failed to create recipe");
  }

  const recipeId = recipeInsert.data.id as string;

  const abortOnFailure = async (error: unknown) => {
    await supabaseAdmin.from("recipes").delete().eq("id", recipeId);
    throw error;
  };

  if (payload.tags.length > 0) {
    const tagInsert = await supabaseAdmin
      .from("recipe_tags")
      .insert(payload.tags.map((tag) => ({ recipe_id: recipeId, tag })));
    if (tagInsert.error) {
      await abortOnFailure(tagInsert.error);
    }
  }

  const ingredientInsert = await supabaseAdmin
    .from("recipe_ingredients")
    .insert(
      payload.ingredients.map((ingredient) => ({
        recipe_id: recipeId,
        ingredient_id: ingredient.ingredient_id,
        ingredient_name: ingredient.ingredient_name,
        quantity: ingredient.quantity,
        unit_id: ingredient.unit_id,
        unit_name: ingredient.unit_name,
        preparation: ingredient.preparation,
        notes: ingredient.notes,
        order_index: ingredient.order_index,
        metadata: ingredient.metadata,
      }))
    );
  if (ingredientInsert.error) {
    await abortOnFailure(ingredientInsert.error);
  }

  const stepsInsert = await supabaseAdmin.from("recipe_steps").insert(
    payload.steps.map((step) => ({
      recipe_id: recipeId,
      step_number: step.step_number,
      instruction: step.instruction,
    }))
  );
  if (stepsInsert.error) {
    await abortOnFailure(stepsInsert.error);
  }

  if (payload.nutrition) {
    const nutritionInsert = await supabaseAdmin
      .from("recipe_nutrition")
      .upsert({
        recipe_id: recipeId,
        calories_kcal: payload.nutrition.calories_kcal,
        protein_g: payload.nutrition.protein_g,
        carbs_g: payload.nutrition.carbs_g,
        fat_g: payload.nutrition.fat_g,
        fiber_g: payload.nutrition.fiber_g,
        sugar_g: payload.nutrition.sugar_g,
        sodium_mg: payload.nutrition.sodium_mg,
        meta: payload.nutrition.meta,
      });
    if (nutritionInsert.error) {
      await abortOnFailure(nutritionInsert.error);
    }
  }

  return { recipeId };
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Invalid JSON body",
      400
    );
  }

  try {
    const normalizedRequest = await parseRequest(payload);
    const { recipe: aiRecipe } = await callRecipeModel(normalizedRequest);
    const persistable = await buildPersistableRecipe(
      normalizedRequest,
      aiRecipe
    );
    const { recipeId } = await persistRecipe(persistable);

    logger.info("Recipe persisted", {
      recipe_id: recipeId,
      slug: persistable.base.slug,
      created_by: persistable.base.created_by,
    });


    if (normalizedRequest.draft_id) {
      callbackAssigner(
        recipeId,
        normalizedRequest.draft_id,
        normalizedRequest.draft_item_index ?? null,
      ).catch((callbackError) => {
        logger.warn('Callback failed but recipe was created', {
          recipe_id: recipeId,
          error:
            callbackError instanceof Error
              ? callbackError.message
              : String(callbackError),
        });
      });
    }

    return createJsonResponse(
      {
        success: true,
        recipe_id: recipeId,
        slug: persistable.base.slug,
        title: persistable.base.title,
      },
      200
    );
  } catch (error) {
    const message =
      error instanceof ValidationError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Unexpected error";
    const status = error instanceof ValidationError ? error.status : 500;
    logger.error("Recipe generation failed", {
      message,
      error: error instanceof Error ? error.stack : error,
    });
    return createErrorResponse(message, status);
  }
});






