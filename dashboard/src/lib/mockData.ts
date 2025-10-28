/*
 * Data Layer for Chef Nourish Chat
 * 
 * UPDATED: Replaced mock data with real Supabase integration
 * - Real-time conversations and messages from database
 * - Proper authentication and user isolation
 * - Backend API integration
 * - Local data management
 */

import { supabase } from './supabase'

// Types matching database schema
interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: string
  actions?: Array<{
    id: string
    label: string
    variant: 'brand' | 'ghost'
  }>
}

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  pinned: boolean
  unread: boolean
  messages?: Message[]
}

// Keep legacy mock data for other parts of dashboard
export const mockUser = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  email: 'sarah@example.com',
  avatar: null
}

export const mockStats = {
  dailyCalories: {
    current: 1847,
    target: 2200,
    percentage: 84,
    delta: 12
  },
  protein: {
    current: 89,
    target: 120,
    percentage: 74,
    delta: 8
  },
  carbs: {
    current: 178,
    target: 220,
    percentage: 81,
    delta: 5
  },
  fat: {
    current: 62,
    target: 75,
    percentage: 83,
    delta: 15
  },
  fiber: {
    current: 28,
    target: 35,
    percentage: 80,
    delta: 12
  },
  water: {
    current: 6,
    target: 8,
    percentage: 75,
    delta: 2
  },
  mealsPlanned: {
    current: 18,
    target: 21,
    percentage: 86,
    delta: 5
  },
  recipesSaved: {
    current: 47,
    delta: 8
  },
  groceryItems: {
    current: 23,
    delta: -3
  },
  weeklyStreak: {
    current: 12,
    delta: 3
  },
  exerciseMinutes: {
    current: 135,
    target: 150,
    percentage: 90,
    delta: 25
  }
}

export const mockTodaysMeals = [
  {
    id: '1',
    type: 'Breakfast',
    name: 'Overnight oats with berries',
    calories: 340,
    time: '8:00 AM',
    protein: 12,
    carbs: 58,
    fat: 8,
    status: 'completed'
  },
  {
    id: '2',
    type: 'Lunch',
    name: 'Mediterranean quinoa bowl',
    calories: 520,
    time: '12:30 PM',
    protein: 18,
    carbs: 65,
    fat: 22,
    status: 'completed'
  },
  {
    id: '3',
    type: 'Dinner',
    name: 'Grilled salmon with vegetables',
    calories: 680,
    time: '7:00 PM',
    protein: 45,
    carbs: 35,
    fat: 28,
    status: 'planned'
  },
  {
    id: '4',
    type: 'Snack',
    name: 'Greek yogurt with almonds',
    calories: 180,
    time: '3:00 PM',
    protein: 14,
    carbs: 20,
    fat: 4,
    status: 'completed'
  }
]

// Enhanced activity data for dashboard
export const mockRecentActivities = [
  {
    id: '1',
    type: 'meal_logged',
    title: 'Logged breakfast',
    description: 'Overnight oats with berries - 340 cal',
    timestamp: '2 hours ago',
    icon: '🥣'
  },
  {
    id: '2',
    type: 'recipe_saved',
    title: 'Saved new recipe',
    description: 'Thai Green Curry',
    timestamp: '4 hours ago',
    icon: '⭐'
  },
  {
    id: '3',
    type: 'goal_reached',
    title: 'Daily protein goal reached!',
    description: '89g / 120g protein consumed',
    timestamp: '1 day ago',
    icon: '🎯'
  },
  {
    id: '4',
    type: 'workout_logged',
    title: 'Completed workout',
    description: '45 min strength training',
    timestamp: '1 day ago',
    icon: '💪'
  }
]

// Weekly progress data
export const mockWeeklyProgress = [
  { day: 'Mon', calories: 2180, target: 2200 },
  { day: 'Tue', calories: 2050, target: 2200 },
  { day: 'Wed', calories: 2290, target: 2200 },
  { day: 'Thu', calories: 2150, target: 2200 },
  { day: 'Fri', calories: 1950, target: 2200 },
  { day: 'Sat', calories: 2380, target: 2200 },
  { day: 'Sun', calories: 1847, target: 2200 }
]

export const mockRecipes = [
  {
    id: '1',
    title: 'Mediterranean Quinoa Bowl',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
    difficulty: 'Easy',
    time: 25,
    portions: 4,
    rating: 4.8,
    reviews: 124,
    chef: 'Chef Maria',
    verified: true,
    saved: true
  },
  {
    id: '2',
    title: 'Grilled Salmon with Asparagus',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop',
    difficulty: 'Medium',
    time: 35,
    portions: 2,
    rating: 4.9,
    reviews: 89,
    chef: 'Chef David',
    verified: true,
    saved: false
  },
  {
    id: '3',
    title: 'Overnight Oats with Berries',
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop',
    difficulty: 'Easy',
    time: 10,
    portions: 1,
    rating: 4.6,
    reviews: 203,
    chef: 'Chef Anna',
    verified: false,
    saved: true
  },
  {
    id: '4',
    title: 'Thai Green Curry',
    image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400&h=300&fit=crop',
    difficulty: 'Hard',
    time: 45,
    portions: 4,
    rating: 4.7,
    reviews: 156,
    chef: 'Chef Tom',
    verified: true,
    saved: false
  },
  {
    id: '5',
    title: 'Avocado Toast Supreme',
    image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400&h=300&fit=crop',
    difficulty: 'Easy',
    time: 15,
    portions: 2,
    rating: 4.5,
    reviews: 67,
    chef: 'Chef Lisa',
    verified: false,
    saved: true
  },
  {
    id: '6',
    title: 'Chicken Stir Fry',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop',
    difficulty: 'Medium',
    time: 30,
    portions: 3,
    rating: 4.4,
    reviews: 91,
    chef: 'Chef Mike',
    verified: true,
    saved: false
  }
]

