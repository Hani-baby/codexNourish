import { supabase } from './supabase'
import { getEffectiveUserId } from './user-hierarchy'

export interface Conversation {
  id: string
  owner_user_id: string
  title: string
  created_at: string
  updated_at: string
  pinned?: boolean
  message_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender: 'user' | 'assistant' | 'system'
  text: string
  tool_calls?: any
  meta?: any
  created_at: string
}

export interface ChatContext {
  type: 'meal_planning' | 'recipe_request' | 'nutrition_question' | 'grocery_help' | 'general'
  data?: any
}

const flattenMessageContent = (raw: any): string => {
  if (Array.isArray(raw)) {
    return raw
      .map(part => {
        if (!part) return ''
        if (typeof part === 'string') return part
        if (typeof part === 'object') {
          if (typeof part.text === 'string') return part.text
          if (typeof part.delta === 'string') return part.delta
          if (typeof part.content === 'string') return part.content
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (raw && typeof raw === 'object') {
    if (typeof raw.text === 'string') return raw.text
    if (typeof raw.delta === 'string') return raw.delta
    if (typeof raw.content === 'string') return raw.content
  }

  if (typeof raw === 'string') return raw
  if (raw == null) return ''

  try {
    return JSON.stringify(raw)
  } catch {
    return String(raw)
  }
}

export function normalizeMessageRecord(record: any): Message {
  const sender = record?.role === 'assistant' || record?.role === 'system' ? record.role : 'user'
  const text = flattenMessageContent(record?.content)

  return {
    id: record.id,
    conversation_id: record.conversation_id,
    sender: sender ?? 'user',
    text,
    tool_calls: record?.tool_calls ?? undefined,
    meta: record?.meta ?? undefined,
    created_at: record.created_at,
  }
}

// Create a new conversation with intelligent title generation
export async function createConversation(initialMessage: string, context?: ChatContext): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  // Generate intelligent title based on message content and context
  const title = generateConversationTitle(initialMessage, context)

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ owner_user_id: effectiveUserId, title, context: context ? { pinned: false, ...context } : { pinned: false } })
    .select()
    .single()

  if (error) throw error

  // Add the initial message
  await supabase
    .from('ai_messages')
    .insert({
      conversation_id: data.id,
      role: 'user',
      content: [{ type: 'text', text: initialMessage }]
    })

  return data
}

// Generate intelligent conversation titles
function generateConversationTitle(message: string, context?: ChatContext): string {
  const lowerMessage = message.toLowerCase()

  // Context-based titles
  if (context) {
    switch (context.type) {
      case 'meal_planning':
        return `Meal Plan: ${context.data?.dateRange || 'Custom Plan'}`
      case 'recipe_request':
        return `Recipe: ${context.data?.recipeName || 'Custom Recipe'}`
      case 'nutrition_question':
        return `Nutrition: ${context.data?.topic || 'Health Goals'}`
      case 'grocery_help':
        return `Shopping: ${context.data?.listName || 'Grocery List'}`
    }
  }

  // Pattern-based title generation
  if (lowerMessage.includes('meal plan') || lowerMessage.includes('weekly plan')) {
    if (lowerMessage.includes('week')) return 'Weekly Meal Planning'
    if (lowerMessage.includes('month')) return 'Monthly Meal Planning'
    return 'Meal Planning Session'
  }

  if (lowerMessage.includes('recipe') || lowerMessage.includes('cook') || lowerMessage.includes('make')) {
    const recipeKeywords = ['chicken', 'pasta', 'salad', 'soup', 'breakfast', 'dinner', 'lunch']
    const foundKeyword = recipeKeywords.find(keyword => lowerMessage.includes(keyword))
    if (foundKeyword) return `${foundKeyword.charAt(0).toUpperCase() + foundKeyword.slice(1)} Recipe Help`
    return 'Recipe Creation'
  }

  if (lowerMessage.includes('grocery') || lowerMessage.includes('shopping') || lowerMessage.includes('ingredients')) {
    return 'Grocery Shopping Help'
  }

  if (lowerMessage.includes('nutrition') || lowerMessage.includes('calories') || lowerMessage.includes('protein') || lowerMessage.includes('diet')) {
    return 'Nutrition Guidance'
  }

  if (lowerMessage.includes('weight') && (lowerMessage.includes('lose') || lowerMessage.includes('gain'))) {
    return 'Weight Management'
  }

  if (lowerMessage.includes('vegetarian') || lowerMessage.includes('vegan') || lowerMessage.includes('keto') || lowerMessage.includes('paleo')) {
    const dietType = lowerMessage.match(/(vegetarian|vegan|keto|paleo|mediterranean)/i)?.[0]
    return dietType ? `${dietType.charAt(0).toUpperCase() + dietType.slice(1)} Diet Help` : 'Dietary Guidance'
  }

  if (lowerMessage.includes('allerg') || lowerMessage.includes('intoleran')) {
    return 'Dietary Restrictions Help'
  }

  if (lowerMessage.includes('quick') || lowerMessage.includes('easy') || lowerMessage.includes('simple')) {
    return 'Quick Meal Solutions'
  }

  if (lowerMessage.includes('healthy') || lowerMessage.includes('clean eating')) {
    return 'Healthy Eating Guide'
  }

  // Fallback to first few words or generic title
  // Fallback: use first few words of the message, but make them more meaningful
  const words = message.split(' ').slice(0, 4).join(' ')
  if (words.length > 3) {
    const title = words.length > 30 ? words.substring(0, 30) + '...' : words
    return title.charAt(0).toUpperCase() + title.slice(1)
  }

  // If message is too short, try to extract intent
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return 'Getting Started'
  }
  
  if (lowerMessage.includes('name') || lowerMessage.includes('who')) {
    return 'Personal Information'
  }
  
  if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
    return 'Help & Support'
  }

  return 'New Conversation'
}

