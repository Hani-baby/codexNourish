import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";

import { orchestratorLogger } from "../_shared/logger.ts";
import {
  AsyncJobRecord,
  AuthorizationError,
  DraftGenerationResult,
  MealPlanDraftItem,
  MealPlanDraftRecord,
  NormalizedMealPlanRequest,
  OrchestratorError,
  RecipeAssignmentResult,
  RecipeAssignmentRunStats,
  RecipeAssignmentResumeHint,
  ValidationError,
} from "../_shared/types.ts";
import {
  fetchHouseholdPreferences,
  HouseholdPreferenceAggregate,
} from "../_shared/preferences.ts";
import {
  appendJobMeta,
  createJob,
  findActiveJobBySignature,
  markJobCompleted,
  markJobFailed,
  markJobProcessing,
  updateJobProgress,
} from "./_shared/job-manager.ts";
import { validateAndNormalizePayload } from "../_shared/validation.ts";
import { generateMealPlanDraft } from "./_shared/generate-meal-plan-draft.ts";
import {
  handleCors,
  createJsonResponse,
  createErrorResponse,
} from "../_shared/cors.ts";

const logger = orchestratorLogger;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
const plannerModel = Deno.env.get("OPENAI_PLANNER_MODEL") ?? "gpt-4.1-mini";
const openAiBaseUrl = (
  Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com"
).replace(/\/+$/, "");
const OPENAI_RESPONSES_URL = `${openAiBaseUrl}/v1/responses`;

if (!supabaseUrl || !serviceRoleKey) {
  logger.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
    {},
    "??"
  );
  throw new Error("Supabase environment not configured");
}

if (!openAiApiKey) {
  logger.error(
    "OPENAI_API_KEY is not configured for planner orchestrator",
    {},
    "??"
  );
  throw new Error("OPENAI_API_KEY must be set for planner orchestrator");
}

const MAX_PLANNER_ITERATIONS = 12;
const MAX_TOOL_FAILURES = 2;
const MAX_EVENT_HISTORY = 25;
const TIME_BUDGET_MS = 60000; // 60 seconds time budget for recipe generation batch

const SYSTEM_PROMPT = `
You are the Meal Plan Planner, an orchestrator that coordinates specialized tools to deliver production-ready weekly meal plans.

Goal: produce a validated, fully assigned, and finalized meal plan for the provided household and date range.

Decision Policy (follow this sequence):
1. If no draft exists → call generate_plan_draft
2. After draft creation → call validate_plan with stage="pre_assignment"
3. If pre-assignment validation passes → call assign_recipes
4. If unmatched items remain → call generate_missing_recipes, then call assign_recipes again (loop as needed)
5. After all items are assigned → call validate_plan with stage="post_assignment"
6. If post-assignment validation passes and unmatchedIndexes is empty → call finalize_plan with dry_run=false
7. After finalization completes → emit your final JSON summary

Guidelines:
- Only use the provided tools; never assume their outcomes.
- Always validate twice: once immediately after draft creation ("pre_assignment") and again after every slot has a recipe ("post_assignment").
- Do not assign recipes until a draft exists and passes pre-assignment validation.
- If recipe assignment leaves unmatched items, call recipe generation to fill them before re-validating.
- Never finalize until post-assignment validation succeeds and there are zero unmatched items.
- Surface tool failures immediately, decide whether to retry, and avoid infinite loops.
- After each tool result, you will receive a compact state snapshot. Use it to decide your next action.
- When post-assignment validation passes and no unmatched items remain, you MUST call finalize_plan.
- After finalization completes successfully, you MUST emit a final JSON summary in this exact format:
  {"status":"completed"|"failed","message":"...","warnings":[...]}

Stay concise and base decisions on the latest state summary provided to you.
`.trim();

type ValidationStage = "pre_assignment" | "post_assignment";

interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  date?: string;
  meal_type?: string;
  item_index?: number;
}

interface ValidationSnapshot {
  stage: ValidationStage;
  valid: boolean;
  issues: ValidationIssue[];
  itemCount: number;
  coverage?: {
    missing: string[];
    duplicates: string[];
  };
  checkedAt: string;
}

interface AssignmentSnapshot {
  runCount: number;
  hasMore: boolean;
  totalItems: number;
  totalAssigned: number;
  unmatchedIndexes: number[];
  lastStats?: RecipeAssignmentRunStats;
  lastAssignments?: RecipeAssignmentResult[];
}

interface RecipeGenerationSnapshot {
  generated: number;
  recipeIds: string[];
  lastProcessedIndexes: number[];
  pendingIndexes: number[];
  errors: PlannerFault[];
}

interface FinalizationSnapshot {
  status: "pending" | "completed";
  mealPlanId?: string;
  dryRun?: boolean;
  completedAt?: string;
}

interface PlannerEvent {
  timestamp: string;
  step: string;
  status: "pending" | "success" | "error";
  tool?: string;
  message: string;
  detail?: unknown;
}

interface PlannerFault {
  timestamp: string;
  step: string;
  message: string;
  detail?: unknown;
}

interface PlannerState {
  draftId?: string;
  draftStatus: "none" | "pending" | "ready" | "failed";
  draftTitle?: string;
  draftSummary?: {
    itemCount: number;
    dayCount: number;
    slotsPerDay: number;
  };
  validations: Partial<Record<ValidationStage, ValidationSnapshot>>;
  assignment?: AssignmentSnapshot;
  recipeGeneration?: RecipeGenerationSnapshot;
  finalization?: FinalizationSnapshot;
  events: PlannerEvent[];
  faults: PlannerFault[];
}

interface ToolResult {
  status: "success" | "error";
  step: string;
  message: string;
  data?: Record<string, unknown>;
  issues?: ValidationIssue[];
  faults?: PlannerFault[];
}

interface PlannerRunOutcome {
  status: "success" | "failed";
  summary: string;
  mealPlanId: string | null;
  state: PlannerState;
}

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionResponse {
  choices?: Array<{
    index: number;
    finish_reason: string | null;
    message: ChatCompletionMessage;
  }>;
}

interface RecipeAssignerCallResult {
  assignments: RecipeAssignmentResult[];
  stats: RecipeAssignmentRunStats;
  unmatchedIndexes: number[];
  hasMore: boolean;
  status: "partial" | "completed";
  resumeHint: RecipeAssignmentResumeHint | null;
}

interface RecipeAiSuccessResponse {
  success: true;
  recipe_id: string;
  slug: string;
  title: string;
  idempotent?: boolean;
}

interface FinalizeOutcome {
  mealPlanId: string | null;
  created: boolean;
  dryRun: boolean;
  itemCount: number;
}

const isoNow = () => new Date().toISOString();

const truncateArray = <T>(values: T[], length: number): T[] =>
  values.length > length ? values.slice(values.length - length) : values;

const deriveSlots = (
  normalized: NormalizedMealPlanRequest,
  draft?: MealPlanDraftRecord & Record<string, unknown>
): string[] => {
  const rawSlots =
    draft && Array.isArray((draft as Record<string, unknown>).slots)
      ? ((draft as Record<string, unknown>).slots as unknown[])
      : [];
  const slots = rawSlots
    .filter(
      (slot): slot is string =>
        typeof slot === "string" && slot.trim().length > 0
    )
    .map((slot) => slot.toLowerCase());

  if (slots.length > 0) {
    return slots;
  }

  const DEFAULT_SLOTS = ["breakfast", "lunch", "dinner", "snack", "dessert", "late_snack"];
  const limit = Math.min(
    Math.max(normalized.meals_per_day, 1),
    DEFAULT_SLOTS.length
  );
  return DEFAULT_SLOTS.slice(0, limit);
};

const buildDateRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return dates;
  }

  const cursor = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    )
  );
  const endTime = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );
  let guard = 0;

  while (cursor.getTime() <= endTime && guard < 120) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }

  return dates;
};

const slotKey = (date: string, mealType: string) =>
  `${date}::${mealType.toLowerCase()}`;

const asMealPlanItems = (draft: MealPlanDraftRecord): MealPlanDraftItem[] =>
  Array.isArray(draft.items) ? (draft.items as MealPlanDraftItem[]) : [];

