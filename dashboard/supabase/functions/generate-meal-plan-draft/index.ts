import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";

import { orchestratorLogger } from "../_shared/logger.ts";
import {
  DraftStatus,
  NormalizedMealPlanRequest,
  ValidationError,
} from "../_shared/types.ts";
import { fetchHouseholdPreferences } from "../_shared/preferences.ts";
import { MEAL_PLAN_DRAFT_RESPONSE_SCHEMA } from "./schema.ts";

const logger = orchestratorLogger.child("Draft Generator");

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
const openAiModel = Deno.env.get("OPENAI_MEAL_PLAN_MODEL") ?? "gpt-4.1-mini";

if (!supabaseUrl || !serviceRoleKey) {
  logger.error("Missing Supabase configuration", {}, "🛑");
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

if (!openAiApiKey) {
  logger.error("OPENAI_API_KEY is not configured", {}, "🛑");
  throw new Error("OPENAI_API_KEY must be set for meal plan generation");
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey);

interface DraftInsertPayload {
  id: string;
  status: DraftStatus;
}

interface AiDraftPayload {
  plan_title: string;
  plan_summary?: string;
  daily_totals?: unknown[];
  items: unknown[];
}

const SYSTEM_PROMPT = [
  "You are Chef Nourish, an expert household meal planner.",
  "Generate balanced, family-friendly meal plans that respect dietary restrictions and preferences.",
  "Output must strictly follow the provided JSON schema. Do not include commentary or additional keys.",
  "Cover every requested date and meal slot combination exactly once.",
  "Favor variety across the week and avoid repeating exact meal titles.",
  "If preferences conflict, note compromises in item notes or plan_summary.",
  "Ensure all meals are realistic and achievable for home cooking.",
  "Use clear, delicious, appealing meal titles Avoid using th date in the title.",
].join("\n");

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const ensureString = (value: unknown, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`);
  }
  return value;
};

const ensureNumber = (value: unknown, field: string) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${field} must be a number`);
  }
  return value;
};

const ensurePreferences = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const deriveSlots = (mealsPerDay: number): string[] => {
  const baseSlots = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "supper",
    "dessert",
  ];
  return baseSlots.slice(0, mealsPerDay);
};

const insertDraft = async (
  payload: NormalizedMealPlanRequest,
  slots: string[]
): Promise<DraftInsertPayload> => {
  const { data, error } = await serviceClient
    .from("meal_plan_drafts")
    .insert({
      job_id: payload.job_id ?? null,
      user_id: payload.user_id,
      household_id: payload.household_id,
      plan_title: payload.plan_title,
      timezone: payload.timezone ?? "UTC",
      scope: payload.scope ?? "weekly",
      start_date: payload.start_date,
      end_date: payload.end_date,
      meals_per_day: payload.meals_per_day,
      slots,
      freeform_prompt: payload.freeform_prompt ?? null,
      status: "generating",
      user_context: {
        use_user_preferences: payload.use_user_preferences,
        session_preferences: payload.session_preferences,
        auto_generate_grocery_list: payload.auto_generate_grocery_list,
        include_pantry_inventory: payload.include_pantry_inventory,
      },
    })
    .select("id, status")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create meal plan draft: ${error?.message ?? "unknown error"}`
    );
  }

  return data as DraftInsertPayload;
};

const updateDraft = async (
  id: string,
  patch: Record<string, unknown>
): Promise<DraftInsertPayload> => {
  const { data, error } = await serviceClient
    .from("meal_plan_drafts")
    .update(patch)
    .eq("id", id)
    .select("id, status")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update meal plan draft ${id}: ${
        error?.message ?? "unknown error"
      }`
    );
  }

  return data as DraftInsertPayload;
};

