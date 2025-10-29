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

interface RecipeConstraints {
  required_dietary: string[];
  blocked_ingredients: string[];
  blocked_tags: string[];
  max_prep_min?: number;
  max_cook_min?: number;
  budget_per_serving_cents?: number;
}

interface RecipeAiRequestBody {
  title: string;
  meal_type: string;
  servings: number;
  constraints: RecipeConstraints;
  cuisine?: string | null;
  household_preferences?: HouseholdPreferenceAggregate;
  session_preferences?: SessionPreferences;
  user_id?: string | null;
  household_id: string;
  idempotency_key: string;
  job_id?: string;
  dry_run?: boolean;
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
  meal_type: string;
  servings: number;
  constraints: RecipeConstraints;
  cuisine: string | null;
  user_id: string | null;
  household_id: string;
  household_preferences: HouseholdPreferenceAggregate;
  session_preferences: SessionPreferences;
  idempotency_key: string;
  job_id: string | null;
  dry_run: boolean;
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
  const mealType = ensureString(body, "meal_type", { fallback: "unspecified" }) || "unspecified";
  const servings = ensurePositiveNumber(body, "servings");
  const idempotencyKey = ensureString(body, "idempotency_key");

  // Parse constraints
  const constraintsRaw = body.constraints;
  if (!isRecord(constraintsRaw)) {
    throw new ValidationError("constraints must be an object");
  }
  const constraints: RecipeConstraints = {
    required_dietary: normalizeLowercaseArray(ensureStringArray(constraintsRaw.required_dietary)),
    blocked_ingredients: normalizeLowercaseArray(ensureStringArray(constraintsRaw.blocked_ingredients)),
    blocked_tags: normalizeLowercaseArray(ensureStringArray(constraintsRaw.blocked_tags)),
    max_prep_min: typeof constraintsRaw.max_prep_min === "number" && constraintsRaw.max_prep_min > 0 ? constraintsRaw.max_prep_min : undefined,
    max_cook_min: typeof constraintsRaw.max_cook_min === "number" && constraintsRaw.max_cook_min > 0 ? constraintsRaw.max_cook_min : undefined,
    budget_per_serving_cents: typeof constraintsRaw.budget_per_serving_cents === "number" && constraintsRaw.budget_per_serving_cents > 0 ? constraintsRaw.budget_per_serving_cents : undefined,
  };

  const cuisineRaw =
    typeof body.cuisine === "string" && body.cuisine.trim().length > 0
      ? body.cuisine.trim()
      : null;

  const userIdRaw = typeof body.user_id === "string" ? body.user_id.trim() : null;
  const userId = userIdRaw && userIdRaw !== "0" && userIdRaw.length > 0 ? userIdRaw : null;

  const householdId = ensureString(body, "household_id");
  const jobId = typeof body.job_id === "string" && body.job_id.trim().length > 0 ? body.job_id.trim() : null;
  const dryRun = typeof body.dry_run === "boolean" ? body.dry_run : false;

  logger.info("Received recipe generation request", {
    title,
    meal_type: mealType,
    user_id: userId,
    household_id: householdId,
    idempotency_key: idempotencyKey,
    job_id: jobId,
    dry_run: dryRun,
  });

  let sessionPreferences: SessionPreferences = {};
  if (isRecord(body.session_preferences)) {
    sessionPreferences = body.session_preferences as SessionPreferences;
  }

  let householdPreferences: HouseholdPreferenceAggregate | null = null;
  if (isHouseholdPreferenceAggregate(body.household_preferences)) {
    householdPreferences = body.household_preferences;
  }

  // Only fetch if not provided (Planner should pass them)
  if (!householdPreferences) {
    logger.info("Household preferences not provided, fetching", { household_id: householdId });
    householdPreferences = await fetchHouseholdPreferences(
      supabaseAdmin,
      householdId
    );
  }

