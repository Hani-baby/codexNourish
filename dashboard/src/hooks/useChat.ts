import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  getConversations, 
  getMessages, 
  createConversation,
  sendMessage,
  updateConversation,
  deleteConversation,
  togglePinConversation,
  renameConversation,
  normalizeMessageRecord,
  type Conversation, 
  type Message,
  type ChatContext
} from '@/lib/chat-service'
import { 
  subscribeToConversations, 
  subscribeToMessages,
  supabase 
} from '@/lib/supabase'

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const convs = await getConversations()
      setConversations(convs)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setLoadingMessages(true)
      setError(null)
      const msgs = await getMessages(conversationId)
      setMessages(msgs)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages'
      setError(errorMessage)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // Select conversation and load its messages
  const selectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    await loadMessages(conversation.id)
  }, [loadMessages])

  // Create new conversation
  const createNewConversation = useCallback(async (initialMessage: string, context?: ChatContext) => {
    try {
      setError(null)
      const newConversation = await createConversation(initialMessage, context)
      setConversations(prev => [newConversation, ...prev])
      setSelectedConversation(newConversation)
      await loadMessages(newConversation.id)
      return newConversation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation'
      setError(errorMessage)
      throw err
    }
  }, [loadMessages])

  // Send message with streaming support
  const sendChatMessage = useCallback(async (content: string, stream: boolean = true) => {
    if (!selectedConversation || sending) return

    try {
      setSending(true)
      setError(null)
      setIsStreaming(stream)

      // Add user message immediately to UI
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedConversation.id,
        sender: 'user',
        text: content,
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, userMessage])

      // Persist the user message with schema-compliant fields
      const { data: persistedUserMessage, error: userMessageError } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: selectedConversation.id,
          role: 'user',
          content: [{ type: 'text', text: content }]
        })
        .select()
        .single()

      if (userMessageError) throw userMessageError
      if (!persistedUserMessage) throw new Error('Failed to persist user message')

      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? normalizeMessageRecord(persistedUserMessage) : msg
      ))

      // Streaming via chat-gateway
      abortControllerRef.current = new AbortController()
      const { outputText, toolResults } = await sendMessage(selectedConversation.id, content, true)
      let assistantContent = outputText || ''
      // Temporary assistant message in UI
      const assistantTempId = `temp-assistant-${Date.now()}`
      setMessages(prev => [...prev, { id: assistantTempId, conversation_id: selectedConversation.id, sender: 'assistant', text: '', created_at: new Date().toISOString() } as any])

      try {
        assistantContent = outputText || ''
        setMessages(prev => prev.map(m => m.id === assistantTempId ? { ...m, text: assistantContent || '', meta: toolResults && toolResults.length ? { toolResults } : undefined } as any : m))
      } finally {
      }

      // Persist the final assistant message and bump conversation updated_at
      const { data: persistedAssistantMessage, error: assistantMessageError } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: selectedConversation.id,
          role: 'assistant',
          content: [{ type: 'text', text: assistantContent }]
        })
        .select()
        .single()

      if (assistantMessageError) throw assistantMessageError
      if (!persistedAssistantMessage) throw new Error('Failed to persist assistant message')

      setMessages(prev => prev.map(msg => 
        msg.id === assistantTempId ? normalizeMessageRecord(persistedAssistantMessage) : msg
      ))

      await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', selectedConversation.id)

      // Refresh conversation list
      await loadConversations()

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, don't show error
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
    } finally {
      setSending(false)
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [selectedConversation, sending, loadConversations])

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setSending(false)
  }, [])

  // Update conversation
  const updateConv = useCallback(async (conversationId: string, updates: Partial<Conversation>) => {
    try {
      const updatedConv = await updateConversation(conversationId, updates)
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? updatedConv : conv
      ))
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(updatedConv)
      }
      return updatedConv
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update conversation'
      setError(errorMessage)
      throw err
    }
  }, [selectedConversation])

  // Rename conversation
  const renameConv = useCallback(async (conversationId: string, title: string) => {
    return updateConv(conversationId, { title })
  }, [updateConv])

  // Toggle pin conversation
  const togglePin = useCallback(async (conversationId: string) => {
    try {
      await togglePinConversation(conversationId)
      await loadConversations() // Refresh to get updated order
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle pin'
      setError(errorMessage)
      throw err
    }
  }, [loadConversations])

  // Delete conversation
  const deleteConv = useCallback(async (conversationId: string) => {
    try {
      await deleteConversation(conversationId)
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null)
        setMessages([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(errorMessage)
      throw err
    }
  }, [selectedConversation])

  // Clear current conversation
  const clearConversation = useCallback(() => {
    setSelectedConversation(null)
    setMessages([])
    setError(null)
  }, [])

  // Set up real-time subscriptions
  useEffect(() => {
    const { data: { user } } = supabase.auth.getUser()
    if (!user) return

    console.log('Setting up real-time subscriptions for chat')
    
    // Subscribe to conversations changes
    const conversationsSubscription = subscribeToConversations(user.id, (payload) => {
      console.log('Conversation change received:', payload)
      
      if (payload.eventType === 'INSERT') {
        setConversations(prev => [payload.new, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setConversations(prev => prev.map(conv => 
          conv.id === payload.new.id ? payload.new : conv
        ))
      } else if (payload.eventType === 'DELETE') {
        setConversations(prev => prev.filter(conv => conv.id !== payload.old.id))
      }
    })

    // Subscribe to messages changes for selected conversation
    let messagesSubscription: any = null
    if (selectedConversation) {
      messagesSubscription = subscribeToMessages(selectedConversation.id, (payload) => {
        console.log('Message change received:', payload)
        
        if (payload.eventType === 'INSERT') {
          if (!payload.new) return
          const normalized = normalizeMessageRecord(payload.new)
          setMessages(prev => {
            const withoutDuplicates = prev
              .filter(msg => msg.id !== normalized.id)
              .filter(msg => !(msg.id.startsWith('temp-') && msg.sender === normalized.sender))
            const updated = [...withoutDuplicates, normalized]
            return updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          })
        } else if (payload.eventType === 'UPDATE') {
          if (!payload.new) return
          const normalized = normalizeMessageRecord(payload.new)
          setMessages(prev => prev.map(msg => 
            msg.id === normalized.id ? normalized : msg
          ))
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
        }
      })
    }

    return () => {
      console.log('Cleaning up real-time subscriptions')
      conversationsSubscription?.unsubscribe()
      messagesSubscription?.unsubscribe()
    }
  }, [selectedConversation])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    // State
    conversations,
    selectedConversation,
    messages,
    loading,
    loadingMessages,
    sending,
    error,
    isStreaming,

    // Actions
    selectConversation,
    createNewConversation,
    sendChatMessage,
    stopStreaming,
    renameConv,
    togglePin,
    deleteConv,
    clearConversation,
    loadConversations,
    loadMessages
  }
}