const validateDraftStage = (
  draft: MealPlanDraftRecord & Record<string, unknown>,
  normalized: NormalizedMealPlanRequest,
  stage: ValidationStage
): ValidationSnapshot => {
  const issues: ValidationIssue[] = [];
  const items = asMealPlanItems(draft);
  const expectedDates = buildDateRange(
    normalized.start_date,
    normalized.end_date
  );
  const slots = deriveSlots(normalized, draft);
  const coverage = new Map<string, number>();
  const missing: string[] = [];
  const duplicates: string[] = [];

  if (items.length === 0) {
    issues.push({
      code: "EMPTY_DRAFT",
      message: "Draft does not contain any meal items",
      severity: "error",
    });
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const itemDate = typeof item.date === "string" ? item.date : "";
    const mealTypeRaw =
      typeof item.meal_type === "string" ? item.meal_type : "";
    const mealType = mealTypeRaw.toLowerCase();

    if (!itemDate || !expectedDates.includes(itemDate)) {
      issues.push({
        code: "DATE_OUT_OF_RANGE",
        message: `Item ${index} uses date ${itemDate || "unknown"
          } outside the requested window`,
        severity: "error",
        date: itemDate || undefined,
        item_index: index,
      });
    }

    if (!mealType || !slots.includes(mealType)) {
      issues.push({
        code: "INVALID_SLOT",
        message: `Item ${index} uses meal_type "${mealTypeRaw}" not allowed for this plan`,
        severity: "error",
        meal_type: mealTypeRaw || undefined,
        item_index: index,
      });
    }

    if (!item.title || item.title.trim().length === 0) {
      issues.push({
        code: "MISSING_TITLE",
        message: `Item ${index} is missing a title`,
        severity: "error",
        item_index: index,
      });
    }

    const key = slotKey(itemDate, mealType);
    coverage.set(key, (coverage.get(key) ?? 0) + 1);

    if (stage === "post_assignment") {
      if (
        !item.recipe_id ||
        typeof item.recipe_id !== "string" ||
        item.recipe_id.trim().length === 0
      ) {
        issues.push({
          code: "MISSING_RECIPE",
          message: `Item ${index} is missing an assigned recipe`,
          severity: "error",
          date: itemDate || undefined,
          meal_type: mealTypeRaw || undefined,
          item_index: index,
        });
      }
    }
  }

  for (const date of expectedDates) {
    for (const slot of slots) {
      const key = slotKey(date, slot);
      const count = coverage.get(key) ?? 0;
      if (count === 0) {
        missing.push(`${date} ${slot}`);
      } else if (count > 1) {
        duplicates.push(`${date} ${slot}`);
      }
    }
  }

  if (missing.length > 0) {
    issues.push({
      code: "MISSING_SLOT_COVERAGE",
      message: `Plan is missing ${missing.length} required slots`,
      severity: "error",
    });
  }

  if (duplicates.length > 0) {
    issues.push({
      code: "DUPLICATE_SLOT",
      message: `Plan has ${duplicates.length} slot collisions`,
      severity: "warning",
    });
  }

  const valid = issues.every((issue) => issue.severity !== "error");

  return {
    stage,
    valid,
    issues,
    itemCount: items.length,
    coverage: {
      missing,
      duplicates,
    },
    checkedAt: isoNow(),
  };
};

const callRecipeAssigner = async (
  draftId: string,
  normalized: NormalizedMealPlanRequest
): Promise<RecipeAssignerCallResult> => {
  const payload = {
    draft_id: draftId,
    household_id: normalized.household_id,
    user_id: normalized.user_id,
  };

  const response = await fetch(`${supabaseUrl}/functions/v1/recipe-assigner`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : `Recipe assigner failed with status ${response.status}`;
    throw new OrchestratorError(message, response.status, json);
  }

  if (!json || json.success !== true) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : "Recipe assigner reported failure";
    throw new OrchestratorError(message, 500, json);
  }

  const assignments = Array.isArray(json.assignments)
    ? (json.assignments as RecipeAssignmentResult[])
    : [];
  const stats = (json.stats ?? {}) as RecipeAssignmentRunStats;
  const unmatched = Array.isArray(json.unmatched_item_indexes)
    ? (json.unmatched_item_indexes as number[])
    : [];
  const status = json.status === "partial" ? "partial" : "completed";
  const hasMore = Boolean(json.has_more) || status === "partial";
  const resumeHint = (json.resume_hint ??
    null) as RecipeAssignmentResumeHint | null;

  return {
    assignments,
    stats,
    unmatchedIndexes: unmatched,
    hasMore,
    status,
    resumeHint,
  };
};