const callOpenAiDraftGenerator = async (
  normalized: NormalizedMealPlanRequest,
  slots: string[]
) => {
  const householdPreferences = await fetchHouseholdPreferences(
    serviceClient,
    normalized.household_id
  );

  const requestPayload = {
    plan: {
      start_date: normalized.start_date,
      end_date: normalized.end_date,
      meals_per_day: normalized.meals_per_day,
      slots,
      scope: normalized.scope,
      timezone: normalized.timezone,
      title_hint: normalized.plan_title,
      use_saved_preferences: normalized.use_user_preferences,
      auto_generate_grocery_list: normalized.auto_generate_grocery_list,
      include_pantry_inventory: normalized.include_pantry_inventory,
    },
    household_preferences: householdPreferences,
    session_preferences: normalized.session_preferences,
    freeform_prompt: normalized.freeform_prompt,
  };

  logger.info(
    "Calling OpenAI for meal plan draft",
    { household_members: (householdPreferences?.members ?? []).length },
    "🤖"
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      instructions: SYSTEM_PROMPT,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Generate a meal plan draft with the following request payload. " +
                "Return ONLY JSON that adheres to the provided schema.\n\n" +
                JSON.stringify(requestPayload),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: MEAL_PLAN_DRAFT_RESPONSE_SCHEMA.json_schema.name,
          schema: MEAL_PLAN_DRAFT_RESPONSE_SCHEMA.json_schema.schema,
        },
      },
      max_output_tokens: 2048,
    }),
  });

  const responseBody = await response.json();

  if (!response.ok) {
    const message =
      typeof responseBody.error?.message === "string"
        ? responseBody.error.message
        : `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Parse the structured output from Responses API
  // The API returns an `output` array with message items containing content parts
  let aiJson: AiDraftPayload | null = null;

  // Check if there's a direct output array
  const output = Array.isArray(responseBody.output)
    ? responseBody.output
    : [];

  // Look for message items with output_text content
  for (const item of output) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === "output_text" && typeof part.text === "string") {
          try {
            aiJson = JSON.parse(part.text) as AiDraftPayload;
            logger.info(
              "Parsed meal plan from output_text",
              { item_count: aiJson?.items?.length ?? 0 },
              "✅"
            );
            break;
          } catch (parseError) {
            logger.error(
              "Failed to parse output_text as JSON",
              { 
                error: parseError instanceof Error ? parseError.message : String(parseError),
                text_preview: part.text.slice(0, 200)
              },
              "⚠️"
            );
          }
        }
      }
      if (aiJson) break;
    }
  }

  if (!aiJson) {
    throw new Error(
      "OpenAI response did not include structured meal plan data"
    );
  }

  if (
    !aiJson.plan_title ||
    !Array.isArray(aiJson.items) ||
    aiJson.items.length === 0
  ) {
    throw new Error("OpenAI returned an invalid meal plan payload");
  }

  return {
    payload: aiJson,
    raw: responseBody,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch (error) {
    return jsonResponse(400, {
      success: false,
      error: "Invalid JSON body",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const normalized: NormalizedMealPlanRequest = {
    job_id:
      payload.job_id && typeof payload.job_id === "string"
        ? payload.job_id
        : undefined,
    user_id: ensureString(payload.user_id, "user_id"),
    household_id: ensureString(payload.household_id, "household_id"),
    plan_title: ensureString(payload.plan_title, "plan_title"),
    timezone: typeof payload.timezone === "string" ? payload.timezone : "UTC",
    scope:
      payload.scope === "daily" ||
      payload.scope === "weekly" ||
      payload.scope === "monthly"
        ? payload.scope
        : "weekly",
    start_date: ensureString(payload.start_date, "start_date"),
    end_date: ensureString(payload.end_date, "end_date"),
    meals_per_day: ensureNumber(payload.meals_per_day, "meals_per_day"),
    use_user_preferences:
      typeof payload.use_user_preferences === "boolean"
        ? payload.use_user_preferences
        : true,
    session_preferences: ensurePreferences(payload.session_preferences),
    freeform_prompt:
      typeof payload.freeform_prompt === "string"
        ? payload.freeform_prompt
        : null,
    auto_generate_grocery_list:
      typeof payload.auto_generate_grocery_list === "boolean"
        ? payload.auto_generate_grocery_list
        : true,
    include_pantry_inventory:
      typeof payload.include_pantry_inventory === "boolean"
        ? payload.include_pantry_inventory
        : true,
  };

  if (normalized.meals_per_day < 1 || normalized.meals_per_day > 6) {
    throw new ValidationError("meals_per_day must be between 1 and 6");
  }

  logger.info(
    "Received draft generation request",
    {
      job_id: normalized.job_id ?? "n/a",
      user_id: normalized.user_id,
      household_id: normalized.household_id,
    },
    "🧠"
  );

  const slots = deriveSlots(normalized.meals_per_day);
  let draftRow: DraftInsertPayload | null = null;

  try {
    draftRow = await insertDraft(normalized, slots);
    logger.info("Draft record created", { draft_id: draftRow.id }, "📝");

    const aiResult = await callOpenAiDraftGenerator(normalized, slots);

    const updatedDraft = await updateDraft(draftRow.id, {
      status: "completed",
      plan_title: aiResult.payload.plan_title,
      items: aiResult.payload.items,
      daily_totals: Array.isArray(aiResult.payload.daily_totals)
        ? aiResult.payload.daily_totals
        : [],
      raw_ai_response: JSON.stringify(aiResult.raw),
      progress_message: aiResult.payload.plan_summary ?? "Meal plan generated",
      completed_at: new Date().toISOString(),
    });

    logger.info(
      "Draft generation completed",
      { draft_id: updatedDraft.id },
      "✨"
    );

    return jsonResponse(200, {
      success: true,
      draft_id: updatedDraft.id,
      status: updatedDraft.status,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate meal plan draft";
    logger.error(
      "Draft generation failed",
      { message, draft_id: draftRow?.id },
      "💥"
    );

    if (draftRow) {
      try {
        await updateDraft(draftRow.id, {
          status: "failed",
          error_message: message,
          raw_ai_response: JSON.stringify({
            error: message,
          }),
        });
      } catch (updateError) {
        logger.error(
          "Failed to persist draft failure state",
          {
            draft_id: draftRow.id,
            error:
              updateError instanceof Error
                ? updateError.message
                : String(updateError),
          },
          "🔥"
        );
      }
    }

    const status = error instanceof ValidationError ? error.status : 502;
    return jsonResponse(status, { success: false, error: message });
  }
});
