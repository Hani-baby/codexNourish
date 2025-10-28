export const MEAL_PLAN_DRAFT_RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "meal_plan_draft_payload",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      // ✅ Include every key from properties; keep optional semantics via null/defaults
      required: ["plan_title", "plan_summary", "daily_totals", "items"],
      properties: {
        plan_title: {
          type: "string",
          minLength: 8,
          description: "Creative, enticing overview title for the full plan.",
        },
        // ✅ Optional by allowing null + default
        plan_summary: {
          type: ["string", "null"],
          default: null,
          description: "Optional short blurb summarizing the plan.",
        },
        // ✅ Optional by allowing null + default; inner items already validated
        daily_totals: {
          type: ["array", "null"],
          default: null,
          description:
            "Optional per-day nutrition totals aligned with household goals.",
          items: {
            type: "object",
            additionalProperties: false,
            // ✅ Must list ALL keys in properties
            required: [
              "date",
              "energy_kcal",
              "protein_g",
              "carbs_g",
              "fat_g",
              "fiber_g",
              "notes",
            ],
            properties: {
              date: { type: "string", format: "date" },
              // ✅ Nullable to remain optional at draft stage
              energy_kcal: { type: ["number", "null"], default: null },
              protein_g:   { type: ["number", "null"], default: null },
              carbs_g:     { type: ["number", "null"], default: null },
              fat_g:       { type: ["number", "null"], default: null },
              fiber_g:     { type: ["number", "null"], default: null },
              notes:       { type: ["string", "null"], default: null },
            },
          },
        },
        items: {
          type: "array",
          minItems: 1,
          description:
            "Ordered meal entries covering every date/slot combination.",
          items: {
            type: "object",
            additionalProperties: false,
            // ✅ Include ALL keys found in properties
            required: [
              "date",
              "meal_type",
              "title",
              "description",
              "servings",
              "tags",
              "notes",
            ],
            properties: {
              date: { type: "string", format: "date" },
              meal_type: {
                type: "string",
                description:
                  "One of the requested slot identifiers (e.g. breakfast).",
              },
              title: {
                type: "string",
                minLength: 4,
                description: "Inventive, non-repetitive title for the meal.",
              },
              description: {
                type: "string",
                minLength: 12,
                description:
                  "Short sensory description tying to nutrition or restrictions.",
              },
              servings: {
                type: "integer",
                minimum: 1,
                maximum: 20,
              },
              // ✅ Required but with a default so model can return []
              tags: {
                type: "array",
                items: { type: "string" },
                default: [],
              },
              // ✅ Required but nullable with a default
              notes: {
                type: ["string", "null"],
                default: null,
              },
            },
          },
        },
      },
    },
  },
} as const;