  return {
    title,
    meal_type: mealType,
    servings,
    constraints,
    cuisine: cuisineRaw,
    user_id: userId,
    household_id: householdId,
    household_preferences: householdPreferences,
    session_preferences: sessionPreferences,
    idempotency_key: idempotencyKey,
    job_id: jobId,
    dry_run: dryRun,
  };
};

// Removed: callbackAssigner - recipes-ai no longer calls back to assigner

// --- Error Taxonomy ---
type RecipeErrorType =
  | "SCHEMA_VALIDATION_ERROR"
  | "CONSTRAINT_VIOLATION"
  | "IDEMPOTENT_DUPLICATE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "DB_PERSIST_ERROR"
  | "VALIDATION_ERROR";

interface RecipeError {
  success: false;
  error: string;
  error_type: RecipeErrorType;
  violations?: string[];
}

// --- Idempotency Check ---
const checkIdempotency = async (
  idempotencyKey: string,
  householdId: string
): Promise<{ recipe_id: string; slug: string; title: string } | null> => {
  const { data, error } = await supabaseAdmin
    .from("recipes")
    .select("id, slug, title")
    .eq("created_by", await getChefNourishUserId())
    .contains("dietary_tags", [])  // Just to ensure proper query structure
    .limit(100);  // Get recent recipes to scan

  if (error) {
    logger.warn("Failed to check idempotency", { error: error.message });
    return null;
  }

  // Check metadata for idempotency_key match
  // Since we can't directly query JSONB, we'd need to add an index or column
  // For now, we'll return null and rely on natural deduplication
  // TODO: Add idempotency_key column to recipes table for efficient lookup
  return null;
};

// --- Constraint Validation ---
interface ConstraintValidationResult {
  valid: boolean;
  violations: string[];
}