// Get all conversations for user
export async function getConversations(): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  const { data, error } = await supabase
    .from('ai_conversations')
    .select(`*, ai_messages(count)`)
    .eq('owner_user_id', effectiveUserId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data || []).map((conv: any) => ({
    id: conv.id,
    owner_user_id: conv.owner_user_id,
    title: conv.title,
    created_at: conv.created_at,
    updated_at: conv.updated_at,
    pinned: !!conv.context?.pinned,
    message_count: conv.ai_messages?.[0]?.count || 0,
  }))
}

// Get specific conversation
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('owner_user_id', effectiveUserId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data ? { id: data.id, owner_user_id: data.owner_user_id, title: data.title, created_at: data.created_at, updated_at: data.updated_at, pinned: !!data.context?.pinned } : null
}

// Get messages for a conversation
export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // First verify the user owns this conversation
  const conversation = await getConversation(conversationId)
  if (!conversation) throw new Error('Conversation not found or access denied')

  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map(normalizeMessageRecord)
}

// Upload file to Supabase storage
export async function uploadFile(file: File, conversationId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${conversationId}/${Date.now()}.${fileExt}`
  
  const { data, error } = await supabase.storage
    .from('chat-attachments')
    .upload(fileName, file)

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(fileName)

  return publicUrl
}

// Send message to Chef Nourish
export async function sendMessage(
  conversationId: string,
  content: string,
  stream: boolean = true,
  attachments?: File[]
): Promise<{ outputText: string; toolResults: any[] }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  console.log('Sending message to Chef Nourish', {
    conversationId,
    contentLength: content.length,
    stream,
    attachmentsCount: attachments?.length || 0
  })

  // Upload attachments if any
  let attachmentUrls: string[] = []
  if (attachments && attachments.length > 0) {
    console.log(`Uploading ${attachments.length} attachments...`)
    attachmentUrls = await Promise.all(
      attachments.map(file => uploadFile(file, conversationId))
    )
    console.log('Attachments uploaded:', attachmentUrls)
  }

  const messageContent = attachmentUrls.length
    ? `${content}\n\nAttachments:\n${attachmentUrls.join('\n')}`
    : content;

  if (stream) {
    console.warn('Streaming mode requested, but ai-router response is non-streaming. Falling back to buffered response.')
  }

  const result = await sendMessageViaAiRouter({
    conversationId,
    userId: session.user.id,
    message: messageContent,
    sessionPreferences: undefined,
  })

  console.log('Chef Nourish response via ai-router', {
    conversationId,
    outputLength: result.outputText.length,
    toolResults: result.toolResults?.length ?? 0,
  })

  return result
}

export async function sendMessageViaAiRouter(params: {
  conversationId: string
  userId: string
  message: string
  householdId?: string
  sessionPreferences?: Record<string, any>
}): Promise<{ outputText: string; toolResults: any[] }> {
  const { conversationId, userId, message, householdId: providedHousehold, sessionPreferences } = params

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  let householdId = providedHousehold
  if (!householdId) {
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    householdId = membership?.household_id || undefined
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-router`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      mode: 'chat',
      chat_id: conversationId,
      user_id: userId,
      household_id: householdId,
      session_preferences: sessionPreferences || {},
      messages: [
        { role: 'user', content: message }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to contact AI assistant')
  }

  const data = await response.json()
  return {
    outputText: data.output_text || '',
    toolResults: Array.isArray(data.tool_results) ? data.tool_results : []
  }
}

