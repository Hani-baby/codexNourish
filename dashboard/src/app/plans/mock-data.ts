export type MealPlanStatus = 'current' | 'upcoming' | 'past'
export type MealPlanSource = 'ai' | 'manual'

export interface MealSlot {
  id: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'
  recipeId?: string
  recipeTitle?: string
  notes?: string
}

export interface DaySchedule {
  date: string
  meals: MealSlot[]
}

export interface MealPlan {
  id: string
  title: string
  status: MealPlanStatus
  createdBy: MealPlanSource
  createdAt: string
  startDate: string
  endDate: string
  mealsPerDay: number
  tags?: string[]
  summary?: string
  metrics?: {
    completionRate?: number
    satisfaction?: number
    calorieTarget?: number
  }
  schedule: DaySchedule[]
}

export const mockMealPlans: MealPlan[] = [
  {
    id: 'plan-2024-10-07',
    title: 'Balanced Week Reset',
    status: 'current',
    createdBy: 'ai',
    createdAt: '2024-10-03T12:15:00Z',
    startDate: '2024-10-07',
    endDate: '2024-10-13',
    mealsPerDay: 4,
    tags: ['gluten free', 'low sugar'],
    summary: 'Focus on energising lunches with lighter dinners and two snacks per day.',
    metrics: {
      completionRate: 0.82,
      satisfaction: 0.9,
      calorieTarget: 2100,
    },
    schedule: [
      {
        date: '2024-10-07',
        meals: [
          { id: 'm1', mealType: 'breakfast', recipeId: 'r-chia-berries', recipeTitle: 'Chia Yogurt Parfait' },
          { id: 'm2', mealType: 'snack', recipeTitle: 'Trail Mix with Pumpkin Seeds' },
          { id: 'm3', mealType: 'lunch', recipeId: 'r-quinoa', recipeTitle: 'Citrus Quinoa Bowl' },
          { id: 'm4', mealType: 'dinner', recipeId: 'r-salmon', recipeTitle: 'Maple Glazed Salmon' },
        ],
      },
      {
        date: '2024-10-08',
        meals: [
          { id: 'm5', mealType: 'breakfast', recipeTitle: 'Matcha Overnight Oats' },
          { id: 'm6', mealType: 'snack', recipeTitle: 'Golden Milk Latte' },
          { id: 'm7', mealType: 'lunch', recipeTitle: 'Roasted Veggie Grain Bowl' },
          { id: 'm8', mealType: 'dinner', recipeTitle: 'Lemon Herb Chicken' },
        ],
      },
    ],
  },
  {
    id: 'plan-2024-10-21',
    title: 'Autumn Comfort Week',
    status: 'upcoming',
    createdBy: 'manual',
    createdAt: '2024-09-29T09:00:00Z',
    startDate: '2024-10-21',
    endDate: '2024-10-27',
    mealsPerDay: 3,
    tags: ['family', 'comfort'],
    summary: 'Hearty dishes for cooler evenings, with easy prep lunches.',
    metrics: {
      completionRate: 0.0,
      satisfaction: 0.0,
      calorieTarget: 2400,
    },
    schedule: [
      {
        date: '2024-10-21',
        meals: [
          { id: 'm21', mealType: 'breakfast', recipeTitle: 'Pumpkin Spice Smoothie' },
          { id: 'm22', mealType: 'lunch', recipeTitle: 'Butternut Squash Soup' },
          { id: 'm23', mealType: 'dinner', recipeTitle: 'Turkey Meatballs with Polenta' },
        ],
      },
    ],
  },
  {
    id: 'plan-2024-09-23',
    title: 'Back-to-Routine Week',
    status: 'past',
    createdBy: 'ai',
    createdAt: '2024-09-18T14:30:00Z',
    startDate: '2024-09-23',
    endDate: '2024-09-29',
    mealsPerDay: 5,
    tags: ['high protein'],
    summary: 'High-protein focus with two snack breaks to support workouts.',
    metrics: {
      completionRate: 0.94,
      satisfaction: 0.88,
      calorieTarget: 2250,
    },
    schedule: [
      {
        date: '2024-09-23',
        meals: [
          { id: 'm31', mealType: 'breakfast', recipeTitle: 'Egg White Omelette' },
          { id: 'm32', mealType: 'snack', recipeTitle: 'Greek Yogurt with Honey' },
          { id: 'm33', mealType: 'lunch', recipeTitle: 'Chicken Power Salad' },
          { id: 'm34', mealType: 'snack', recipeTitle: 'Apple + Almond Butter' },
          { id: 'm35', mealType: 'dinner', recipeTitle: 'Seared Tuna with Greens' },
        ],
      },
    ],
  },
]