const callRecipesAiForItem = async (
  payload: Record<string, unknown>
): Promise<RecipeAiSuccessResponse> => {
  const response = await fetch(`${supabaseUrl}/functions/v1/recipes-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message =
      json && typeof json.error === "string"
        ? json.error
        : `recipes-ai responded with status ${response.status}`;
    throw new OrchestratorError(message, response.status, json);
  }

  if (!json || json.success !== true) {
    const message =
      json && typeof json.error === "string"
        ? json.error
        : "recipes-ai request failed";
    throw new OrchestratorError(message, 422, json);
  }

  return json as RecipeAiSuccessResponse;
};
const fetchDraft = async (
  draftId: string
): Promise<MealPlanDraftRecord & Record<string, unknown>> => {
  const { data, error } = await serviceClient
    .from("meal_plan_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

  if (error) {
    throw new OrchestratorError("Failed to load meal plan draft", 500, error);
  }

  if (!data) {
    throw new OrchestratorError("Meal plan draft not found", 404);
  }

  return data as MealPlanDraftRecord & Record<string, unknown>;
};

const updateDraftRecord = async (
  draftId: string,
  patch: Record<string, unknown>
) => {
  const { error } = await serviceClient
    .from("meal_plan_drafts")
    .update({
      ...patch,
      updated_at: isoNow(),
    })
    .eq("id", draftId);

  if (error) {
    throw new OrchestratorError("Failed to update meal plan draft", 500, error);
  }
};

const finalizeMealPlanInDatabase = async ({
  job,
  draft,
  normalized,
  dryRun = false,
}: {
  job: AsyncJobRecord;
  draft: MealPlanDraftRecord & Record<string, unknown>;
  normalized: NormalizedMealPlanRequest;
  dryRun?: boolean;
}): Promise<FinalizeOutcome> => {
  const items = asMealPlanItems(draft);

  if (!dryRun) {
    const missingRecipeIndex = items.findIndex(
      (item) => !item.recipe_id || typeof item.recipe_id !== "string"
    );
    if (missingRecipeIndex >= 0) {
      throw new ValidationError(
        `Cannot finalize: item ${missingRecipeIndex} is missing an assigned recipe`
      );
    }
  }

  if (dryRun) {
    return {
      mealPlanId: null,
      created: false,
      dryRun: true,
      itemCount: items.length,
    };
  }

  const metaPatch = {
    orchestrator_job_id: job.id,
    draft_id: draft.id,
    orchestrator_version: "planner-v1",
  };

  let mealPlanId: string | null = null;
  let existingMeta: Record<string, unknown> = {};

  const byJob = await serviceClient
    .from("meal_plans")
    .select("id, meta")
    .contains("meta", { orchestrator_job_id: job.id })
    .maybeSingle();

  if (byJob.error) {
    throw new OrchestratorError(
      "Failed querying meal plans by job",
      500,
      byJob.error
    );
  }

  if (byJob.data) {
    mealPlanId = byJob.data.id as string;
    existingMeta = (byJob.data.meta ?? {}) as Record<string, unknown>;
  }

  if (!mealPlanId) {
    const byDraft = await serviceClient
      .from("meal_plans")
      .select("id, meta")
      .contains("meta", { draft_id: draft.id })
      .maybeSingle();

    if (byDraft.error) {
      throw new OrchestratorError(
        "Failed querying meal plans by draft",
        500,
        byDraft.error
      );
    }

    if (byDraft.data) {
      mealPlanId = byDraft.data.id as string;
      existingMeta = (byDraft.data.meta ?? {}) as Record<string, unknown>;
    }
  }

  if (!mealPlanId) {
    const byWindow = await serviceClient
      .from("meal_plans")
      .select("id, meta")
      .eq("household_id", normalized.household_id)
      .eq("start_date", normalized.start_date)
      .eq("end_date", normalized.end_date)
      .order("created_at", { ascending: false })
      .limit(1);

    if (byWindow.error) {
      throw new OrchestratorError(
        "Failed querying existing meal plan window",
        500,
        byWindow.error
      );
    }

    if (byWindow.data && byWindow.data.length > 0) {
      mealPlanId = byWindow.data[0].id as string;
      existingMeta = (byWindow.data[0].meta ?? {}) as Record<string, unknown>;
    }
  }

  let created = false;

  if (!mealPlanId) {
    const insert = await serviceClient
      .from("meal_plans")
      .insert({
        household_id: normalized.household_id,
        title:
          (draft as Record<string, unknown>).plan_title &&
            typeof (draft as Record<string, unknown>).plan_title === "string"
            ? ((draft as Record<string, unknown>).plan_title as string)
            : normalized.plan_title,
        start_date: normalized.start_date,
        end_date: normalized.end_date,
        scope: normalized.scope,
        generated_by: "ai",
        created_by: normalized.user_id,
        meta: {
          ...metaPatch,
        },
      })
      .select("id")
      .single();

    if (insert.error || !insert.data) {
      throw new OrchestratorError(
        "Failed to create meal plan",
        500,
        insert.error
      );
    }

    mealPlanId = insert.data.id as string;
    created = true;
  } else {
    const update = await serviceClient
      .from("meal_plans")
      .update({
        meta: {
          ...existingMeta,
          ...metaPatch,
        },
        updated_at: isoNow(),
      })
      .eq("id", mealPlanId);

    if (update.error) {
      throw new OrchestratorError(
        "Failed to update meal plan metadata",
        500,
        update.error
      );
    }
  }

  if (!mealPlanId) {
    throw new OrchestratorError("Meal plan ID missing after finalization", 500);
  }

  const deleteItems = await serviceClient
    .from("meal_plan_items")
    .delete()
    .eq("meal_plan_id", mealPlanId);
  if (deleteItems.error) {
    throw new OrchestratorError(
      "Failed clearing existing meal plan items",
      500,
      deleteItems.error
    );
  }

  if (items.length > 0) {
    const payload = items.map((item, index) => ({
      meal_plan_id: mealPlanId,
      date: item.date,
      meal_type: item.meal_type,
      recipe_id: typeof item.recipe_id === "string" ? item.recipe_id : null,
      external_item_name:
        item.recipe_id && typeof item.recipe_id === "string"
          ? null
          : item.title ?? null,
      servings:
        typeof item.servings === "number" && !Number.isNaN(item.servings)
          ? item.servings
          : 1,
      notes: item.notes ?? null,
      position: index,
      meta: {
        draft_item_index: index,
        draft_id: draft.id,
        source: "planner-orchestrator",
      },
    }));

    const insertItems = await serviceClient
      .from("meal_plan_items")
      .insert(payload);
    if (insertItems.error) {
      throw new OrchestratorError(
        "Failed inserting meal plan items",
        500,
        insertItems.error
      );
    }
  }

  const draftUpdate = await serviceClient
    .from("meal_plan_drafts")
    .update({
      status: "converted",
      progress_message: "Finalized via planner orchestrator",
      completed_at: isoNow(),
      updated_at: isoNow(),
    })
    .eq("id", draft.id);

  if (draftUpdate.error) {
    throw new OrchestratorError(
      "Failed updating draft after finalization",
      500,
      draftUpdate.error
    );
  }

  return {
    mealPlanId,
    created,
    dryRun: false,
    itemCount: items.length,
  };
};
class PlannerAgent {
  private job: AsyncJobRecord;
  private normalized: NormalizedMealPlanRequest;
  private readonly accessToken: string;
  private messages: ChatCompletionMessage[];
  private state: PlannerState;
  private householdPreferences: HouseholdPreferenceAggregate | null = null;
  private previousResponseId: string | null = null;
  private readonly plannerTools = [
    {
      type: "function",
      name: "generate_plan_draft",
      description:
        "Create or regenerate the meal plan draft using the Draft Generator service.",
      parameters: {
        type: "object",
        properties: {
          force_regenerate: {
            type: "boolean",
            description:
              "Set true to discard the existing draft and generate a new one.",
          },
          reason: {
            type: "string",
            description:
              "Optional explanation for why regeneration is required.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "validate_plan",
      description: "Run structural validation on the current draft.",
      parameters: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            enum: ["pre_assignment", "post_assignment"],
            description: "Which validation stage to execute.",
          },
        },
        required: ["stage"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "assign_recipes",
      description:
        "Invoke the recipe assigner to map draft items to existing recipes.",
      parameters: {
        type: "object",
        properties: {
          note: {
            type: "string",
            description: "Optional context for this assignment run.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "generate_missing_recipes",
      description:
        "Generate new recipes for unmatched draft items using Recipe AI.",
      parameters: {
        type: "object",
        properties: {
          item_indexes: {
            type: "array",
            items: { type: "integer" },
            description:
              "Specific draft item indexes to process. Defaults to all currently unmatched items.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "finalize_plan",
      description:
        "Persist the fully validated plan to the database. Must only be called when validation succeeds and no items are unmatched.",
      parameters: {
        type: "object",
        properties: {
          dry_run: {
            type: "boolean",
            description:
              "If true, perform validation but skip database writes.",
          },
        },
        additionalProperties: false,
      },
    },
  ];

  private toolFailureCounts = new Map<string, number>();

  constructor(params: {
    job: AsyncJobRecord;
    normalized: NormalizedMealPlanRequest;
    accessToken: string;
  }) {
    this.job = params.job;
    this.normalized = { ...params.normalized };
    this.accessToken = params.accessToken;

    // Check if we're resuming from a previous chunk
    const savedState = this.job.meta?.planner_state as PlannerState | undefined;
    const chunkNumber = this.job.meta?.chunk_number as number | undefined;

    if (savedState) {
      // Resume from saved state - start a FRESH conversation with the current state
      // We don't try to continue the OpenAI conversation because that state doesn't
      // persist across our function invocations
      this.state = savedState;
      this.previousResponseId = null; // Always start fresh conversation for each chunk

      // Compose a resume message that includes the current state
      const resumeMessage = this.composeResumeMessage(chunkNumber ?? 1);
      this.messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: resumeMessage },
      ];

      logger.info(
        "Resuming planner from saved state with fresh conversation",
        {
          chunk_number: chunkNumber ?? 1,
          draft_id: this.state.draftId,
          draft_status: this.state.draftStatus,
          has_assignments: !!this.state.assignment,
          pending_recipes: this.state.recipeGeneration?.pendingIndexes?.length ?? 0,
          total_assigned: this.state.assignment?.totalAssigned ?? 0,
          total_items: this.state.assignment?.totalItems ?? 0,
        },
        "🔁"
      );
    } else {
      // Start fresh
      this.state = {
        draftStatus: "none",
        validations: {},
        events: [],
        faults: [],
      };
      this.messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: this.composeInitialUserMessage() },
      ];
    }
  }

  public async run(): Promise<PlannerRunOutcome> {
    for (
      let iteration = 1;
      iteration <= MAX_PLANNER_ITERATIONS;
      iteration += 1
    ) {
      const response = await this.callOpenAi();

      // Log the raw response structure for debugging
      logger.info(
        "OpenAI response structure",
        {
          has_output: !!(response as any).output,
          output_length: Array.isArray((response as any).output) ? (response as any).output.length : 0,
          output_types: Array.isArray((response as any).output)
            ? (response as any).output.map((item: any) => item?.type)
            : [],
          first_item: Array.isArray((response as any).output) && (response as any).output.length > 0
            ? JSON.stringify((response as any).output[0]).slice(0, 200)
            : null,
        },
        "🔍"
      );

      // Handle Responses API output format
      const output = (response as any).output;
      if (!output || !Array.isArray(output) || output.length === 0) {
        logger.error(
          "Planner model returned no output",
          { response_keys: Object.keys(response), response },
          "❌"
        );
        throw new OrchestratorError(
          "Planner model returned no output",
          502,
          response
        );
      }

      // Find the message item in output
      // The Responses API may return items with type="message" OR directly as message objects
      let messageItem = output.find((item: any) => item.type === "message");

      // Fallback: if no item with type="message", check if first item is a message-like object
      if (!messageItem && output.length > 0) {
        const firstItem = output[0];
        // Check if it looks like a message (has role and content)
        if (firstItem && (firstItem.role === "assistant" || firstItem.content)) {
          messageItem = firstItem;
          logger.info(
            "Using first output item as message (no explicit type field)",
            { item_keys: Object.keys(firstItem), role: firstItem.role },
            "🔄"
          );
        }
      }

      // Extract tool calls and text content
      let toolCalls: any[] = [];
      let textContent = "";

      if (messageItem) {
        // Extract content array from the message
        const content = Array.isArray(messageItem.content) ? messageItem.content : [];

        // Extract tool calls from content
        toolCalls = content.filter((c: any) => c.type === "tool_call");

        // Extract text content
        const textItem = content.find((c: any) => c.type === "output_text");
        if (textItem && textItem.text) {
          textContent = textItem.text;
        }
      } else {
        // No message item - check if output contains direct function_call items
        const functionCalls = output.filter((item: any) => item.type === "function_call");

        if (functionCalls.length > 0) {
          logger.info(
            "No message item found, but found function_call items - converting to tool calls",
            { function_call_count: functionCalls.length },
            "🔄"
          );

          // Convert function_call items to tool_call format
          toolCalls = functionCalls.map((fc: any) => ({
            type: "tool_call",
            id: fc.call_id || fc.id,
            name: fc.name,
            arguments: fc.arguments,
          }));
        } else {
          logger.error(
            "Planner model output missing message item and no function calls found",
            {
              output_items: output.map((item: any) => ({
                type: item?.type,
                role: item?.role,
                keys: Object.keys(item || {})
              })),
              full_output: JSON.stringify(output).slice(0, 500)
            },
            "❌"
          );
          throw new OrchestratorError(
            "Planner model output missing message item",
            502,
            response
          );
        }
      }

      // Map tool calls to standard format for internal message tracking
      const finalToolCalls = toolCalls.map((tc: any) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));

      this.messages.push({
        role: "assistant",
        content: textContent,
        tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
      });

      if (finalToolCalls && finalToolCalls.length > 0) {
        for (const toolCall of finalToolCalls) {
          const toolCallObj: ToolCall = {
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          };
          const result = await this.executeTool(toolCallObj);
          this.messages.push({
            role: "tool",
            name: toolCallObj.function.name,
            tool_call_id: toolCallObj.id,
            content: JSON.stringify(result),
          });

          // Feed compact state snapshot after each tool result
          const stateSnapshot = this.serializeState();
          const postAssignmentValid = this.state.validations.post_assignment?.valid ?? false;
          const unmatchedCount = this.state.assignment?.unmatchedIndexes?.length ?? 0;

          let instruction = "Review the state and choose the next tool.";
          if (postAssignmentValid && unmatchedCount === 0 && !this.state.finalization?.mealPlanId) {
            instruction = "Post-assignment validation passed and no unmatched items remain. You MUST call finalize_plan now.";
          }

          this.messages.push({
            role: "user",
            content: `State: ${JSON.stringify(stateSnapshot)}\n\n${instruction}`,
          });

          logger.info(
            `State breadcrumb after ${toolCallObj.function.name}`,
            {
              draft_status: this.state.draftStatus,
              pre_valid: this.state.validations.pre_assignment?.valid ?? null,
              post_valid: postAssignmentValid,
              unmatched: unmatchedCount,
              finalized: !!this.state.finalization?.mealPlanId,
            },
            "??"
          );
        }
        continue;
      }

      // Get finish reason from message status (Responses API uses status field)
      const finishReason = messageItem.status === "completed" ? "stop" : messageItem.status;
      if (finishReason === "stop") {
        // Log what the model returned when it stopped
        logger.info(
          "Model stopped with finish_reason=stop",
          {
            iteration,
            text_content: textContent?.slice(0, 200),
            draft_status: this.state.draftStatus,
            has_draft: !!this.state.draftId,
            has_assignments: (this.state.assignment?.totalAssigned ?? 0) > 0,
            unmatched_count: this.state.assignment?.unmatchedIndexes?.length ?? 0,
            finalized: !!this.state.finalization?.mealPlanId,
          },
          "??"
        );

        // Check if we need server-side fallback finalization
        const postAssignmentValid = this.state.validations.post_assignment?.valid ?? false;
        const preAssignmentValid = this.state.validations.pre_assignment?.valid ?? false;
        const unmatchedCount = this.state.assignment?.unmatchedIndexes?.length ?? 0;
        const alreadyFinalized = !!this.state.finalization?.mealPlanId;
        const hasDraft = this.state.draftStatus === "ready" && !!this.state.draftId;
        const hasAssignments = (this.state.assignment?.totalAssigned ?? 0) > 0;

        // Trigger fallback if:
        // 1. Post-validation passed with zero unmatched, OR
        // 2. We have a draft with assignments and zero unmatched (even if post-validation wasn't run), OR
        // 3. We have a draft that passed pre-validation (most aggressive - will run full pipeline)
        const shouldFallbackFinalize = !alreadyFinalized && (
          (postAssignmentValid && unmatchedCount === 0) ||
          (hasDraft && hasAssignments && unmatchedCount === 0) ||
          (hasDraft && preAssignmentValid)
        );

        if (shouldFallbackFinalize) {
          logger.warn(
            "Model stopped prematurely. Triggering server-side fallback to complete the pipeline.",
            {
              job_id: this.job.id,
              iteration,
              post_validation_passed: postAssignmentValid,
              pre_validation_passed: preAssignmentValid,
              has_draft: hasDraft,
              has_assignments: hasAssignments,
              unmatched_count: unmatchedCount,
              fallback_reason: postAssignmentValid ? "post_valid" : hasAssignments ? "has_assignments" : "has_draft"
            },
            "??"
          );

          try {
            // Run the full pipeline server-side
            if (!hasAssignments && hasDraft) {
              logger.info("Running recipe assignment as part of fallback", {}, "??");
              await this.handleAssignRecipes();
            }

            // Check if we still have unmatched after assignment
            const stillUnmatched = this.state.assignment?.unmatchedIndexes?.length ?? 0;
            if (stillUnmatched > 0) {
              logger.info(`Generating ${stillUnmatched} missing recipes as part of fallback`, {}, "??");
              await this.handleGenerateRecipes({});
              // Re-assign after generation
              await this.handleAssignRecipes();
            }

            // Validate post-assignment if not done yet
            if (!this.state.validations.post_assignment) {
              logger.info("Running post-assignment validation as part of fallback", {}, "??");
              await this.handleValidatePlan({ stage: "post_assignment" });
            }

            // Now finalize
            const fallbackResult = await this.handleFinalizePlan({ dry_run: false });
            if (fallbackResult.status === "success") {
              logger.info(
                "Server-side fallback pipeline completed successfully",
                { meal_plan_id: this.state.finalization?.mealPlanId },
                "??"
              );

              return {
                status: "success",
                summary: "Meal plan finalized via server-side fallback pipeline after model stopped prematurely",
                mealPlanId: this.state.finalization?.mealPlanId ?? null,
                state: this.state,
              };
            } else {
              logger.error(
                "Server-side fallback finalization failed",
                { result: fallbackResult },
                "??"
              );
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(
              "Server-side fallback pipeline threw error",
              { error: errorMessage },
              "??"
            );

            // Return failed status when fallback throws an error
            return {
              status: "failed",
              summary: `Fallback pipeline failed: ${errorMessage}`,
              mealPlanId: this.state.finalization?.mealPlanId ?? null,
              state: this.state,
            };
          }
        }

        const summary = this.parseFinalSummary(textContent);
        return {
          status: summary.status,
          summary: summary.message,
          mealPlanId: this.state.finalization?.mealPlanId ?? null,
          state: this.state,
        };
      }

      await this.pushFault(
        "planner",
        `Unexpected finish reason: ${finishReason}`,
        messageItem
      );
    }

    throw new OrchestratorError("Planner exceeded iteration limit", 504);
  }

  public getJob(): AsyncJobRecord {
    return this.job;
  }

  public getState(): PlannerState {
    return this.state;
  }

  private composeInitialUserMessage(): string {
    const summary = {
      action: "start",
      job_id: this.job.id,
      household_id: this.normalized.household_id,
      date_range: {
        start: this.normalized.start_date,
        end: this.normalized.end_date,
      },
      meals_per_day: this.normalized.meals_per_day,
      plan_title: this.normalized.plan_title,
      state: this.serializeState(),
    };
    return `Begin meal plan orchestration.\n${JSON.stringify(summary)}`;
  }

  private composeResumeMessage(chunkNumber: number): string {
    const summary = {
      action: "resume",
      chunk_number: chunkNumber,
      job_id: this.job.id,
      household_id: this.normalized.household_id,
      date_range: {
        start: this.normalized.start_date,
        end: this.normalized.end_date,
      },
      meals_per_day: this.normalized.meals_per_day,
      plan_title: this.normalized.plan_title,
      state: this.serializeState(),
      progress_summary: {
        draft_ready: this.state.draftStatus === "ready",
        pre_validation_passed: this.state.validations.pre_assignment?.valid ?? false,
        recipes_assigned: this.state.assignment?.totalAssigned ?? 0,
        total_items: this.state.assignment?.totalItems ?? 0,
        unmatched_items: this.state.assignment?.unmatchedIndexes?.length ?? 0,
        recipes_generated: this.state.recipeGeneration?.generated ?? 0,
        post_validation_passed: this.state.validations.post_assignment?.valid ?? false,
        finalized: !!this.state.finalization?.mealPlanId,
      },
    };
    return `Resume meal plan orchestration (chunk ${chunkNumber}).\n\nPrevious work completed. Current state:\n${JSON.stringify(summary, null, 2)}\n\nContinue with next steps based on current state.`;
  }

  private serializeState() {
    return {
      draft: {
        id: this.state.draftId ?? null,
        status: this.state.draftStatus,
        summary: this.state.draftSummary ?? null,
      },
      validation: {
        pre_assignment: this.state.validations.pre_assignment?.valid ?? null,
        post_assignment: this.state.validations.post_assignment?.valid ?? null,
      },
      assignment: this.state.assignment
        ? {
          total_items: this.state.assignment.totalItems,
          total_assigned: this.state.assignment.totalAssigned,
          unmatched_indexes: this.state.assignment.unmatchedIndexes,
          has_more: this.state.assignment.hasMore,
          runs: this.state.assignment.runCount,
        }
        : null,
      recipe_generation: this.state.recipeGeneration
        ? {
          generated: this.state.recipeGeneration.generated,
          pending: this.state.recipeGeneration.pendingIndexes,
        }
        : null,
      finalization: this.state.finalization ?? null,
    };
  }

  private async recordEvent(event: PlannerEvent) {
    this.state.events.push(event);
    this.state.events = truncateArray(this.state.events, MAX_EVENT_HISTORY);
    this.job = await appendJobMeta(serviceClient, this.job, {
      planner_events: this.state.events,
      planner_state: {
        draft_id: this.state.draftId ?? null,
        draft_status: this.state.draftStatus,
        assignment: this.state.assignment ?? null,
        finalization: this.state.finalization ?? null,
      },
    });
  }

  private async pushFault(step: string, message: string, detail?: unknown) {
    const fault: PlannerFault = {
      timestamp: isoNow(),
      step,
      message,
      detail,
    };
    this.state.faults.push(fault);
    this.state.faults = truncateArray(this.state.faults, MAX_EVENT_HISTORY);
    this.job = await appendJobMeta(serviceClient, this.job, {
      planner_faults: this.state.faults,
    });
    await this.recordEvent({
      timestamp: fault.timestamp,
      step,
      status: "error",
      message,
      detail,
    });
  }

  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const toolName = toolCall?.function?.name ?? "unknown";
    let args: Record<string, unknown>;
    try {
      args = toolCall.function?.arguments
        ? (JSON.parse(toolCall.function.arguments || "{}") as Record<
          string,
          unknown
        >)
        : {};
    } catch (error) {
      const message = `Failed to parse arguments for ${toolName}`;
      await this.pushFault("tool_argument_parse", message, {
        raw: toolCall.function?.arguments,
        error: error instanceof Error ? error.message : error,
      });
      return {
        status: "error",
        step: toolName,
        message,
      };
    }

    let result: ToolResult;

    switch (toolName) {
      case "generate_plan_draft":
        result = await this.handleGenerateDraft(
          args as { force_regenerate?: boolean; reason?: string }
        );
        break;
      case "validate_plan":
        result = await this.handleValidatePlan(
          args as { stage?: ValidationStage }
        );
        break;
      case "assign_recipes":
        result = await this.handleAssignRecipes();
        break;
      case "generate_missing_recipes":
        result = await this.handleGenerateRecipes(
          args as { item_indexes?: number[] }
        );
        break;
      case "finalize_plan":
        result = await this.handleFinalizePlan(args as { dry_run?: boolean });
        break;
      default:
        const message = `Unknown tool requested: ${toolName}`;
        await this.pushFault("tool_selection", message, toolCall);
        result = {
          status: "error",
          step: toolName,
          message,
        };
    }

    const failureCount = this.toolFailureCounts.get(toolName) ?? 0;
    if (result.status === "error") {
      this.toolFailureCounts.set(toolName, failureCount + 1);
      if (failureCount + 1 >= MAX_TOOL_FAILURES) {
        await this.pushFault(
          "tool_failure_limit",
          `Tool ${toolName} failed ${failureCount + 1
          } times; aborting planner run`,
          result
        );
        throw new OrchestratorError(
          `Tool ${toolName} failed repeatedly`,
          500,
          result
        );
      }
    } else {
      this.toolFailureCounts.set(toolName, 0);
    }

    await this.recordEvent({
      timestamp: isoNow(),
      step: result.step,
      status: result.status === "success" ? "success" : "error",
      tool: toolName,
      message: result.message,
      detail: result.data ?? result.issues ?? undefined,
    });

    return result;
  }

  private parseFinalSummary(raw: string): {
    status: "success" | "failed";
    message: string;
  } {
    if (!raw || raw.trim().length === 0) {
      return {
        status: this.state.finalization?.mealPlanId ? "success" : "failed",
        message: "Planner finished without summary output",
      };
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const statusValue =
          typeof parsed.status === "string" ? parsed.status.toLowerCase() : "";
        const message =
          typeof parsed.message === "string" ? parsed.message : raw.trim();
        const status: "success" | "failed" =
          statusValue === "completed" || statusValue === "success"
            ? "success"
            : statusValue === "failed"
              ? "failed"
              : this.state.finalization?.mealPlanId
                ? "success"
                : "failed";
        return { status, message };
      }
    } catch {
      // ignore JSON parse error, fall back to raw text
    }

    return {
      status: this.state.finalization?.mealPlanId ? "success" : "failed",
      message: raw.trim(),
    };
  }

  private async callOpenAi(): Promise<ChatCompletionResponse> {
    // Use Responses API with stateful conversation via previous_response_id
    const requestBody: any = {
      model: plannerModel,
      temperature: 0.2,
      tools: this.plannerTools,
      tool_choice: "auto",
    };

    if (this.previousResponseId) {
      // Continue existing conversation - only send new user messages since last response
      requestBody.previous_response_id = this.previousResponseId;

      // Find messages added since the last API call (after the last assistant message)
      const lastAssistantIndex = this.messages.map((m, i) => m.role === "assistant" ? i : -1)
        .filter(i => i >= 0)
        .pop() ?? -1;

      const newMessages = lastAssistantIndex >= 0
        ? this.messages.slice(lastAssistantIndex + 1)
        : [];

      // Convert new messages to input format
      // Tool results need special handling with call_id
      const inputItems = newMessages
        .filter(msg => msg.role === "user" || msg.role === "tool")
        .map((msg) => {
          if (msg.role === "tool" && msg.tool_call_id) {
            // Tool results must be sent as function_call_output items
            return {
              type: "function_call_output",
              call_id: msg.tool_call_id,
              output: msg.content ?? "",
            };
          } else {
            // Regular user messages
            return {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: msg.content }],
            };
          }
        });

      requestBody.input = inputItems;
    } else {
      // First call - send initial message with instructions
      const systemMessage = this.messages.find((m) => m.role === "system");
      const instructions = systemMessage?.content ?? SYSTEM_PROMPT;
      requestBody.instructions = instructions;

      const userMessages = this.messages.filter(m => m.role === "user");
      requestBody.input = userMessages.map((msg) => ({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: msg.content }],
      }));
    }

    logger.info(
      "Calling OpenAI Responses API",
      {
        model: plannerModel,
        has_previous_response: !!this.previousResponseId,
        input_items_count: requestBody.input?.length ?? 0,
        tools_count: this.plannerTools.length,
        has_instructions: !!requestBody.instructions,
      },
      "🤖"
    );

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const json = await response.json();

    logger.info(
      "OpenAI API response received",
      {
        status: response.status,
        ok: response.ok,
        has_output: !!(json as any).output,
        response_id: (json as any).id,
        response_keys: Object.keys(json),
      },
      "📥"
    );

    if (!response.ok) {
      const message =
        typeof json?.error?.message === "string"
          ? json.error.message
          : `Planner model failed with status ${response.status}`;
      logger.error(
        "OpenAI API error",
        { status: response.status, error: json },
        "❌"
      );
      throw new OrchestratorError(message, response.status, json);
    }

    // Capture the response ID for continuing the conversation
    if ((json as any).id) {
      this.previousResponseId = (json as any).id;
      logger.info(
        "Captured response ID for conversation continuity",
        { response_id: this.previousResponseId },
        "🔗"
      );
    }

    return json as ChatCompletionResponse;
  }

  private async getHouseholdPreferences(): Promise<HouseholdPreferenceAggregate> {
    if (!this.householdPreferences) {
      this.householdPreferences = await fetchHouseholdPreferences(
        serviceClient,
        this.normalized.household_id
      );
    }
    return this.householdPreferences;
  }

  private async handleGenerateDraft(args: {
    force_regenerate?: boolean;
    reason?: string;
  }): Promise<ToolResult> {
    const step = "draft_generation";

    if (this.state.draftId && !args?.force_regenerate) {
      return {
        status: "success",
        step,
        message: "Draft already exists; skipping regeneration",
        data: {
          draft_id: this.state.draftId,
          status: this.state.draftStatus,
        },
      };
    }

    try {
      const result: DraftGenerationResult = await generateMealPlanDraft(
        this.normalized,
        {
          jobId: this.job.id,
          supabaseUrl,
          serviceRoleKey,
          accessToken: this.accessToken,
          retryAttempt: args?.force_regenerate ? 2 : 1,
        }
      );

      if (!result.draft_id) {
        throw new OrchestratorError(
          "Draft generator did not supply a draft_id",
          500,
          result
        );
      }

      this.state.draftId = result.draft_id;
      this.state.draftStatus =
        result.status === "completed" ? "ready" : "pending";

      const draft = await fetchDraft(result.draft_id);
      const items = asMealPlanItems(draft);
      this.state.draftTitle =
        typeof (draft as Record<string, unknown>).plan_title === "string"
          ? ((draft as Record<string, unknown>).plan_title as string)
          : this.normalized.plan_title;
      this.state.draftSummary = {
        itemCount: items.length,
        dayCount: buildDateRange(
          this.normalized.start_date,
          this.normalized.end_date
        ).length,
        slotsPerDay: deriveSlots(this.normalized, draft).length,
      };

      this.job = await updateJobProgress(serviceClient, this.job, 30);
      this.job = await appendJobMeta(serviceClient, this.job, {
        draft_id: result.draft_id,
      });

      return {
        status: "success",
        step,
        message: `Draft ${result.draft_id} generated`,
        data: {
          draft_id: result.draft_id,
          status: result.status,
          item_count: items.length,
          reason: args?.reason ?? null,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Log detailed error for debugging
      logger.error(
        "Draft generation failed",
        {
          error_message: message,
          error_type: error instanceof Error ? error.constructor.name : typeof error,
          error_stack: error instanceof Error ? error.stack : undefined,
          normalized_payload: {
            household_id: this.normalized.household_id,
            start_date: this.normalized.start_date,
            end_date: this.normalized.end_date,
            meals_per_day: this.normalized.meals_per_day,
          },
        },
        "💥"
      );

      await this.pushFault(step, message, {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: message,
      });
      this.state.draftStatus = "failed";
      return {
        status: "error",
        step,
        message,
        // Don't include full faults array to avoid circular references
        fault_count: this.state.faults.length,
      };
    }
  }

  private async handleValidatePlan(args: {
    stage?: ValidationStage;
  }): Promise<ToolResult> {
    const stage: ValidationStage = args?.stage ?? "pre_assignment";
    const step =
      stage === "pre_assignment" ? "validation_pre" : "validation_post";

    if (!this.state.draftId) {
      const message = "Cannot validate without a draft";
      await this.pushFault(step, message);
      return {
        status: "error",
        step,
        message,
      };
    }

    try {
      const draft = await fetchDraft(this.state.draftId);
      const snapshot = validateDraftStage(draft, this.normalized, stage);
      this.state.validations[stage] = snapshot;

      if (stage === "pre_assignment") {
        this.job = await updateJobProgress(
          serviceClient,
          this.job,
          snapshot.valid ? 40 : 35
        );
      } else {
        this.job = await updateJobProgress(
          serviceClient,
          this.job,
          snapshot.valid ? 95 : 85
        );
      }

      return {
        status: snapshot.valid ? "success" : "error",
        step,
        message: snapshot.valid
          ? `Validation (${stage}) passed`
          : `Validation (${stage}) found ${snapshot.issues.length} issues`,
        issues: snapshot.issues,
        data: {
          valid: snapshot.valid,
          stage,
          missing: snapshot.coverage?.missing ?? [],
          duplicates: snapshot.coverage?.duplicates ?? [],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.pushFault(step, message, error);
      return {
        status: "error",
        step,
        message,
      };
    }
  }

  private async handleAssignRecipes(): Promise<ToolResult> {
    const step = "recipe_assignment";

    if (!this.state.draftId) {
      const message = "Cannot assign recipes without a draft";
      await this.pushFault(step, message);
      return {
        status: "error",
        step,
        message,
      };
    }

    try {
      const result = await callRecipeAssigner(
        this.state.draftId,
        this.normalized
      );

      const previousRunCount = this.state.assignment?.runCount ?? 0;
      this.state.assignment = {
        runCount: previousRunCount + 1,
        hasMore: result.hasMore,
        totalItems: result.stats?.totalItems ?? 0,
        totalAssigned: result.stats?.totalAssigned ?? 0,
        unmatchedIndexes: result.unmatchedIndexes,
        lastStats: result.stats,
        lastAssignments: result.assignments,
      };

      if (result.unmatchedIndexes.length > 0) {
        if (!this.state.recipeGeneration) {
          this.state.recipeGeneration = {
            generated: 0,
            recipeIds: [],
            lastProcessedIndexes: [],
            pendingIndexes: result.unmatchedIndexes,
            errors: [],
          };
        } else {
          this.state.recipeGeneration.pendingIndexes = result.unmatchedIndexes;
        }
      } else if (this.state.recipeGeneration) {
        this.state.recipeGeneration.pendingIndexes = [];
      }

      const totalItems = result.stats?.totalItems ?? 1;
      const totalAssigned = result.stats?.totalAssigned ?? 0;
      const assignmentProgress =
        55 + Math.round((totalAssigned / totalItems) * 20);
      this.job = await updateJobProgress(
        serviceClient,
        this.job,
        Math.min(80, Math.max(50, assignmentProgress))
      );

      return {
        status: "success",
        step,
        message: `Recipe assignment run completed (${totalAssigned}/${totalItems} assigned${result.hasMore ? " - additional work remaining" : ""
          })`,
        data: {
          total_items: totalItems,
          total_assigned: totalAssigned,
          unmatched_indexes: result.unmatchedIndexes,
          has_more: result.hasMore,
          resume_hint: result.resumeHint,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.pushFault(step, message, error);
      return {
        status: "error",
        step,
        message,
      };
    }
  }

  private async handleGenerateRecipes(args: {
    item_indexes?: number[];
  }): Promise<ToolResult> {
    const step = "recipe_generation";

    if (!this.state.draftId) {
      const message = "Cannot generate recipes without a draft";
      await this.pushFault(step, message);
      return {
        status: "error",
        step,
        message,
      };
    }

    try {
      const draft = await fetchDraft(this.state.draftId);
      const items = asMealPlanItems(draft);

      // Check if we're resuming from a previous chunk
      const resumingIndexes = this.job.meta?.pending_recipe_indexes as number[] | undefined;

      const pendingIndexes = resumingIndexes ?? this.state.assignment?.unmatchedIndexes ?? [];
      const requestedIndexes =
        Array.isArray(args?.item_indexes) && args.item_indexes.length > 0
          ? args.item_indexes
          : pendingIndexes;

      if (resumingIndexes && resumingIndexes.length > 0) {
        logger.info(
          `Resuming recipe generation from previous chunk`,
          {
            pending_count: resumingIndexes.length,
            indexes: resumingIndexes
          },
          "🔁"
        );
      }

      const targetIndexes = Array.from(
        new Set(
          requestedIndexes.filter(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < items.length &&
              (!items[index].recipe_id || items[index].recipe_id === null)
          )
        )
      ).sort((a, b) => a - b);

      if (targetIndexes.length === 0) {
        return {
          status: "success",
          step,
          message: "No unmatched items require recipe generation",
          data: {
            unmatched_indexes: pendingIndexes,
          },
        };
      }

      const householdPreferences = await this.getHouseholdPreferences();

      const generatedRecipeIds: string[] = [];
      const failures: Array<{ index: number; error: string }> = [];

      // Chunked execution: Generate recipes in chunks to avoid timeout
      const RECIPES_PER_CHUNK = 7; // Generate 7 recipes per orchestrator run
      const BATCH_SIZE = 7; // Process all recipes in chunk as one batch

      // Check if we need to chunk the work
      const needsChunking = targetIndexes.length > RECIPES_PER_CHUNK;
      const chunkIndexes = needsChunking
        ? targetIndexes.slice(0, RECIPES_PER_CHUNK)
        : targetIndexes;

      const remainingIndexes = needsChunking
        ? targetIndexes.slice(RECIPES_PER_CHUNK)
        : [];

      if (needsChunking) {
        logger.info(
          `Chunked execution: Processing ${chunkIndexes.length} recipes now, ${remainingIndexes.length} remaining for next chunk`,
          {
            current_chunk: chunkIndexes,
            remaining_chunk: remainingIndexes,
            total: targetIndexes.length
          },
          "🔄"
        );
      }

      const recipeGenerationStartTime = Date.now();

      const batches: number[][] = [];
      for (let i = 0; i < chunkIndexes.length; i += BATCH_SIZE) {
        batches.push(chunkIndexes.slice(i, i + BATCH_SIZE));
      }

      const chunkNumber = (this.job.meta?.chunk_number as number ?? 0) + 1;
      const totalGenerated = this.state.recipeGeneration?.generated ?? 0;

      logger.info(
        `Chunk ${chunkNumber}: Generating ${chunkIndexes.length} recipes in ${batches.length} batch(es) of up to ${BATCH_SIZE}`,
        {
          chunk_number: chunkNumber,
          total_recipes: chunkIndexes.length,
          batch_count: batches.length,
          already_generated: totalGenerated,
          remaining_after_chunk: remainingIndexes.length,
        },
        "🔄"
      );

      for (let batchNum = 0; batchNum < batches.length; batchNum++) {
        const batch = batches[batchNum];
        const batchStartTime = Date.now();

        logger.info(
          `Chunk ${chunkNumber}, Batch ${batchNum + 1}/${batches.length}: Starting parallel recipe generation`,
          {
            chunk_number: chunkNumber,
            batch_number: batchNum + 1,
            batch_size: batch.length,
            indexes: batch,
            recipes: batch.map(idx => items[idx].title)
          },
          "🚀"
        );

        const recipePromises = batch.map(async (index) => {
          const item = items[index];
          const recipeStartTime = Date.now();

          logger.info(
            `[Batch ${batchNum + 1}] Starting recipe generation`,
            {
              index,
              title: item.title,
              meal_type: item.meal_type
            },
            "🍳"
          );

          const constraints = {
            required_dietary: Array.isArray(item.tags)
              ? (item.tags.filter((tag) => typeof tag === "string") as string[])
              : [],
            blocked_ingredients:
              householdPreferences.combined.excluded_ingredients ?? [],
            blocked_tags: householdPreferences.combined.dislikes ?? [],
          };

          const requestPayload = {
            title: item.title,
            meal_type: item.meal_type,
            servings:
              typeof item.servings === "number" && !Number.isNaN(item.servings)
                ? item.servings
                : 4,
            constraints,
            cuisine: null,
            household_preferences: householdPreferences,
            session_preferences: this.normalized.session_preferences,
            user_id: this.normalized.user_id,
            household_id: this.normalized.household_id,
            idempotency_key: `${draft.id}:${index}:${this.normalized.start_date}:${this.normalized.end_date}`,
            job_id: this.job.id,
          };

          // Retry logic with time budget awareness
          const MAX_RETRIES = 2;
          let lastError: string = "";

          for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            // Log each attempt start
            if (attempt > 1) {
              logger.info(
                `[Batch ${batchNum + 1}] Retry attempt ${attempt}/${MAX_RETRIES + 1} for recipe`,
                {
                  index,
                  title: item.title,
                  previous_error: lastError.slice(0, 100)
                },
                "🔁"
              );
            }

            try {
              const response = await callRecipesAiForItem(requestPayload);
              const duration = Date.now() - recipeStartTime;

              logger.info(
                `[Batch ${batchNum + 1}] Recipe generated successfully${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
                {
                  index,
                  title: item.title,
                  recipe_id: response.recipe_id,
                  duration_ms: duration,
                  attempts: attempt
                },
                "✅"
              );

              return { index, success: true, recipe_id: response.recipe_id, title: item.title };
            } catch (error) {
              const duration = Date.now() - recipeStartTime;
              const elapsedTotal = Date.now() - recipeGenerationStartTime;
              const message = error instanceof Error ? error.message : String(error);
              lastError = message;

              const isTimeout = message.includes('timeout') || message.includes('timed out') || message.includes('503') || message.includes('incomplete');
              const shouldRetry = attempt <= MAX_RETRIES && isTimeout;
              const hasTimeBudget = elapsedTotal < TIME_BUDGET_MS;

              if (shouldRetry && hasTimeBudget) {
                logger.warn(
                  `[Batch ${batchNum + 1}] Recipe generation failed, retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
                  {
                    index,
                    title: item.title,
                    error: message,
                    duration_ms: duration,
                    elapsed_total_ms: elapsedTotal,
                    time_budget_remaining_ms: TIME_BUDGET_MS - elapsedTotal
                  },
                  "🔄"
                );
                continue; // Retry
              } else {
                // Final failure
                const reason = !hasTimeBudget
                  ? "time budget exceeded"
                  : !isTimeout
                    ? "non-timeout error"
                    : "max retries reached";

                logger.error(
                  `[Batch ${batchNum + 1}] Recipe generation failed permanently (${reason})`,
                  {
                    index,
                    title: item.title,
                    error: message,
                    duration_ms: duration,
                    attempts: attempt,
                    elapsed_total_ms: elapsedTotal
                  },
                  "❌"
                );

                await this.pushFault(`${step}_${index}`, `${message} (${reason})`, error);
                return { index, success: false, error: `${message} (${reason})`, title: item.title };
              }
            }
          }

          // Should never reach here, but just in case
          return { index, success: false, error: lastError || "Unknown error", title: item.title };
        });

        const batchResults = await Promise.all(recipePromises);
        const batchDuration = Date.now() - batchStartTime;
        const batchSuccesses = batchResults.filter(r => r.success).length;
        const batchFailures = batchResults.filter(r => !r.success).length;

        logger.info(
          `Chunk ${chunkNumber}, Batch ${batchNum + 1}/${batches.length} completed`,
          {
            chunk_number: chunkNumber,
            batch_number: batchNum + 1,
            successes: batchSuccesses,
            failures: batchFailures,
            duration_ms: batchDuration,
            avg_duration_ms: Math.round(batchDuration / batch.length)
          },
          "📊"
        );

        // Process batch results
        for (const result of batchResults) {
          if (result.success) {
            items[result.index] = {
              ...items[result.index],
              recipe_id: result.recipe_id,
            };
            generatedRecipeIds.push(result.recipe_id);
          } else {
            failures.push({ index: result.index, error: result.error });
          }
        }
      }

      if (generatedRecipeIds.length > 0) {
        await updateDraftRecord(draft.id, { items });
        if (!this.state.recipeGeneration) {
          this.state.recipeGeneration = {
            generated: generatedRecipeIds.length,
            recipeIds: generatedRecipeIds,
            lastProcessedIndexes: targetIndexes,
            pendingIndexes: [],
            errors: [],
          };
        } else {
          this.state.recipeGeneration.generated += generatedRecipeIds.length;
          this.state.recipeGeneration.recipeIds.push(...generatedRecipeIds);
          this.state.recipeGeneration.lastProcessedIndexes = targetIndexes;
          this.state.recipeGeneration.pendingIndexes = [];
        }

        if (this.state.assignment) {
          this.state.assignment.unmatchedIndexes =
            this.state.assignment.unmatchedIndexes.filter(
              (value) => !targetIndexes.includes(value)
            );
        }
      }

      if (failures.length > 0) {
        if (!this.state.recipeGeneration) {
          this.state.recipeGeneration = {
            generated: 0,
            recipeIds: [],
            lastProcessedIndexes: [],
            pendingIndexes: failures.map((entry) => entry.index),
            errors: [],
          };
        }
        this.state.recipeGeneration.errors.push(
          ...failures.map((entry) => ({
            timestamp: isoNow(),
            step: `${step}_${entry.index}`,
            message: entry.error,
            detail: null,
          }))
        );
        this.state.recipeGeneration.pendingIndexes = failures.map(
          (entry) => entry.index
        );
      }

      if (generatedRecipeIds.length > 0) {
        // Calculate progress based on total recipes needed
        const totalRecipesNeeded = targetIndexes.length;
        const recipesGeneratedSoFar = generatedRecipeIds.length;
        const progressPercent = 75 + Math.round((recipesGeneratedSoFar / totalRecipesNeeded) * 15);

        this.job = await updateJobProgress(
          serviceClient,
          this.job,
          Math.max(this.job.progress, progressPercent)
        );
      }

      // If we have remaining recipes, trigger next chunk
      if (needsChunking && remainingIndexes.length > 0) {
        logger.info(
          `Chunk completed. Triggering next chunk for ${remainingIndexes.length} remaining recipes`,
          {
            generated_this_chunk: generatedRecipeIds.length,
            remaining: remainingIndexes.length,
            job_id: this.job.id
          },
          "💾"
        );

        // Save remaining indexes and state to job metadata for next run
        // NOTE: We do NOT save response_id here because we're starting a fresh conversation
        // in the next chunk. The Responses API conversation state doesn't persist across
        // our function invocations - chunking happens at the orchestrator level, not within
        // a single OpenAI conversation.
        await appendJobMeta(serviceClient, this.job, {
          pending_recipe_indexes: remainingIndexes,
          recipes_generated_count: (this.state.recipeGeneration?.generated ?? 0) + generatedRecipeIds.length,
          planner_state: this.state,
          chunk_number: (this.job.meta?.chunk_number as number ?? 0) + 1,
        });

        // Trigger next chunk (self-invoke orchestrator)
        await this.triggerNextChunk();

        return {
          status: "success",
          step,
          message: `Generated ${generatedRecipeIds.length} recipes. ${remainingIndexes.length} remaining in next chunk.`,
          data: {
            generated_recipe_ids: generatedRecipeIds,
            failed_indexes: failures,
            has_more_chunks: true,
            remaining_count: remainingIndexes.length,
          },
        };
      }

      return {
        status: failures.length === 0 ? "success" : "error",
        step,
        message:
          failures.length === 0
            ? `Generated recipes for ${generatedRecipeIds.length} items`
            : `Generated ${generatedRecipeIds.length} recipes with ${failures.length} failures`,
        data: {
          generated_recipe_ids: generatedRecipeIds,
          failed_indexes: failures,
          has_more_chunks: false,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.pushFault(step, message, error);
      return {
        status: "error",
        step,
        message,
      };
    }
  }

  private async triggerNextChunk(): Promise<void> {
    // Self-invoke the orchestrator to process the next chunk
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/meal-plan-orchestrator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({
          job_id: this.job.id,
          resume: true,
        }),
      });

      if (!response.ok) {
        logger.error(
          "Failed to trigger next chunk",
          {
            job_id: this.job.id,
            status: response.status,
            response: await response.text()
          },
          "❌"
        );
      } else {
        logger.info(
          "Successfully triggered next chunk",
          { job_id: this.job.id },
          "✅"
        );
      }
    } catch (error) {
      logger.error(
        "Error triggering next chunk",
        {
          job_id: this.job.id,
          error: error instanceof Error ? error.message : String(error)
        },
        "❌"
      );
    }
  }

  private async handleFinalizePlan(args: {
    dry_run?: boolean;
  }): Promise<ToolResult> {
    const step = "finalization";

    if (!this.state.draftId) {
      const message = "Cannot finalize without a draft";
      await this.pushFault(step, message);
      return {
        status: "error",
        step,
        message,
      };
    }

    try {
      const draft = await fetchDraft(this.state.draftId);

      const validation = validateDraftStage(
        draft,
        this.normalized,
        "post_assignment"
      );
      this.state.validations.post_assignment = validation;

      if (!validation.valid) {
        const message = "Post-assignment validation failed; cannot finalize";
        await this.pushFault(step, message, validation.issues);
        return {
          status: "error",
          step,
          message,
          issues: validation.issues,
        };
      }

      const outcome = await finalizeMealPlanInDatabase({
        job: this.job,
        draft,
        normalized: this.normalized,
        dryRun: Boolean(args?.dry_run),
      });

      this.state.finalization = {
        status: outcome.dryRun ? "pending" : "completed",
        mealPlanId: outcome.mealPlanId ?? undefined,
        dryRun: outcome.dryRun,
        completedAt: outcome.dryRun ? undefined : isoNow(),
      };

      if (!outcome.dryRun) {
        this.job = await updateJobProgress(serviceClient, this.job, 100);
      }

      return {
        status: "success",
        step,
        message: outcome.dryRun
          ? "Dry-run finalization completed"
          : `Meal plan finalized (${outcome.mealPlanId})`,
        data: {
          meal_plan_id: outcome.mealPlanId,
          created: outcome.created,
          dry_run: outcome.dryRun,
          item_count: outcome.itemCount,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.pushFault(step, message, error);
      return {
        status: "error",
        step,
        message,
      };
    }
  }
}
const serviceClient = createClient(supabaseUrl, serviceRoleKey);

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  createJsonResponse(body, status);

const extractAccessToken = (req: Request): string => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer", "").trim();
  if (!token) {
    throw new AuthorizationError("Missing bearer token");
  }
  return token;
};

const ensureHouseholdAccess = async (
  client: ReturnType<typeof createClient>,
  userId: string,
  householdId: string
) => {
  const { data, error } = await client
    .from("household_members")
    .select("role, status")
    .eq("user_id", userId)
    .eq("household_id", householdId)
    .maybeSingle();

  if (error) {
    throw new OrchestratorError(
      "Failed to verify household membership",
      500,
      error
    );
  }

  if (!data || data.status !== "active") {
    throw new AuthorizationError("User does not have access to this household");
  }
};

const processJob = async (
  originalJob: AsyncJobRecord,
  normalized: NormalizedMealPlanRequest,
  accessToken: string
) => {
  let job = originalJob;
  normalized.job_id = job.id;

  try {
    job = await markJobProcessing(serviceClient, job);
    logger.info(
      "Planner job moved to processing state",
      { job_id: job.id },
      "??"
    );

    const planner = new PlannerAgent({ job, normalized, accessToken });
    const outcome = await planner.run();
    const plannerJob = planner.getJob();
    const state = planner.getState();

    const finalizationComplete =
      state.finalization?.status === "completed" &&
      state.finalization.mealPlanId;

    if (outcome.status === "success" && finalizationComplete) {
      const resultPayload: Record<string, unknown> = {
        success: true,
        planner_summary: outcome.summary,
        meal_plan_id: state.finalization?.mealPlanId ?? null,
        draft_id: state.draftId ?? null,
        planner_state: state,
      };
      await appendJobMeta(serviceClient, plannerJob, {
        planner_result: resultPayload,
      });
      await markJobCompleted(serviceClient, plannerJob, resultPayload);
      logger.info(
        "Planner job completed successfully",
        { job_id: job.id },
        "??"
      );
      return;
    }

    const failureMessage =
      outcome.status === "failed"
        ? outcome.summary || "Planner finished without finalizing meal plan"
        : "Planner did not finalize the meal plan";

    logger.warn("Planner job completed without finalization", {
      job_id: job.id,
      summary: outcome.summary,
    });

    await markJobFailed(serviceClient, plannerJob, failureMessage, {
      planner_state: state,
      planner_summary: outcome.summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      "Planner orchestrator execution failed",
      { job_id: job.id, message },
      "??"
    );
    await markJobFailed(serviceClient, job, message, {
      planner_error: message,
    });
  }
};

// Helper function to resume a job
const resumeJob = async (jobId: string) => {
  logger.info("Resuming job for next chunk", { job_id: jobId }, "🔁");

  // Fetch the job
  const { data: jobData, error: jobError } = await serviceClient
    .from("async_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !jobData) {
    throw new OrchestratorError("Job not found for resume", 404);
  }

  const job = jobData as AsyncJobRecord;

  // Extract normalized payload from job
  const payload = job.payload as Record<string, unknown>;
  const normalized = await validateAndNormalizePayload(payload, {
    userIdFromToken: job.user_id,
  });

  // Process the job (will pick up from pending_recipe_indexes)
  await processJob(job, normalized.normalized, serviceRoleKey);
};

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  // Parse request body once
  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch (error) {
    throw new ValidationError("Invalid JSON body", error);
  }

  const payloadRecord =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : {};

  // Check if this is a resume request
  if (payloadRecord.resume === true && typeof payloadRecord.job_id === "string") {
    logger.info("Received resume request", { job_id: payloadRecord.job_id }, "🔁");

    try {
      await resumeJob(payloadRecord.job_id);
      return jsonResponse(202, {
        success: true,
        message: "Job resumed successfully",
        job_id: payloadRecord.job_id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to resume job", { job_id: payloadRecord.job_id, error: message }, "❌");
      return createErrorResponse(message, 500);
    }
  }

  logger.info("Received meal plan orchestration request", {}, "??");

  try {
    const accessToken = extractAccessToken(req);

    const { data: sessionUser, error: authError } =
      await serviceClient.auth.getUser(accessToken);
    if (authError || !sessionUser?.user) {
      throw new AuthorizationError("Invalid or expired token", authError);
    }

    const userId = sessionUser.user.id;
    logger.info(
      "Extracted user from JWT",
      {
        user_id: userId,
        user_email: sessionUser.user.email,
      },
      "??"
    );

    logger.info(
      "Request details",
      {
        user_id: userId,
        body_preview: JSON.stringify(rawPayload)?.slice(0, 200),
      },
      "??"
    );

    const providedHouseholdId =
      typeof payloadRecord.household_id === "string"
        ? payloadRecord.household_id
        : typeof payloadRecord.householdId === "string"
          ? payloadRecord.householdId
          : undefined;

    let fallbackHouseholdId: string | undefined;

    if (!providedHouseholdId) {
      const { data, error } = await serviceClient
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(2);

      if (error) {
        throw new OrchestratorError(
          "Unable to resolve household membership",
          500,
          error
        );
      }

      if (!data || data.length === 0) {
        throw new ValidationError("household_id is required");
      }

      if (data.length > 1) {
        throw new ValidationError(
          "Multiple active households found. Pass household_id explicitly to generate a plan."
        );
      }

      fallbackHouseholdId = data[0].household_id as string;
      logger.info(
        "Resolved household_id from membership",
        { household_id: fallbackHouseholdId },
        "??"
      );
    }

    const { normalized, canonicalPayload, payloadSignature } =
      await validateAndNormalizePayload(rawPayload, {
        userIdFromToken: userId,
        fallbackHouseholdId,
      });

    logger.info(
      "Validation passed",
      {
        user_id: normalized.user_id,
        household_id: normalized.household_id,
        start_date: normalized.start_date,
        end_date: normalized.end_date,
        meals_per_day: normalized.meals_per_day,
      },
      "?"
    );

    await ensureHouseholdAccess(
      serviceClient,
      normalized.user_id,
      normalized.household_id
    );

    const existingJob = await findActiveJobBySignature(
      serviceClient,
      normalized.user_id,
      payloadSignature
    );

    if (existingJob) {
      // Check if job has been stuck in processing for too long (5 minutes)
      const STUCK_JOB_TIMEOUT_MS = 5 * 60 * 1000;
      const jobAge = Date.now() - new Date(existingJob.queued_at).getTime();

      if (existingJob.status === 'processing' && jobAge > STUCK_JOB_TIMEOUT_MS) {
        logger.warn(
          "Found stuck job in processing state, marking as failed",
          {
            job_id: existingJob.id,
            age_minutes: Math.round(jobAge / 60000),
          },
          "⚠️"
        );

        await markJobFailed(
          serviceClient,
          existingJob,
          "Job timed out after 5 minutes in processing state",
          { timeout: true, age_ms: jobAge }
        );

        // Continue to create a new job
      } else {
        logger.info(
          "Found active job for payload signature",
          {
            job_id: existingJob.id,
          },
          "??"
        );
        return jsonResponse(200, {
          success: true,
          job_id: existingJob.id,
          status: existingJob.status,
          progress: existingJob.progress,
          message: "Meal plan generation already in progress",
        });
      }
    }

    const job = await createJob(serviceClient, {
      userId: normalized.user_id,
      jobType: "meal_plan_generation",
      payload: canonicalPayload,
      meta: {
        retry_count: 0,
        payload_signature: payloadSignature,
      },
    });

    logger.info(
      "Created async job for planner orchestrator",
      { job_id: job.id },
      "??"
    );

    processJob(job, normalized, accessToken).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Unhandled error in planner background processing", {
        job_id: job.id,
        message,
      });
    });

    return jsonResponse(202, {
      success: true,
      job_id: job.id,
      status: job.status,
      progress: job.progress,
      message: "Meal plan orchestration started",
    });
  } catch (error) {
    if (error instanceof OrchestratorError) {
      logger.error(error.message, { details: error.details }, "?");
      return createErrorResponse(error.message, error.status);
    }

    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("Unexpected orchestrator failure", { message, error });
    return createErrorResponse(message, 500);
  }
});
