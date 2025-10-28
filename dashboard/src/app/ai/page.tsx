/*
 * AI Chat Page - Updated with real Supabase integration
 * 
 * CHANGES:
 * - Independent scroll regions for list and messages
 * - Authoritative local streaming accumulator
 * - Proper abort controller for streaming
 * - Real Supabase data layer integration
 * - Enhanced dark mode support
 * - Single source of truth for selection highlighting
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bot, ChevronDown } from 'lucide-react'
import ConversationList from '../../components/ui/ConversationList'
import ChatHeader from '../../components/ui/ChatHeader'
import MessageBubble from '../../components/ui/MessageBubble'
import MessageComposer from '../../components/ui/MessageComposer'
import EmptyState from '../../components/ui/EmptyState'
import {
  getConversations as listConversations,
  createConversation,
  renameConversation,
  togglePinConversation as pinConversation,
  deleteConversation,
  sendMessage,
  getMessages as listMessages
} from '../../lib/chat-service'

interface Message {
  id: string
  type: 'user' | 'assistant'
  text: string
  timestamp: string
  attachments?: File[]
  actions?: Array<{
    id: string
    label: string
    variant: 'brand' | 'ghost'
  }>
}

interface Conversation {
  id: string
  title: string
  last_message?: string
  last_message_at?: string
  pinned: boolean
  created_at: string
  updated_at: string
  message_count?: number
  messages?: Message[]
}

const suggestions = [
  { id: 'plan-week', label: 'Plan my week' },
  { id: 'high-protein', label: 'High protein' },
  { id: 'vegetarian', label: 'Vegetarian dinners' },
  { id: 'quick-meals', label: 'Under 30 min' }
]

// Transform conversation for ConversationList component
const transformConversationForList = (conv: Conversation) => ({
  id: conv.id,
  title: conv.title,
  lastMessage: conv.last_message || '',
  timestamp: conv.last_message_at || conv.created_at,
  pinned: conv.pinned,
  unread: false // We don't track unread status yet
})

export default function AI() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)

  // streaming state with authoritative accumulator
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const streamingAccumulator = useRef('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // layout state
  const [showConversations, setShowConversations] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const conversationsContainerRef = useRef<HTMLDivElement>(null)

  // Real AbortController for streaming
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const rawConversations = await listConversations()
        // Transform conversations to match expected interface
        const conversations: Conversation[] = rawConversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          last_message: conv.last_message,
          last_message_at: conv.last_message_at,
          pinned: conv.pinned,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          message_count: conv.message_count
        }))
        setConversations(conversations)
        if (!selectedConversation && conversations.length) {
          setSelectedConversation(conversations[0])
        }
      } catch (e) {
        console.error('Failed to load conversations:', e)
        setError('Failed to load conversations')
      } finally {
        setIsLoading(false)
      }
    }
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // responsive
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 1280) setShowConversations(false)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Auto scroll on new content (smooth for streaming, instant for switching)
  useEffect(() => {
    if (isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [streamingContent, isStreaming])

  // Jump to bottom when switching threads (instant)
  useEffect(() => {
    if (selectedConversation) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
      }, 50)
    }
  }, [selectedConversation?.id])

  // Load messages when conversation selected
  useEffect(() => {
    const loadMessages = async () => {
      if (selectedConversation && !selectedConversation.messages) {
        try {
          const rawMessages = await listMessages(selectedConversation.id)
          // Transform messages to match expected interface
          const messages: Message[] = rawMessages.map(msg => ({
            id: msg.id,
            type: msg.sender === 'user' ? 'user' : 'assistant',
            text: msg.text || '',
            timestamp: msg.created_at,
            actions: msg.meta?.actions
          }))
          setSelectedConversation(prev => prev ? { ...prev, messages } : null)
        } catch (e) {
          console.error('Failed to load messages:', e)
          setError('Failed to load messages')
        }
      }
    }
    loadMessages()
  }, [selectedConversation?.id])

  // Monitor scroll position for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollToBottom(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    try {
      setSelectedConversation(conversation)
      setError(null)
      
      // Load messages for selected conversation
      const rawMessages = await listMessages(conversation.id)
      // Transform messages to match expected interface
      const messages: Message[] = rawMessages.map(msg => ({
        id: msg.id,
        type: msg.sender === 'user' ? 'user' : 'assistant',
        text: msg.text || '',
        timestamp: msg.created_at,
        actions: msg.meta?.actions
      }))
      setSelectedConversation(prev => prev ? { ...prev, messages } : null)
      
      if (isMobile) {
        setShowConversations(false)
      }
    } catch (e) {
      console.error('Failed to load messages:', e)
      setError('Failed to load messages')
    }
  }, [isMobile])

  const handleCreateConversation = useCallback(async () => {
    try {
      setError(null)
      const newConv = await createConversation('Hello! I\'d like to start a new conversation.')
      const rawConversations = await listConversations()
      const updatedConversations: Conversation[] = rawConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        pinned: conv.pinned,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        message_count: conv.message_count
      }))
      setConversations(updatedConversations)
      setSelectedConversation({ ...newConv, messages: [] })
      if (isMobile) {
        setShowConversations(false)
      }
    } catch (e) {
      console.error('Failed to create conversation:', e)
      setError('Failed to create conversation')
    }
  }, [isMobile])

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    try {
      setError(null)
      await renameConversation(id, title)
      const rawConversations = await listConversations()
      const updatedConversations: Conversation[] = rawConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        pinned: conv.pinned,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        message_count: conv.message_count
      }))
      setConversations(updatedConversations)
      if (selectedConversation?.id === id) {
        setSelectedConversation(prev => prev ? { ...prev, title } : null)
      }
    } catch (e) {
      console.error('Failed to rename conversation:', e)
      setError('Failed to rename conversation')
    }
  }, [selectedConversation?.id])

  const handlePinConversation = useCallback(async (id: string) => {
    try {
      setError(null)
      await pinConversation(id)
      const rawConversations = await listConversations()
      const updatedConversations: Conversation[] = rawConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        pinned: conv.pinned,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        message_count: conv.message_count
      }))
      setConversations(updatedConversations)
      if (selectedConversation?.id === id) {
        setSelectedConversation(prev => prev ? { ...prev, pinned: !prev.pinned } : null)
      }
    } catch (e) {
      console.error('Failed to pin conversation:', e)
      setError('Failed to toggle pin')
    }
  }, [selectedConversation?.id])

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      setError(null)
      await deleteConversation(id)
      const rawConversations = await listConversations()
      const updatedConversations: Conversation[] = rawConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        pinned: conv.pinned,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        message_count: conv.message_count
      }))
      setConversations(updatedConversations)
      if (selectedConversation?.id === id) {
        setSelectedConversation(updatedConversations[0] || null)
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e)
      setError('Failed to delete conversation')
    }
  }, [selectedConversation?.id])

  const handleSendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!selectedConversation || isStreaming) return

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      setIsStreaming(true)
      setStreamingContent('')
      streamingAccumulator.current = ''
      setError(null)

      // Optimistically add user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        type: 'user',
        text: content || (attachments && attachments.length > 0 ? 'Voice message' : ''),
        timestamp: new Date().toISOString(),
        attachments: attachments
      }

      setSelectedConversation(prev => {
        if (!prev) return null
        return {
          ...prev,
          messages: [...(prev.messages || []), userMessage]
        }
      })

      // Start streaming
      const stream = await sendMessage(selectedConversation.id, content, true, attachments)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done || abortController.signal.aborted) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.content) {
                // Accumulate content authoritatively
                streamingAccumulator.current += data.content
                setStreamingContent(streamingAccumulator.current)
              }
              
              if (data.complete) {
                // Create final assistant message using accumulator
                const finalContent = streamingAccumulator.current
                const assistantMessage: Message = {
                  id: `msg-${Date.now()}`,
                  type: 'assistant',
                  text: finalContent,
                  timestamp: new Date().toISOString(),
                  actions: data.actions
                }

                // Update conversation with final message
                setSelectedConversation(prev => {
                  if (!prev) return null
                  return {
                    ...prev,
                    messages: [...(prev.messages || []), assistantMessage],
                    lastMessage: finalContent.slice(0, 100),
                    timestamp: 'Just now'
                  }
                })

                // Clear streaming state immediately to prevent duplicate bubbles
                setIsStreaming(false)
                setStreamingContent('')
                streamingAccumulator.current = ''

                // Refresh conversations list
                try {
                  const rawConversations = await listConversations()
                  const refreshed: Conversation[] = rawConversations.map(conv => ({
                    id: conv.id,
                    title: conv.title,
                    last_message: conv.last_message,
                    last_message_at: conv.last_message_at,
                    pinned: conv.pinned,
                    created_at: conv.created_at,
                    updated_at: conv.updated_at,
                    message_count: conv.message_count
                  }))
                  setConversations(refreshed)
                } catch (e) {
                  console.error('Failed to refresh conversations:', e)
                }
                break
              }
              
              if (data.error) {
                throw new Error(data.error)
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('Stream aborted by user')
        } else {
          console.error('Error sending message:', error)
          setError(`Failed to send message: ${error.message}`)
        }
      }
    } finally {
      // Only clear streaming state if not already cleared by completion
      if (isStreaming) {
        setIsStreaming(false)
        setStreamingContent('')
        streamingAccumulator.current = ''
      }
      abortControllerRef.current = null
    }
  }, [selectedConversation, isStreaming])

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamingContent('')
    streamingAccumulator.current = ''
    setError(null)
  }, [])

  const handleSuggestionClick = useCallback((suggestion: { id: string; label: string }) => {
    handleSendMessage(suggestion.label)
  }, [handleSendMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  const renderMessages = () => {
    const messages = selectedConversation?.messages || []
    
    if (!messages.length && !isStreaming) {
      return (
        <div className="empty-state-container">
          <EmptyState
            icon={<Bot size={32} />}
            title="Start your conversation"
            description="Ask me anything about nutrition, recipes, or meal planning!"
          />
        </div>
      )
    }

    return (
      <div className="messages-list">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            type={message.type}
            content={message.text}
            timestamp={message.timestamp}
            attachments={message.attachments}
            actions={message.actions}
            isLastInGroup={index === messages.length - 1 && !isStreaming}
          />
        ))}
        
        {isStreaming && streamingContent && (
          <MessageBubble
            key="streaming-message"
            type="assistant"
            content={streamingContent}
            timestamp={new Date().toISOString()}
            isStreaming={true}
            isLastInGroup={true}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="ai-page">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      <div className="chat-layout">
        {/* LEFT: conversations with independent scroll */}
        {(!isMobile || showConversations) && (
          <div className="conversations-pane">
            <div ref={conversationsContainerRef} className="conversations-scroll">
              <ConversationList
                conversations={conversations.map(transformConversationForList)}
                selectedId={selectedConversation?.id}
                onSelect={(conv) => {
                  // Find the original conversation by ID
                  const originalConv = conversations.find(c => c.id === conv.id)
                  if (originalConv) {
                    handleSelectConversation(originalConv)
                  }
                }}
                onCreateNew={handleCreateConversation}
                onPin={handlePinConversation}
                onDelete={handleDeleteConversation}
                onRename={handleRenameConversation}
                isMobile={isMobile}
                onClose={() => setShowConversations(false)}
              />
            </div>
          </div>
        )}

        {/* RIGHT: thread with independent scroll */}
        <div className="chat-pane">
          {selectedConversation ? (
            <>
              <ChatHeader
                title={selectedConversation.title}
                isPinned={selectedConversation.pinned}
                isStreaming={isStreaming}
                onRename={(t) => handleRenameConversation(selectedConversation.id, t)}
                onPin={() => handlePinConversation(selectedConversation.id)}
                onDelete={() => handleDeleteConversation(selectedConversation.id)}
                onMenuClick={() => setShowConversations(true)}
                showMenuButton={isMobile}
              />

              <div ref={messagesContainerRef} className="messages-container">
                {renderMessages()}
                
                {showScrollToBottom && (
                  <button className="scroll-to-bottom" onClick={scrollToBottom}>
                    <ChevronDown size={16} />
                  </button>
                )}
              </div>

              <MessageComposer
                onSend={handleSendMessage}
                onStop={handleStopStreaming}
                isStreaming={isStreaming}
                suggestions={suggestions}
                onSuggestionClick={handleSuggestionClick}
                disabled={isStreaming}
              />
            </>
          ) : (
            <div className="no-conversation-state">
              <EmptyState
                icon={<Bot size={48} />}
                title="No conversation selected"
                description="Choose a conversation from the sidebar or create a new one to start chatting"
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ai-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: var(--background);
          overflow: hidden;
        }
        
        .loading-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-4);
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border);
          border-top: 3px solid var(--brand);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-banner {
          background-color: var(--danger);
          color: white;
          padding: var(--space-3) var(--space-4);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: var(--text-sm);
        }
        
        .error-banner button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: var(--text-lg);
          padding: 0;
        }
        
        .chat-layout {
          display: flex;
          height: 100%;
          overflow: hidden;
        }
        
        .conversations-pane {
          width: 320px;
          border-right: 1px solid var(--border);
          background-color: var(--panel);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .conversations-scroll {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        
        .chat-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        
        .messages-container {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior: contain;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        
        .messages-list {
          flex: 1;
          padding: var(--space-4);
          min-height: 0;
        }
        
        .empty-state-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
        }
        
        .no-conversation-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .scroll-to-bottom {
          position: absolute;
          bottom: var(--space-4);
          right: var(--space-4);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--panel);
          border: 1px solid var(--border);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          box-shadow: var(--shadow-md);
        }
        
        .scroll-to-bottom:hover {
          background-color: var(--hover-bg);
          color: var(--text);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        
        /* Dark mode enhancements for better contrast */
        [data-theme="dark"] .ai-page {
          background-color: var(--background);
        }
        
        [data-theme="dark"] .conversations-pane {
          background-color: var(--panel);
          border-right-color: var(--border);
        }
        
        [data-theme="dark"] .chat-pane {
          background-color: var(--background);
        }
        
        /* Selection highlighting - single source of truth */
        :root {
          --hi-bg: #f0f9f4;
          --hi-ring: #10b981;
        }
        
        [data-theme="dark"] {
          --hi-bg: #133022;
          --hi-ring: #1a473a;
        }
        
        @media (max-width: 1279px) {
          .conversations-pane {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            z-index: var(--z-modal);
            transform: translateX(-100%);
            transition: transform var(--transition-normal);
            box-shadow: var(--shadow-lg);
          }
          
          .conversations-pane.show {
            transform: translateX(0);
          }
        }
        
        @media (max-width: 767px) {
          .conversations-pane {
            width: 280px;
          }
          
          .messages-list {
            padding: var(--space-3);
          }
          
          .error-banner {
            padding: var(--space-2) var(--space-3);
            font-size: var(--text-xs);
          }
          
          .scroll-to-bottom {
            width: 36px;
            height: 36px;
            bottom: var(--space-3);
            right: var(--space-3);
          }
        }
      `}</style>
    </div>
  )
}