export const mockGroceryList = [
  {
    id: '1',
    name: 'Organic Spinach',
    category: 'Produce',
    quantity: 2,
    unit: 'bunches',
    price: 4.98,
    checked: false,
    inStock: true
  },
  {
    id: '2',
    name: 'Salmon Fillets',
    category: 'Protein',
    quantity: 1,
    unit: 'lb',
    price: 12.99,
    checked: false,
    inStock: true
  },
  {
    id: '3',
    name: 'Quinoa',
    category: 'Pantry',
    quantity: 1,
    unit: 'bag',
    price: 6.49,
    checked: true,
    inStock: true
  },
  {
    id: '4',
    name: 'Greek Yogurt',
    category: 'Dairy',
    quantity: 2,
    unit: 'containers',
    price: 8.98,
    checked: false,
    inStock: false
  },
  {
    id: '5',
    name: 'Blueberries',
    category: 'Produce',
    quantity: 1,
    unit: 'pint',
    price: 3.99,
    checked: false,
    inStock: true
  },
  {
    id: '6',
    name: 'Olive Oil',
    category: 'Pantry',
    quantity: 1,
    unit: 'bottle',
    price: 9.99,
    checked: true,
    inStock: true
  },
  {
    id: '7',
    name: 'Almonds',
    category: 'Pantry',
    quantity: 1,
    unit: 'bag',
    price: 7.49,
    checked: false,
    inStock: true
  },
  {
    id: '8',
    name: 'Bell Peppers',
    category: 'Produce',
    quantity: 3,
    unit: 'pieces',
    price: 4.47,
    checked: false,
    inStock: true
  }
]

export const mockChatThreads = [
  {
    id: '1',
    title: 'Weekly Meal Planning',
    lastMessage: 'I\'ve created a balanced meal plan for your week with 3 new recipes to try!',
    timestamp: '2 hours ago',
    pinned: true,
    unread: false,
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'Can you help me plan meals for this week? I want to focus on high protein and vegetables.',
        timestamp: '2025-12-16T10:00:00Z'
      },
      {
        id: '2',
        type: 'assistant',
        content: 'I\'d be happy to help you create a high-protein, veggie-rich meal plan! Let me suggest some balanced options for your week.',
        timestamp: '2025-12-16T10:01:00Z'
      },
      {
        id: '3',
        type: 'assistant',
        content: 'I\'ve created a balanced meal plan for your week with 3 new recipes to try! Here\'s what I recommend:\n\n**Monday**: Grilled salmon with roasted vegetables\n**Tuesday**: Chicken and quinoa power bowl\n**Wednesday**: Lentil and spinach curry\n\nWould you like me to add these to your meal plan?',
        timestamp: '2025-12-16T10:02:00Z',
        actions: [
          { id: 'add-plan', label: 'Add all to plan', variant: 'brand' },
          { id: 'grocery-list', label: 'Generate grocery list', variant: 'ghost' },
          { id: 'show-macros', label: 'Show macros', variant: 'ghost' }
        ]
      },
      {
        id: '4',
        type: 'user',
        content: 'hi',
        timestamp: '2025-12-16T06:38:00Z'
      },
      {
        id: '5',
        type: 'user',
        content: 'Vegetarian dinners',
        timestamp: '2025-12-16T06:38:00Z'
      },
      {
        id: '6',
        type: 'user',
        content: 'Vegetarian dinners',
        timestamp: '2025-12-16T06:38:00Z'
      }
    ]
  },
  {
    id: '2',
    title: 'Recipe Modifications',
    lastMessage: 'Here are 3 ways to make that pasta dish dairy-free while keeping it delicious!',
    timestamp: '1 day ago',
    pinned: false,
    unread: true,
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'I love the creamy pasta recipe you suggested, but I need to make it dairy-free. Any ideas?',
        timestamp: '2025-12-15T15:30:00Z'
      },
      {
        id: '2',
        type: 'assistant',
        content: 'Absolutely! Here are 3 ways to make that pasta dish dairy-free while keeping it delicious:\n\n1. **Cashew cream**: Blend soaked cashews with nutritional yeast\n2. **Coconut milk**: Use full-fat coconut milk for richness\n3. **Silken tofu**: Creates a surprisingly creamy texture\n\nWhich option sounds most appealing to you?',
        timestamp: '2025-12-15T15:31:00Z',
        actions: [
          { id: 'cashew-recipe', label: 'Show cashew recipe', variant: 'brand' },
          { id: 'coconut-recipe', label: 'Show coconut recipe', variant: 'ghost' },
          { id: 'tofu-recipe', label: 'Show tofu recipe', variant: 'ghost' }
        ]
      }
    ]
  },
  {
    id: '3',
    title: 'Nutrition Questions',
    lastMessage: 'Great question! Let me break down the protein content for you.',
    timestamp: '3 days ago',
    pinned: false,
    unread: false,
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'How much protein should I aim for daily? I\'m trying to build muscle.',
        timestamp: '2025-12-13T14:20:00Z'
      },
      {
        id: '2',
        type: 'assistant',
        content: 'Great question! For muscle building, aim for 1.6-2.2g of protein per kg of body weight daily. For a 70kg person, that\'s 112-154g protein.\n\n**High-protein foods to include:**\n- Chicken breast: 31g per 100g\n- Greek yogurt: 10g per 100g\n- Eggs: 13g per 2 eggs\n- Quinoa: 4g per 100g cooked\n\nWould you like me to create a high-protein meal plan?',
        timestamp: '2025-12-13T14:21:00Z',
        actions: [
          { id: 'protein-plan', label: 'Create protein plan', variant: 'brand' },
          { id: 'protein-foods', label: 'More protein foods', variant: 'ghost' }
        ]
      }
    ]
  },
  {
    id: '4',
    title: 'Quick Meal Ideas',
    lastMessage: 'Here are some 15-minute meal ideas that are both nutritious and delicious!',
    timestamp: '4 days ago',
    pinned: false,
    unread: false,
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'I need quick meal ideas for busy weeknights. What can I make in 15 minutes or less?',
        timestamp: '2025-12-12T18:45:00Z'
      },
      {
        id: '2',
        type: 'assistant',
        content: 'Here are some 15-minute meal ideas that are both nutritious and delicious!\n\n**Quick Options:**\n- Avocado toast with poached eggs\n- Greek yogurt bowl with berries and nuts\n- Stir-fried vegetables with pre-cooked rice\n- Hummus and veggie wrap\n- Smoothie bowl with protein powder\n\nWhich of these sounds appealing? I can provide detailed recipes!',
        timestamp: '2025-12-12T18:46:00Z',
        actions: [
          { id: 'avocado-recipe', label: 'Avocado toast recipe', variant: 'brand' },
          { id: 'smoothie-recipe', label: 'Smoothie bowl recipe', variant: 'ghost' },
          { id: 'stir-fry-recipe', label: 'Stir-fry recipe', variant: 'ghost' }
        ]
      }
    ]
  },
  {
    id: '5',
    title: 'Dietary Restrictions',
    lastMessage: 'I\'ve found some great gluten-free alternatives that will work perfectly!',
    timestamp: '5 days ago',
    pinned: false,
    unread: false,
    messages: [
      {
        id: '1',
        type: 'user',
        content: 'I recently found out I\'m gluten intolerant. Can you suggest some alternatives to my favorite foods?',
        timestamp: '2025-12-11T12:15:00Z'
      },
      {
        id: '2',
        type: 'assistant',
        content: 'I\'ve found some great gluten-free alternatives that will work perfectly!\n\n**Gluten-Free Alternatives:**\n- Pasta: Try chickpea pasta or rice noodles\n- Bread: Look for almond flour or coconut flour bread\n- Flour: Use almond flour, coconut flour, or gluten-free all-purpose flour\n- Oats: Make sure they\'re certified gluten-free\n\nWould you like me to create a gluten-free meal plan for you?',
        timestamp: '2025-12-11T12:16:00Z',
        actions: [
          { id: 'gluten-free-plan', label: 'Create meal plan', variant: 'brand' },
          { id: 'gluten-free-recipes', label: 'Show recipes', variant: 'ghost' }
        ]
      }
    ]
  }
]
// Mock conversation functions removed - now using real chat-service.ts with Edge Functions