// Update conversation
export async function updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  const { data, error } = await supabase
    .from('ai_conversations')
    .update({
      title: updates.title,
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId)
    .eq('owner_user_id', effectiveUserId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Rename conversation
export async function renameConversation(conversationId: string, title: string): Promise<Conversation> {
  return updateConversation(conversationId, { title })
}

// Pin/unpin conversation
export async function togglePinConversation(conversationId: string): Promise<Conversation> {
  const { data: row, error } = await supabase
    .from('ai_conversations')
    .select('context')
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw error
  const currentPinned = !!row?.context?.pinned
  const newContext = { ...(row?.context || {}), pinned: !currentPinned }
  const { data: upd, error: upErr } = await supabase
    .from('ai_conversations')
    .update({ context: newContext, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*')
    .single()
  if (upErr) throw upErr
  return { id: upd.id, owner_user_id: upd.owner_user_id, title: upd.title, created_at: upd.created_at, updated_at: upd.updated_at, pinned: !!upd.context?.pinned }
}

// Delete conversation
export async function deleteConversation(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('owner_user_id', effectiveUserId)

  if (error) throw error
}

// Search conversations
export async function searchConversations(query: string): Promise<Conversation[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('owner_user_id', effectiveUserId)
    .ilike('title', `%${query}%`)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get conversation statistics
export async function getConversationStats(): Promise<{
  totalConversations: number
  totalMessages: number
  pinnedConversations: number
  averageMessagesPerConversation: number
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the effective user ID (master for family tier, self for individual)
  const effectiveUserId = await getEffectiveUserId(user.id)

  const { data: convs } = await supabase
    .from('ai_conversations')
    .select('id, context')
    .eq('owner_user_id', effectiveUserId)
  const { data: msgs } = await supabase
    .from('ai_messages')
    .select('id, conversation_id')
    .in('conversation_id', (convs || []).map(c => c.id))

  return {
    totalConversations: (convs || []).length,
    totalMessages: (msgs || []).length,
    pinnedConversations: (convs || []).filter(c => !!c.context?.pinned).length,
    averageMessagesPerConversation: (convs || []).length > 0 ? Math.round((msgs || []).length / (convs || []).length) : 0
  }
}

// Quick start conversations with context
export async function startMealPlanningChat(dateRange?: { start: string; end: string }): Promise<Conversation> {
  const message = dateRange 
    ? `I'd like to create a meal plan from ${dateRange.start} to ${dateRange.end}. Can you help me plan some delicious and nutritious meals?`
    : "I'd like to create a meal plan. Can you help me plan some delicious and nutritious meals for the week?"

  return createConversation(message, {
    type: 'meal_planning',
    data: { dateRange: dateRange ? `${dateRange.start} to ${dateRange.end}` : 'This week' }
  })
}

export async function startRecipeChat(recipeName?: string): Promise<Conversation> {
  const message = recipeName
    ? `I'd like to create a recipe for ${recipeName}. Can you help me with ingredients and instructions?`
    : "I'd like to create a custom recipe. Can you help me with ingredients and cooking instructions?"

  return createConversation(message, {
    type: 'recipe_request',
    data: { recipeName }
  })
}

export async function startNutritionChat(topic?: string): Promise<Conversation> {
  const message = topic
    ? `I have questions about ${topic}. Can you provide some nutritional guidance?`
    : "I'd like some nutritional guidance. Can you help me understand my dietary needs?"

  return createConversation(message, {
    type: 'nutrition_question',
    data: { topic }
  })
}

export async function startGroceryChat(mealPlanId?: string): Promise<Conversation> {
  const message = mealPlanId
    ? `I need help creating a grocery list for my meal plan. Can you help me organize my shopping?`
    : "I need help with grocery shopping and meal prep. Can you assist me?"

  return createConversation(message, {
    type: 'grocery_help',
    data: { mealPlanId }
  })
}

// End of chat bootstrapping helpers