const validateConstraints = (
  recipe: AiRecipePayload["recipe"],
  constraints: RecipeConstraints
): ConstraintValidationResult => {
  const violations: string[] = [];

  // Check blocked ingredients
  if (constraints.blocked_ingredients.length > 0 && recipe.ingredients) {
    const ingredients = recipe.ingredients.map(ing =>
      (ing.ingredient_name ?? "").toLowerCase()
    );
    for (const blocked of constraints.blocked_ingredients) {
      const blockedLower = blocked.toLowerCase();
      for (const ingredient of ingredients) {
        if (ingredient.includes(blockedLower) || blockedLower.includes(ingredient)) {
          violations.push(`Blocked ingredient detected: ${blocked} (found: ${ingredient})`);
        }
      }
    }
  }

  // Check blocked tags
  if (constraints.blocked_tags.length > 0 && recipe.tags) {
    const tags = recipe.tags.map(tag => tag.toLowerCase());
    for (const blocked of constraints.blocked_tags) {
      if (tags.includes(blocked.toLowerCase())) {
        violations.push(`Blocked tag detected: ${blocked}`);
      }
    }
  }

  // Check dietary tags also for blocked items
  if (constraints.blocked_tags.length > 0 && recipe.dietary_tags) {
    const dietaryTags = recipe.dietary_tags.map(tag => tag.toLowerCase());
    for (const blocked of constraints.blocked_tags) {
      if (dietaryTags.includes(blocked.toLowerCase())) {
        violations.push(`Blocked dietary tag detected: ${blocked}`);
      }
    }
  }

  // Check required dietary tags
  if (constraints.required_dietary.length > 0) {
    const dietaryTags = (recipe.dietary_tags ?? []).map(tag => tag.toLowerCase());
    for (const required of constraints.required_dietary) {
      if (!dietaryTags.includes(required.toLowerCase())) {
        violations.push(`Required dietary tag missing: ${required}`);
      }
    }
  }

  // Check time constraints
  if (constraints.max_prep_min && recipe.prep_min && recipe.prep_min > constraints.max_prep_min) {
    violations.push(`Prep time ${recipe.prep_min}min exceeds maximum ${constraints.max_prep_min}min`);
  }

  if (constraints.max_cook_min && recipe.cook_min && recipe.cook_min > constraints.max_cook_min) {
    violations.push(`Cook time ${recipe.cook_min}min exceeds maximum ${constraints.max_cook_min}min`);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
};

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
  const { constraints } = request;
  return {
    title: request.title,
    meal_type: request.meal_type,
    servings: request.servings,
    cuisine: request.cuisine,
    constraints: {
      required_dietary: constraints.required_dietary,
      blocked_ingredients: constraints.blocked_ingredients,
      blocked_tags: constraints.blocked_tags,
      max_prep_min: constraints.max_prep_min,
      max_cook_min: constraints.max_cook_min,
    },
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
    "Design recipes that STRICTLY respect all provided constraints:",
    "- REQUIRED dietary tags MUST all be present in dietary_tags",
    "- BLOCKED ingredients MUST NOT appear in any ingredient",
    "- BLOCKED tags MUST NOT appear in tags or dietary_tags",
    "- Respect time limits (max_prep_min, max_cook_min) if specified",
    "Always use precise measurements, sequential steps, and ingredient metadata suitable for grocery planning.",
    "If constraints cannot be satisfied, you may still generate a recipe, but violations will be caught post-generation.",
    "Return ONLY JSON matching the provided schema. Do not include markdown or commentary.",
  ]);

  const userPayload = buildPromptPayload(request);
  const schemaName = recipeSchemaFormat.name; // 'recipe_payload'
  const schemaObject = recipeSchemaFormat.schema; // your JSON Schema
  const schemaStrict = recipeSchemaFormat.strict; // true
  const wireSchema = sanitizeSchema(schemaObject);

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
        instructions: systemPrompt,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Generate a complete recipe for this meal request. " +
                  "CRITICAL CONSTRAINTS:\n" +
                  `- Required dietary tags: ${userPayload.constraints.required_dietary.join(", ") || "none"}\n` +
                  `- Blocked ingredients: ${userPayload.constraints.blocked_ingredients.join(", ") || "none"}\n` +
                  `- Blocked tags: ${userPayload.constraints.blocked_tags.join(", ") || "none"}\n` +
                  (userPayload.constraints.max_prep_min ? `- Max prep time: ${userPayload.constraints.max_prep_min} minutes\n` : "") +
                  (userPayload.constraints.max_cook_min ? `- Max cook time: ${userPayload.constraints.max_cook_min} minutes\n` : "") +
                  "Ensure EVERY constraint is satisfied. Do NOT use blocked ingredients or tags.\n" +
                  "Respond strictly with JSON that conforms to the attached schema.\n\n" +
                  JSON.stringify(userPayload, null, 2),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            schema: wireSchema,
            strict: schemaStrict,
          },
        },
        max_output_tokens: 4096,  // Increased from 1600 to handle complex recipes
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

  // Try output_parsed first (Responses API structured output)
  if (isRecord(responseBody.output_parsed)) {
    payload = responseBody.output_parsed as unknown as AiRecipePayload;
    logger.info("Parsed recipe from output_parsed", {}, "[rx]");
  }
  // Try output_text (legacy format)
  else if (typeof responseBody.output_text === "string") {
    try {
      payload = JSON.parse(responseBody.output_text) as AiRecipePayload;
      logger.info("Parsed recipe from output_text", {}, "[rx]");
    } catch {
      // ignore parse errors and continue scanning content blocks
    }
  }

  // Try scanning output array (Responses API message format)
  if (!payload) {
    const output = Array.isArray(responseBody.output)
      ? responseBody.output
      : [];

    for (const block of output) {
      // Check if message status is incomplete (timeout/truncated)
      if (isRecord(block) && block.status === "incomplete") {
        logger.error(
          "OpenAI response is incomplete (likely timeout or token limit)",
          {
            message_id: block.id,
            status: block.status,
            has_content: Array.isArray(block.content),
          },
          "[rx]"
        );
        throw new Error("OpenAI response incomplete - generation was cut off (timeout or token limit)");
      }

      // Check if block is a message with content array
      if (isRecord(block) && Array.isArray(block.content)) {
        for (const part of block.content) {
          if (
            isRecord(part) &&
            part.type === "output_text" &&
            typeof part.text === "string"
          ) {
            try {
              payload = JSON.parse(part.text) as AiRecipePayload;
              logger.info("Parsed recipe from output[].content[].text", {}, "[rx]");
              break;
            } catch (parseError) {
              // Log parse error for debugging
              logger.warn(
                "Failed to parse JSON from output_text",
                {
                  text_preview: part.text.slice(0, 200),
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                },
                "[rx]"
              );
              /* continue scanning other parts */
            }
          }
        }
      }
      // Check if block itself has text field (alternative format)
      else if (isRecord(block) && typeof block.text === "string") {
        try {
          payload = JSON.parse(block.text) as AiRecipePayload;
          logger.info("Parsed recipe from output[].text", {}, "[rx]");
          break;
        } catch {
          /* continue scanning */
        }
      }
      if (payload) break;
    }
  }

  // Validate payload structure
  if (!payload) {
    // Log the response structure for debugging
    logger.error(
      "Failed to parse recipe from OpenAI response - no payload found",
      {
        has_output_parsed: !!responseBody.output_parsed,
        has_output_text: !!responseBody.output_text,
        has_output: !!responseBody.output,
        output_length: Array.isArray(responseBody.output) ? responseBody.output.length : 0,
        response_keys: Object.keys(responseBody),
        first_output_item: Array.isArray(responseBody.output) && responseBody.output.length > 0
          ? JSON.stringify(responseBody.output[0]).slice(0, 300)
          : null,
      },
      "[rx]"
    );
    throw new Error("OpenAI response did not include structured recipe data");
  }

  // Check if payload has recipe field, or if payload itself is the recipe
  let recipeData = payload.recipe;
  if (!recipeData && isRecord(payload)) {
    // Maybe the payload itself is the recipe (no wrapper)
    // Check if it has recipe-like fields
    if (payload.title || payload.ingredients || payload.steps) {
      logger.info("Payload is the recipe itself (no wrapper)", {}, "[rx]");
      recipeData = payload as unknown as AiRecipePayload["recipe"];
    }
  }

  if (!recipeData) {
    logger.error(
      "Failed to parse recipe from OpenAI response - payload has no recipe field",
      {
        payload_keys: Object.keys(payload),
        payload_preview: JSON.stringify(payload).slice(0, 300),
      },
      "[rx]"
    );
    throw new Error("OpenAI response did not include structured recipe data");
  }

  return {
    recipe: recipeData,
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
    ...request.constraints.required_dietary,
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
    idempotency_key: request.idempotency_key,
    job_id: request.job_id,
    constraints: request.constraints,
    provenance: {
      model: openAiModel,
      temperature: 0.8,
      generated_at: new Date().toISOString(),
    },
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
          : null,
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

  const startTime = Date.now();
  let normalizedRequest: NormalizedRecipeRequest | null = null;

  try {
    normalizedRequest = await parseRequest(payload);

    logger.info("Starting recipe generation", {
      stage: "recipes_ai.generate",
      job_id: normalizedRequest.job_id,
      idempotency_key: normalizedRequest.idempotency_key,
      title: normalizedRequest.title,
      meal_type: normalizedRequest.meal_type,
      household_id: normalizedRequest.household_id,
      dry_run: normalizedRequest.dry_run,
    });

    // Check idempotency
    const existingRecipe = await checkIdempotency(
      normalizedRequest.idempotency_key,
      normalizedRequest.household_id
    );
    if (existingRecipe) {
      logger.info("Idempotent duplicate detected", {
        stage: "recipes_ai.idempotency_check",
        job_id: normalizedRequest.job_id,
        idempotency_key: normalizedRequest.idempotency_key,
        recipe_id: existingRecipe.recipe_id,
      });
      return createJsonResponse(
        {
          success: true,
          recipe_id: existingRecipe.recipe_id,
          slug: existingRecipe.slug,
          title: existingRecipe.title,
          idempotent: true,
        },
        200
      );
    }

    // Generate recipe using AI
    const aiStartTime = Date.now();
    const { recipe: aiRecipe, raw: rawResponse } = await callRecipeModel(normalizedRequest);
    const aiLatency = Date.now() - aiStartTime;

    logger.info("AI generation completed", {
      stage: "recipes_ai.ai_complete",
      job_id: normalizedRequest.job_id,
      idempotency_key: normalizedRequest.idempotency_key,
      latency_ms: aiLatency,
    });

    // Validate constraints
    const validation = validateConstraints(aiRecipe, normalizedRequest.constraints);
    if (!validation.valid) {
      logger.warn("Constraint validation failed", {
        stage: "recipes_ai.constraint_violation",
        job_id: normalizedRequest.job_id,
        idempotency_key: normalizedRequest.idempotency_key,
        violations: validation.violations,
      });
      return createJsonResponse(
        {
          success: false,
          error: "Recipe violates constraints",
          error_type: "CONSTRAINT_VIOLATION",
          violations: validation.violations,
        } as RecipeError,
        400
      );
    }

    // Build persistable recipe
    const persistable = await buildPersistableRecipe(
      normalizedRequest,
      aiRecipe
    );

    // Dry run mode - return without persisting
    if (normalizedRequest.dry_run) {
      logger.info("Dry run mode - returning without persisting", {
        stage: "recipes_ai.dry_run",
        job_id: normalizedRequest.job_id,
        idempotency_key: normalizedRequest.idempotency_key,
      });
      return createJsonResponse(
        {
          success: true,
          dry_run: true,
          recipe: persistable,
          provenance: {
            model: openAiModel,
            temperature: 0.8,
            prompt_hash: crypto.randomUUID(), // Placeholder for actual hash
          },
        },
        200
      );
    }

    // Persist recipe
    const persistStartTime = Date.now();
    const { recipeId } = await persistRecipe(persistable);
    const persistLatency = Date.now() - persistStartTime;
    const totalLatency = Date.now() - startTime;

    logger.info("Recipe persisted successfully", {
      stage: "recipes_ai.complete",
      job_id: normalizedRequest.job_id,
      idempotency_key: normalizedRequest.idempotency_key,
      recipe_id: recipeId,
      slug: persistable.base.slug,
      created_by: persistable.base.created_by,
      metrics: {
        total_latency_ms: totalLatency,
        ai_latency_ms: aiLatency,
        persist_latency_ms: persistLatency,
      },
    });

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
    const totalLatency = Date.now() - startTime;

    // Determine error type
    let errorType: RecipeErrorType = "VALIDATION_ERROR";
    let message = "Unexpected error";
    let status = 500;

    if (error instanceof ValidationError) {
      errorType = "VALIDATION_ERROR";
      message = error.message;
      status = error.status;
    } else if (error instanceof Error) {
      message = error.message;

      // Categorize by message content
      if (message.includes("timeout") || message.includes("timed out")) {
        errorType = "PROVIDER_TIMEOUT";
        status = 504;
      } else if (message.includes("OpenAI") || message.includes("API")) {
        errorType = "PROVIDER_ERROR";
        status = 502;
      } else if (message.includes("schema") || message.includes("structured")) {
        errorType = "SCHEMA_VALIDATION_ERROR";
        status = 422;
      } else if (message.includes("database") || message.includes("persist")) {
        errorType = "DB_PERSIST_ERROR";
        status = 500;
      }
    }

    logger.error("Recipe generation failed", {
      stage: "recipes_ai.error",
      job_id: normalizedRequest?.job_id,
      idempotency_key: normalizedRequest?.idempotency_key,
      error_type: errorType,
      message,
      error: error instanceof Error ? error.stack : error,
      metrics: {
        total_latency_ms: totalLatency,
      },
    });

    return createJsonResponse(
      {
        success: false,
        error: message,
        error_type: errorType,
      } as RecipeError,
      status
    );
  }
});