// Helper function to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString()
}


// ... existing code ...

export const mockSuggestedMeals = [
  {
    id: 's1',
    name: 'Protein Power Bowl',
    calories: 420,
    time: '15 min',
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop',
    tags: ['High Protein', 'Quick']
  },
  {
    id: 's2',
    name: 'Avocado Toast Deluxe',
    calories: 280,
    time: '10 min',
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=200&h=150&fit=crop',
    tags: ['Vegetarian', 'Breakfast']
  },
  {
    id: 's3',
    name: 'Mediterranean Salad',
    calories: 350,
    time: '20 min',
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop',
    tags: ['Fresh', 'Healthy']
  },
  {
    id: 's4',
    name: 'Chicken Stir Fry',
    calories: 480,
    time: '25 min',
    difficulty: 'Medium',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop',
    tags: ['Asian', 'Protein']
  }
]

// Enhanced Mock Meal Plans Data with Multiple Plans
export const mockMealPlans = {
  current: {
    id: 'current-1',
    title: 'Golden Harvest Week',
    dateRange: { start: '2024-12-16', end: '2024-12-22' },
    status: 'active',
    totalMeals: 18,
    totalCalories: 12450,
    avgCaloriesPerDay: 1778,
    macros: { protein: 28, carbs: 45, fat: 27 },
    tags: ['High Protein', 'Mediterranean', 'Balanced'],
    createdAt: '2024-12-13T10:00:00Z',
    days: [
      {
        date: '2024-12-16',
        dayName: 'Monday',
        meals: [
          { id: '1', type: 'Breakfast', name: 'Overnight Oats with Berries', calories: 340, time: '8:00', protein: 12, carbs: 58, fat: 8, image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=150&fit=crop' },
          { id: '2', type: 'Snack', name: 'Apple with Almond Butter', calories: 190, time: '10:30', protein: 6, carbs: 20, fat: 12, image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200&h=150&fit=crop' },
          { id: '3', type: 'Lunch', name: 'Mediterranean Quinoa Bowl', calories: 520, time: '12:30', protein: 18, carbs: 65, fat: 22, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
          { id: '4', type: 'Snack', name: 'Greek Yogurt with Honey', calories: 150, time: '15:30', protein: 15, carbs: 12, fat: 4, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
          { id: '5', type: 'Dinner', name: 'Grilled Salmon with Vegetables', calories: 680, time: '19:00', protein: 45, carbs: 35, fat: 28, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
        ]
      },
      {
        date: '2024-12-17',
        dayName: 'Tuesday',
        meals: [
          { id: '7', type: 'Breakfast', name: 'Greek Yogurt Parfait', calories: 280, time: '8:00', protein: 20, carbs: 35, fat: 8, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
          { id: '8', type: 'Lunch', name: 'Chicken Caesar Salad', calories: 450, time: '12:30', protein: 35, carbs: 15, fat: 28, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
          { id: '9', type: 'Dinner', name: 'Vegetable Stir Fry with Tofu', calories: 420, time: '19:00', protein: 22, carbs: 45, fat: 18, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
        ]
      },
      {
        date: '2024-12-18',
        dayName: 'Wednesday',
        meals: [
          { id: '10', type: 'Breakfast', name: 'Avocado Toast Supreme', calories: 320, time: '8:00', protein: 12, carbs: 30, fat: 20, image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=200&h=150&fit=crop' },
          { id: '11', type: 'Lunch', name: 'Lentil Power Soup', calories: 380, time: '12:30', protein: 18, carbs: 55, fat: 8, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=150&fit=crop' },
          { id: '12', type: 'Dinner', name: 'Herb-Crusted Chicken Thighs', calories: 550, time: '19:00', protein: 40, carbs: 25, fat: 32, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
        ]
      },
      {
        date: '2024-12-19',
        dayName: 'Thursday',
        meals: [
          { id: '13', type: 'Breakfast', name: 'Tropical Smoothie Bowl', calories: 350, time: '8:00', protein: 15, carbs: 45, fat: 12, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
          { id: '14', type: 'Lunch', name: 'Turkey & Avocado Wrap', calories: 480, time: '12:30', protein: 28, carbs: 40, fat: 22, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
          { id: '15', type: 'Dinner', name: 'Thai Green Curry', calories: 590, time: '19:00', protein: 25, carbs: 55, fat: 28, image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=200&h=150&fit=crop' }
        ]
      },
      {
        date: '2024-12-20',
        dayName: 'Friday',
        meals: [
          { id: '16', type: 'Breakfast', name: 'Eggs Benedict', calories: 420, time: '8:00', protein: 22, carbs: 25, fat: 28, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
          { id: '17', type: 'Lunch', name: 'Buddha Bowl Deluxe', calories: 520, time: '12:30', protein: 20, carbs: 65, fat: 18, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
          { id: '18', type: 'Dinner', name: 'Asian Beef Stir Fry', calories: 650, time: '19:00', protein: 42, carbs: 35, fat: 35, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
        ]
      },
      {
        date: '2024-12-21',
        dayName: 'Saturday',
        meals: [
          { id: '19', type: 'Breakfast', name: 'Weekend Pancakes with Berries', calories: 380, time: '9:00', protein: 12, carbs: 60, fat: 12, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
          { id: '20', type: 'Lunch', name: 'Grilled Chicken Garden Salad', calories: 460, time: '13:00', protein: 38, carbs: 20, fat: 24, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
          { id: '21', type: 'Dinner', name: 'Pasta Primavera', calories: 580, time: '19:30', protein: 20, carbs: 75, fat: 22, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' }
        ]
      },
      {
        date: '2024-12-22',
        dayName: 'Sunday',
        meals: [
          { id: '22', type: 'Breakfast', name: 'Sunday French Toast', calories: 450, time: '9:30', protein: 15, carbs: 55, fat: 18, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
          { id: '23', type: 'Lunch', name: 'Fresh Fish Tacos', calories: 520, time: '13:30', protein: 30, carbs: 45, fat: 25, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
          { id: '24', type: 'Dinner', name: 'Sunday Roast Chicken Dinner', calories: 720, time: '18:00', protein: 48, carbs: 40, fat: 35, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
        ]
      }
    ]
  },
  upcoming: [
    {
      id: 'upcoming-1',
      title: 'Spring Fresh Week',
      dateRange: { start: '2024-12-23', end: '2024-12-29' },
      status: 'scheduled',
      totalMeals: 21,
      totalCalories: 13200,
      avgCaloriesPerDay: 1885,
      macros: { protein: 25, carbs: 50, fat: 25 },
      tags: ['Vegetarian', 'Fresh', 'Light'],
      createdAt: '2024-12-14T14:30:00Z',
      days: [
        {
          date: '2024-12-23',
          dayName: 'Monday',
          meals: [
            { id: 'u1', type: 'Breakfast', name: 'Green Smoothie Bowl', calories: 320, time: '8:00', protein: 15, carbs: 45, fat: 12, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'u2', type: 'Lunch', name: 'Mediterranean Veggie Wrap', calories: 450, time: '12:30', protein: 18, carbs: 55, fat: 20, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'u3', type: 'Dinner', name: 'Quinoa Buddha Bowl', calories: 520, time: '19:00', protein: 22, carbs: 65, fat: 18, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-12-24',
          dayName: 'Tuesday',
          meals: [
            { id: 'u4', type: 'Breakfast', name: 'Avocado Toast with Sprouts', calories: 380, time: '8:00', protein: 12, carbs: 35, fat: 22, image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=200&h=150&fit=crop' },
            { id: 'u5', type: 'Lunch', name: 'Fresh Spring Salad', calories: 420, time: '12:30', protein: 16, carbs: 40, fat: 25, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'u6', type: 'Dinner', name: 'Lentil Curry with Rice', calories: 580, time: '19:00', protein: 25, carbs: 70, fat: 15, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-12-25',
          dayName: 'Wednesday',
          meals: [
            { id: 'u7', type: 'Breakfast', name: 'Chia Pudding Parfait', calories: 350, time: '8:00', protein: 18, carbs: 40, fat: 15, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
            { id: 'u8', type: 'Lunch', name: 'Veggie Power Bowl', calories: 480, time: '12:30', protein: 20, carbs: 60, fat: 18, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'u9', type: 'Dinner', name: 'Stuffed Bell Peppers', calories: 450, time: '19:00', protein: 24, carbs: 45, fat: 20, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-12-26',
          dayName: 'Thursday',
          meals: [
            { id: 'u10', type: 'Breakfast', name: 'Tropical Fruit Bowl', calories: 300, time: '8:00', protein: 8, carbs: 65, fat: 8, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'u11', type: 'Lunch', name: 'Green Goddess Salad', calories: 420, time: '12:30', protein: 15, carbs: 35, fat: 28, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'u12', type: 'Dinner', name: 'Vegetable Stir Fry', calories: 380, time: '19:00', protein: 18, carbs: 50, fat: 12, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-12-27',
          dayName: 'Friday',
          meals: [
            { id: 'u13', type: 'Breakfast', name: 'Overnight Oats with Berries', calories: 340, time: '8:00', protein: 12, carbs: 58, fat: 8, image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=150&fit=crop' },
            { id: 'u14', type: 'Lunch', name: 'Hummus Veggie Wrap', calories: 460, time: '12:30', protein: 16, carbs: 55, fat: 22, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'u15', type: 'Dinner', name: 'Mushroom Risotto', calories: 520, time: '19:00', protein: 14, carbs: 75, fat: 18, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-12-28',
          dayName: 'Saturday',
          meals: [
            { id: 'u16', type: 'Breakfast', name: 'Acai Bowl Deluxe', calories: 420, time: '9:00', protein: 15, carbs: 70, fat: 12, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'u17', type: 'Lunch', name: 'Garden Fresh Salad', calories: 380, time: '13:00', protein: 12, carbs: 30, fat: 25, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'u18', type: 'Dinner', name: 'Vegetable Pasta Primavera', calories: 480, time: '19:30', protein: 18, carbs: 80, fat: 15, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-12-29',
          dayName: 'Sunday',
          meals: [
            { id: 'u19', type: 'Breakfast', name: 'Green Smoothie', calories: 280, time: '9:30', protein: 10, carbs: 45, fat: 8, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'u20', type: 'Lunch', name: 'Veggie Buddha Bowl', calories: 520, time: '13:30', protein: 22, carbs: 65, fat: 20, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'u21', type: 'Dinner', name: 'Stuffed Zucchini Boats', calories: 450, time: '18:00', protein: 20, carbs: 40, fat: 25, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
          ]
        }
      ]
    },
    {
      id: 'upcoming-2',
      title: 'Protein Power Week',
      dateRange: { start: '2025-01-06', end: '2025-01-12' },
      status: 'scheduled',
      totalMeals: 21,
      totalCalories: 14500,
      avgCaloriesPerDay: 2071,
      macros: { protein: 35, carbs: 35, fat: 30 },
      tags: ['High Protein', 'Muscle Building', 'Performance'],
      createdAt: '2024-12-15T09:15:00Z',
      days: [
        {
          date: '2025-01-06',
          dayName: 'Monday',
          meals: [
            { id: 'p1', type: 'Breakfast', name: 'Protein Pancakes', calories: 450, time: '8:00', protein: 35, carbs: 40, fat: 15, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'p2', type: 'Lunch', name: 'Grilled Chicken Power Bowl', calories: 580, time: '12:30', protein: 45, carbs: 35, fat: 25, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'p3', type: 'Dinner', name: 'Beef Stir Fry', calories: 650, time: '19:00', protein: 50, carbs: 30, fat: 35, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2025-01-07',
          dayName: 'Tuesday',
          meals: [
            { id: 'p4', type: 'Breakfast', name: 'Eggs Benedict', calories: 520, time: '8:00', protein: 30, carbs: 25, fat: 35, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'p5', type: 'Lunch', name: 'Salmon Power Salad', calories: 480, time: '12:30', protein: 40, carbs: 20, fat: 30, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'p6', type: 'Dinner', name: 'Turkey Meatballs with Pasta', calories: 620, time: '19:00', protein: 45, carbs: 50, fat: 25, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2025-01-08',
          dayName: 'Wednesday',
          meals: [
            { id: 'p7', type: 'Breakfast', name: 'Greek Yogurt Parfait', calories: 380, time: '8:00', protein: 25, carbs: 35, fat: 15, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
            { id: 'p8', type: 'Lunch', name: 'Tuna Power Wrap', calories: 520, time: '12:30', protein: 35, carbs: 40, fat: 22, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'p9', type: 'Dinner', name: 'Lamb Chops with Quinoa', calories: 680, time: '19:00', protein: 55, carbs: 25, fat: 40, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2025-01-09',
          dayName: 'Thursday',
          meals: [
            { id: 'p10', type: 'Breakfast', name: 'Protein Smoothie Bowl', calories: 420, time: '8:00', protein: 30, carbs: 45, fat: 12, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'p11', type: 'Lunch', name: 'Chicken Caesar Salad', calories: 450, time: '12:30', protein: 35, carbs: 15, fat: 28, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'p12', type: 'Dinner', name: 'Pork Tenderloin with Sweet Potato', calories: 580, time: '19:00', protein: 42, carbs: 35, fat: 28, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2025-01-10',
          dayName: 'Friday',
          meals: [
            { id: 'p13', type: 'Breakfast', name: 'Steak and Eggs', calories: 550, time: '8:00', protein: 40, carbs: 15, fat: 35, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'p14', type: 'Lunch', name: 'Protein Power Bowl', calories: 520, time: '12:30', protein: 38, carbs: 45, fat: 20, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'p15', type: 'Dinner', name: 'Grilled Fish with Vegetables', calories: 480, time: '19:00', protein: 35, carbs: 25, fat: 25, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2025-01-11',
          dayName: 'Saturday',
          meals: [
            { id: 'p16', type: 'Breakfast', name: 'Protein Pancakes Stack', calories: 480, time: '9:00', protein: 35, carbs: 50, fat: 18, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'p17', type: 'Lunch', name: 'Beef Power Bowl', calories: 620, time: '13:00', protein: 48, carbs: 35, fat: 30, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'p18', type: 'Dinner', name: 'Chicken Thighs with Rice', calories: 650, time: '19:30', protein: 45, carbs: 55, fat: 28, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2025-01-12',
          dayName: 'Sunday',
          meals: [
            { id: 'p19', type: 'Breakfast', name: 'Protein Omelet', calories: 420, time: '9:30', protein: 32, carbs: 20, fat: 25, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'p20', type: 'Lunch', name: 'Turkey Power Wrap', calories: 480, time: '13:30', protein: 35, carbs: 40, fat: 22, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'p21', type: 'Dinner', name: 'Sunday Roast Beef', calories: 720, time: '18:00', protein: 55, carbs: 30, fat: 40, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        }
      ]
    }
  ],
  past: [
    {
      id: 'past-1',
      title: 'Mediterranean Bliss',
      dateRange: { start: '2024-03-11', end: '2024-03-17' },
      status: 'completed',
      totalMeals: 21,
      totalCalories: 12800,
      avgCaloriesPerDay: 1828,
      macros: { protein: 22, carbs: 48, fat: 30 },
      tags: ['Mediterranean', 'Heart Healthy', 'Omega-3'],
      createdAt: '2024-03-08T11:45:00Z',
      completedMeals: 19,
      completionRate: 90,
      days: [
        {
          date: '2024-03-11',
          dayName: 'Monday',
          meals: [
            { id: 'm1', type: 'Breakfast', name: 'Greek Yogurt with Honey', calories: 320, time: '8:00', protein: 18, carbs: 35, fat: 12, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
            { id: 'm2', type: 'Lunch', name: 'Mediterranean Salad', calories: 450, time: '12:30', protein: 15, carbs: 25, fat: 35, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'm3', type: 'Dinner', name: 'Grilled Fish with Olives', calories: 520, time: '19:00', protein: 35, carbs: 20, fat: 30, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-12',
          dayName: 'Tuesday',
          meals: [
            { id: 'm4', type: 'Breakfast', name: 'Feta and Spinach Omelet', calories: 380, time: '8:00', protein: 22, carbs: 8, fat: 28, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'm5', type: 'Lunch', name: 'Hummus and Pita', calories: 420, time: '12:30', protein: 12, carbs: 45, fat: 20, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'm6', type: 'Dinner', name: 'Lamb with Herbs', calories: 580, time: '19:00', protein: 40, carbs: 15, fat: 35, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-13',
          dayName: 'Wednesday',
          meals: [
            { id: 'm7', type: 'Breakfast', name: 'Mediterranean Toast', calories: 350, time: '8:00', protein: 15, carbs: 40, fat: 18, image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=200&h=150&fit=crop' },
            { id: 'm8', type: 'Lunch', name: 'Greek Salad Bowl', calories: 480, time: '12:30', protein: 18, carbs: 30, fat: 32, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'm9', type: 'Dinner', name: 'Seafood Paella', calories: 650, time: '19:00', protein: 35, carbs: 55, fat: 25, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-14',
          dayName: 'Thursday',
          meals: [
            { id: 'm10', type: 'Breakfast', name: 'Mediterranean Parfait', calories: 300, time: '8:00', protein: 12, carbs: 35, fat: 15, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
            { id: 'm11', type: 'Lunch', name: 'Caprese Salad', calories: 420, time: '12:30', protein: 20, carbs: 15, fat: 30, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'm12', type: 'Dinner', name: 'Chicken with Olives', calories: 480, time: '19:00', protein: 38, carbs: 20, fat: 28, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-15',
          dayName: 'Friday',
          meals: [
            { id: 'm13', type: 'Breakfast', name: 'Mediterranean Smoothie', calories: 340, time: '8:00', protein: 15, carbs: 45, fat: 12, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'm14', type: 'Lunch', name: 'Falafel Wrap', calories: 460, time: '12:30', protein: 18, carbs: 50, fat: 22, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'm15', type: 'Dinner', name: 'Mediterranean Pasta', calories: 520, time: '19:00', protein: 20, carbs: 65, fat: 18, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-16',
          dayName: 'Saturday',
          meals: [
            { id: 'm16', type: 'Breakfast', name: 'Mediterranean Brunch', calories: 420, time: '9:00', protein: 25, carbs: 35, fat: 22, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'm17', type: 'Lunch', name: 'Antipasto Platter', calories: 380, time: '13:00', protein: 15, carbs: 20, fat: 28, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'm18', type: 'Dinner', name: 'Mediterranean Feast', calories: 720, time: '19:30', protein: 45, carbs: 40, fat: 40, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-17',
          dayName: 'Sunday',
          meals: [
            { id: 'm19', type: 'Breakfast', name: 'Mediterranean Pancakes', calories: 380, time: '9:30', protein: 18, carbs: 45, fat: 15, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'm20', type: 'Lunch', name: 'Mediterranean Soup', calories: 320, time: '13:30', protein: 15, carbs: 30, fat: 18, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=150&fit=crop' },
            { id: 'm21', type: 'Dinner', name: 'Sunday Mediterranean Roast', calories: 650, time: '18:00', protein: 42, carbs: 25, fat: 38, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        }
      ]
    },
    {
      id: 'past-2',
      title: 'Comfort Food Week',
      dateRange: { start: '2024-03-04', end: '2024-03-10' },
      status: 'completed',
      totalMeals: 18,
      totalCalories: 13500,
      avgCaloriesPerDay: 1928,
      macros: { protein: 20, carbs: 55, fat: 25 },
      tags: ['Comfort Food', 'Hearty', 'Soul Food'],
      createdAt: '2024-03-01T16:20:00Z',
      completedMeals: 16,
      completionRate: 89,
      days: [
        {
          date: '2024-03-04',
          dayName: 'Monday',
          meals: [
            { id: 'c1', type: 'Breakfast', name: 'Pancakes with Syrup', calories: 450, time: '8:00', protein: 12, carbs: 65, fat: 15, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c2', type: 'Lunch', name: 'Mac and Cheese', calories: 580, time: '12:30', protein: 18, carbs: 75, fat: 22, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' },
            { id: 'c3', type: 'Dinner', name: 'Meatloaf with Mashed Potatoes', calories: 650, time: '19:00', protein: 35, carbs: 45, fat: 35, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-05',
          dayName: 'Tuesday',
          meals: [
            { id: 'c4', type: 'Breakfast', name: 'French Toast', calories: 420, time: '8:00', protein: 15, carbs: 55, fat: 18, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c5', type: 'Lunch', name: 'Grilled Cheese Sandwich', calories: 480, time: '12:30', protein: 20, carbs: 40, fat: 28, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'c6', type: 'Dinner', name: 'Chicken Pot Pie', calories: 580, time: '19:00', protein: 28, carbs: 50, fat: 32, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-06',
          dayName: 'Wednesday',
          meals: [
            { id: 'c7', type: 'Breakfast', name: 'Waffles with Butter', calories: 380, time: '8:00', protein: 10, carbs: 50, fat: 15, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c8', type: 'Lunch', name: 'Chicken Noodle Soup', calories: 350, time: '12:30', protein: 22, carbs: 35, fat: 12, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=150&fit=crop' },
            { id: 'c9', type: 'Dinner', name: 'Beef Stew', calories: 520, time: '19:00', protein: 32, carbs: 30, fat: 28, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-07',
          dayName: 'Thursday',
          meals: [
            { id: 'c10', type: 'Breakfast', name: 'Biscuits and Gravy', calories: 480, time: '8:00', protein: 15, carbs: 45, fat: 25, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c11', type: 'Lunch', name: 'BLT Sandwich', calories: 450, time: '12:30', protein: 18, carbs: 35, fat: 28, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'c12', type: 'Dinner', name: 'Spaghetti and Meatballs', calories: 620, time: '19:00', protein: 30, carbs: 70, fat: 20, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-08',
          dayName: 'Friday',
          meals: [
            { id: 'c13', type: 'Breakfast', name: 'Hash Browns and Eggs', calories: 420, time: '8:00', protein: 20, carbs: 35, fat: 22, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c14', type: 'Lunch', name: 'Chicken Fried Steak', calories: 580, time: '12:30', protein: 35, carbs: 25, fat: 35, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' },
            { id: 'c15', type: 'Dinner', name: 'Fish and Chips', calories: 650, time: '19:00', protein: 25, carbs: 60, fat: 35, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-09',
          dayName: 'Saturday',
          meals: [
            { id: 'c16', type: 'Breakfast', name: 'Big Breakfast Platter', calories: 650, time: '9:00', protein: 35, carbs: 45, fat: 35, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c17', type: 'Lunch', name: 'Burger and Fries', calories: 720, time: '13:00', protein: 30, carbs: 55, fat: 40, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'c18', type: 'Dinner', name: 'Sunday Roast', calories: 580, time: '19:30', protein: 40, carbs: 25, fat: 35, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-03-10',
          dayName: 'Sunday',
          meals: [
            { id: 'c19', type: 'Breakfast', name: 'Pancake Stack', calories: 480, time: '9:30', protein: 15, carbs: 70, fat: 18, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'c20', type: 'Lunch', name: 'Pot Roast', calories: 520, time: '13:30', protein: 35, carbs: 20, fat: 32, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' },
            { id: 'c21', type: 'Dinner', name: 'Comfort Casserole', calories: 450, time: '18:00', protein: 22, carbs: 40, fat: 25, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
          ]
        }
      ]
    },
    {
      id: 'past-3',
      title: 'New Year Detox',
      dateRange: { start: '2024-01-08', end: '2024-01-14' },
      status: 'completed',
      totalMeals: 21,
      totalCalories: 10500,
      avgCaloriesPerDay: 1500,
      macros: { protein: 30, carbs: 40, fat: 30 },
      tags: ['Detox', 'Clean Eating', 'Low Calorie'],
      createdAt: '2024-01-05T08:00:00Z',
      completedMeals: 21,
      completionRate: 100,
      days: [
        {
          date: '2024-01-08',
          dayName: 'Monday',
          meals: [
            { id: 'd1', type: 'Breakfast', name: 'Green Detox Smoothie', calories: 250, time: '8:00', protein: 15, carbs: 35, fat: 8, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'd2', type: 'Lunch', name: 'Detox Salad Bowl', calories: 320, time: '12:30', protein: 20, carbs: 25, fat: 15, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'd3', type: 'Dinner', name: 'Steamed Fish with Vegetables', calories: 280, time: '19:00', protein: 35, carbs: 15, fat: 12, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-01-09',
          dayName: 'Tuesday',
          meals: [
            { id: 'd4', type: 'Breakfast', name: 'Detox Parfait', calories: 200, time: '8:00', protein: 12, carbs: 25, fat: 6, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200&h=150&fit=crop' },
            { id: 'd5', type: 'Lunch', name: 'Quinoa Power Bowl', calories: 350, time: '12:30', protein: 18, carbs: 45, fat: 12, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'd6', type: 'Dinner', name: 'Grilled Chicken Breast', calories: 300, time: '19:00', protein: 40, carbs: 10, fat: 15, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-01-10',
          dayName: 'Wednesday',
          meals: [
            { id: 'd7', type: 'Breakfast', name: 'Detox Oatmeal', calories: 220, time: '8:00', protein: 8, carbs: 35, fat: 5, image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200&h=150&fit=crop' },
            { id: 'd8', type: 'Lunch', name: 'Raw Veggie Wrap', calories: 280, time: '12:30', protein: 10, carbs: 30, fat: 12, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'd9', type: 'Dinner', name: 'Baked Salmon with Asparagus', calories: 320, time: '19:00', protein: 32, carbs: 8, fat: 18, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-01-11',
          dayName: 'Thursday',
          meals: [
            { id: 'd10', type: 'Breakfast', name: 'Detox Juice', calories: 150, time: '8:00', protein: 5, carbs: 30, fat: 2, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'd11', type: 'Lunch', name: 'Green Detox Soup', calories: 200, time: '12:30', protein: 8, carbs: 20, fat: 8, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=150&fit=crop' },
            { id: 'd12', type: 'Dinner', name: 'Steamed Vegetables', calories: 180, time: '19:00', protein: 12, carbs: 25, fat: 6, image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-01-12',
          dayName: 'Friday',
          meals: [
            { id: 'd13', type: 'Breakfast', name: 'Detox Smoothie Bowl', calories: 200, time: '8:00', protein: 10, carbs: 30, fat: 6, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'd14', type: 'Lunch', name: 'Raw Salad Bowl', calories: 250, time: '12:30', protein: 15, carbs: 20, fat: 12, image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=150&fit=crop' },
            { id: 'd15', type: 'Dinner', name: 'Grilled White Fish', calories: 280, time: '19:00', protein: 30, carbs: 5, fat: 15, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-01-13',
          dayName: 'Saturday',
          meals: [
            { id: 'd16', type: 'Breakfast', name: 'Detox Pancakes', calories: 180, time: '9:00', protein: 8, carbs: 25, fat: 5, image: 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=200&h=150&fit=crop' },
            { id: 'd17', type: 'Lunch', name: 'Detox Buddha Bowl', calories: 300, time: '13:00', protein: 18, carbs: 35, fat: 10, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' },
            { id: 'd18', type: 'Dinner', name: 'Steamed Chicken with Broccoli', calories: 250, time: '19:30', protein: 28, carbs: 8, fat: 12, image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=200&h=150&fit=crop' }
          ]
        },
        {
          date: '2024-01-14',
          dayName: 'Sunday',
          meals: [
            { id: 'd19', type: 'Breakfast', name: 'Final Detox Smoothie', calories: 200, time: '9:30', protein: 12, carbs: 30, fat: 6, image: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=200&h=150&fit=crop' },
            { id: 'd20', type: 'Lunch', name: 'Detox Wrap', calories: 220, time: '13:30', protein: 15, carbs: 25, fat: 8, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=200&h=150&fit=crop' },
            { id: 'd21', type: 'Dinner', name: 'Clean Protein Bowl', calories: 300, time: '18:00', protein: 35, carbs: 15, fat: 12, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=150&fit=crop' }
          ]
        }
      ]
    }
  ]
}

// Legacy exports removed - use real data services instead
// export const mockMealPlan = mockMealPlans.current
// export const emptyMealPlan = { ... }
// export const mockMealChanged = (...) => { ... }

// Mock functions removed - now using real Edge Functions and database services

// Mock curation facts and jokes for the loading screen
export const mockCurationFacts = [
  "Did you know? Carrots were originally purple!",
  "Fun fact: Honey never spoils - archaeologists have found edible honey in ancient Egyptian tombs!",
  "Tomatoes are technically fruits, not vegetables!",
  "A single spaghetti strand is called a 'spaghetto'!",
  "Bananas are berries, but strawberries aren't!",
  "The world's hottest chili pepper is the Carolina Reaper!",
  "Chocolate was once used as currency by the Aztecs!",
  "Pineapples take almost 2 years to grow!",
  "Almonds are not actually nuts - they're seeds!",
  "The fear of vegetables is called lachanophobia!"
]

export const mockCurationJokes = [
  "Why did the tomato turn red? Because it saw the salad dressing!",
  "What do you call a nosy pepper? Jalapeño business!",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What's a potato's favorite TV show? Starch Trek!",
  "Why did the banana go to the doctor? It wasn't peeling well!",
  "What do you call a sad strawberry? A blueberry!",
  "Why don't vegetables ever get lonely? Because they turnip in bunches!",
  "What's orange and sounds like a parrot? A carrot!",
  "Why did the chef break up with the pasta? It was too clingy!",
  "What do you call a sleeping bull at a restaurant? A bulldozer!"
]

// Helper functions
function getCurrentWeekString(): string {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  return monday.toISOString().split('T')[0]
}

function generateEmptyWeek() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  
  return days.map((dayName, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return {
      date: date.toISOString().split('T')[0],
      dayName,
      meals: []
    }
  })
}
