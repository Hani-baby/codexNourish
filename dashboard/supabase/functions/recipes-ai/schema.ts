export const RECIPE_GENERATION_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "recipe_payload_v3",
    strict: true,
    schema: {
      title: "RecipePayload",
      type: "object",
      additionalProperties: false,
      required: ["recipe"],
      properties: {
        recipe: {
          type: "object",
          additionalProperties: false,
          // Every key listed in properties must be listed here (validator rule)
          required: [
            "title",
            "slug",
            "summary",
            "instructions",
            "image_url",
            "source_url",
            "prep_min",
            "cook_min",
            "servings",
            "dietary_tags",
            "cuisine",
            "is_public",
            "tags",
            "ingredients",
            "nutrition",
            "steps",
            "nutrition_per_serving",
            "serving_notes",
            "allergens",
          ],
          properties: {
            title: { type: "string", minLength: 3, maxLength: 160 },
            slug: {
              type: "string",
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              minLength: 3,
              maxLength: 180,
            },
            summary: { type: ["string", "null"], maxLength: 1000 },
            instructions: { type: ["string", "null"] },
            image_url: { type: ["string", "null"] },
            source_url: { type: ["string", "null"] },
            prep_min: { type: ["integer", "null"], minimum: 0 },
            cook_min: { type: ["integer", "null"], minimum: 0 },
            servings: { type: "number", exclusiveMinimum: 0 },
            dietary_tags: {
              type: ["array", "null"],
              items: { type: "string", minLength: 1 },
            },
            cuisine: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                minLength: 1,
                maxLength: 120,
              },
            },
            is_public: { type: ["boolean", "null"] },
            tags: {
              type: ["array", "null"],
              items: { type: "string", minLength: 1, maxLength: 60 },
            },

            ingredients: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "ingredient_name",
                  "quantity",
                  "unit_name",
                  "preparation",
                  "notes",
                  "order_index",
                  "normalized_qty_g",
                  "normalized_qty_ml",
                ],
                properties: {
                  // NO ids in generation schema:
                  ingredient_name: { type: ["string", "null"], minLength: 1 },
                  quantity: { type: ["number", "null"], exclusiveMinimum: 0 },
                  unit_name: { type: ["string", "null"], minLength: 1 }, // e.g., "clove","can","tbsp"
                  preparation: { type: ["string", "null"], maxLength: 200 },
                  notes: { type: ["string", "null"], maxLength: 400 },
                  order_index: { type: ["integer", "null"], minimum: 0 },
                  normalized_qty_g: { type: ["number", "null"], minimum: 0 },
                  normalized_qty_ml: { type: ["number", "null"], minimum: 0 },
                },
              },
            },

            nutrition: {
              type: ["object", "null"],
              additionalProperties: false,
              required: [
                "calories_kcal",
                "protein_g",
                "carbs_g",
                "fat_g",
                "fiber_g",
                "sugar_g",
                "sodium_mg",
              ],
              properties: {
                calories_kcal: { type: ["integer", "null"], minimum: 0 },
                protein_g: { type: ["number", "null"], minimum: 0 },
                carbs_g: { type: ["number", "null"], minimum: 0 },
                fat_g: { type: ["number", "null"], minimum: 0 },
                fiber_g: { type: ["number", "null"], minimum: 0 },
                sugar_g: { type: ["number", "null"], minimum: 0 },
                sodium_mg: { type: ["integer", "null"], minimum: 0 },
              },
            },

            steps: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["step_number", "instruction", "label"],
                properties: {
                  // NO step id in generation schema:
                  step_number: { type: ["integer", "null"], minimum: 1 },
                  instruction: { type: ["string", "null"], minLength: 3 },
                  label: { type: ["string", "null"], maxLength: 120 },
                },
              },
            },

            nutrition_per_serving: {
              type: ["object", "null"],
              additionalProperties: false,
              required: [
                "calories_kcal",
                "protein_g",
                "carbs_g",
                "fat_g",
                "fiber_g",
                "sugar_g",
                "sodium_mg",
              ],
              properties: {
                calories_kcal: { type: ["integer", "null"], minimum: 0 },
                protein_g: { type: ["number", "null"], minimum: 0 },
                carbs_g: { type: ["number", "null"], minimum: 0 },
                fat_g: { type: ["number", "null"], minimum: 0 },
                fiber_g: { type: ["number", "null"], minimum: 0 },
                sugar_g: { type: ["number", "null"], minimum: 0 },
                sodium_mg: { type: ["integer", "null"], minimum: 0 },
              },
            },

            serving_notes: {
              type: ["array", "null"],
              items: { type: "string", minLength: 1 },
            },
            allergens: {
              type: ["array", "null"],
              items: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
  },
} as const;
