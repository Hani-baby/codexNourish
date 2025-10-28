'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  SendIcon, 
  StopCircleIcon, 
  PlusIcon, 
  SearchIcon,
  MoreVerticalIcon,
  PinIcon,
  EditIcon,
  TrashIcon,
  ChefHatIcon,
  MessageSquareIcon,
  CalendarIcon,
  BookOpenIcon,
  ShoppingCartIcon,
  TargetIcon,
  LoaderIcon
} from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { 
  startMealPlanningChat, 
  startRecipeChat, 
  startNutritionChat, 
  startGroceryChat,
  type Conversation 
} from '@/lib/chat-service'
import { formatDistanceToNow } from 'date-fns'

interface ChatInterfaceProps {
  className?: string
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const {
    conversations,
    selectedConversation,
    messages,
    loading,
    loadingMessages,
    sending,
    error,
    isStreaming,
    selectConversation,
    createNewConversation,
    sendChatMessage,
    stopStreaming,
    renameConv,
    togglePin,
    deleteConv,
    clearConversation
  } = useChat()

  const [messageInput, setMessageInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when conversation changes
  useEffect(() => {
    if (selectedConversation && !sending) {
      inputRef.current?.focus()
    }
  }, [selectedConversation, sending])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || sending) return

    const message = messageInput.trim()
    setMessageInput('')
    
    if (!selectedConversation) {
      // Create new conversation
      await createNewConversation(message)
    } else {
      // Send to existing conversation
      await sendChatMessage(message)
    }
  }

  const handleQuickStart = async (type: 'meal_plan' | 'recipe' | 'nutrition' | 'grocery') => {
    try {
      let conversation: Conversation
      
      switch (type) {
        case 'meal_plan':
          conversation = await startMealPlanningChat()
          break
        case 'recipe':
          conversation = await startRecipeChat()
          break
        case 'nutrition':
          conversation = await startNutritionChat()
          break
        case 'grocery':
          conversation = await startGroceryChat()
          break
      }
      
      await selectConversation(conversation)
    } catch (err) {
      console.error('Failed to start conversation:', err)
    }
  }

  const handleRename = async (conversationId: string) => {
    if (!newTitle.trim()) return
    
    try {
      await renameConv(conversationId, newTitle.trim())
      setEditingTitle(null)
      setNewTitle('')
    } catch (err) {
      console.error('Failed to rename conversation:', err)
    }
  }

  const startRename = (conversation: Conversation) => {
    setEditingTitle(conversation.id)
    setNewTitle(conversation.title)
  }

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`flex h-full ${className}`}>
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ChefHatIcon className="h-5 w-5 text-brand-600" />
              Chef Nourish
            </h2>
            <Button 
              size="sm" 
              onClick={() => clearConversation()}
              className="h-8 w-8 p-0"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Quick Start Options */}
        {!selectedConversation && (
          <div className="p-4 border-b">
            <p className="text-sm text-muted-foreground mb-3">Quick Start:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickStart('meal_plan')}
                className="flex items-center gap-1 text-xs"
              >
                <CalendarIcon className="h-3 w-3" />
                Meal Plan
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickStart('recipe')}
                className="flex items-center gap-1 text-xs"
              >
                <BookOpenIcon className="h-3 w-3" />
                Recipe
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickStart('nutrition')}
                className="flex items-center gap-1 text-xs"
              >
                <TargetIcon className="h-3 w-3" />
                Nutrition
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleQuickStart('grocery')}
                className="flex items-center gap-1 text-xs"
              >
                <ShoppingCartIcon className="h-3 w-3" />
                Shopping
              </Button>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquareIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              filteredConversations.map(conversation => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedConversation?.id === conversation.id}
                  isEditing={editingTitle === conversation.id}
                  newTitle={newTitle}
                  onSelect={() => selectConversation(conversation)}
                  onStartRename={() => startRename(conversation)}
                  onRename={() => handleRename(conversation.id)}
                  onCancelRename={() => {
                    setEditingTitle(null)
                    setNewTitle('')
                  }}
                  onTitleChange={setNewTitle}
                  onTogglePin={() => togglePin(conversation.id)}
                  onDelete={() => deleteConv(conversation.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{selectedConversation.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.message_count} messages • 
                    Created {formatDistanceToNow(new Date(selectedConversation.created_at), { addSuffix: true })}
                  </p>
                </div>
                {selectedConversation.pinned && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <PinIcon className="h-3 w-3" />
                    Pinned
                  </Badge>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isStreaming={isStreaming && index === messages.length - 1 && message.sender === 'assistant'}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Ask Chef Nourish anything about nutrition, recipes, or meal planning..."
                  disabled={sending}
                  className="flex-1"
                />
                {isStreaming ? (
                  <Button 
                    type="button" 
                    onClick={stopStreaming}
                    variant="outline"
                    size="icon"
                  >
                    <StopCircleIcon className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={!messageInput.trim() || sending}
                    size="icon"
                  >
                    {sending ? (
                      <LoaderIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendIcon className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </form>
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="max-w-md text-center">
              <CardHeader>
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-brand-100 flex items-center justify-center">
                  <ChefHatIcon className="h-8 w-8 text-brand-600" />
                </div>
                <CardTitle>Welcome to Chef Nourish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Your personal AI chef and nutritionist, ready to help with meal planning, 
                  recipes, nutrition advice, and grocery shopping.
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Get started with:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleQuickStart('meal_plan')}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Meal Planning
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleQuickStart('recipe')}
                    >
                      <BookOpenIcon className="h-4 w-4 mr-2" />
                      Recipe Help
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleQuickStart('nutrition')}
                    >
                      <TargetIcon className="h-4 w-4 mr-2" />
                      Nutrition
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleQuickStart('grocery')}
                    >
                      <ShoppingCartIcon className="h-4 w-4 mr-2" />
                      Shopping
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  isEditing: boolean
  newTitle: string
  onSelect: () => void
  onStartRename: () => void
  onRename: () => void
  onCancelRename: () => void
  onTitleChange: (title: string) => void
  onTogglePin: () => void
  onDelete: () => void
}

function ConversationItem({
  conversation,
  isSelected,
  isEditing,
  newTitle,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onTitleChange,
  onTogglePin,
  onDelete
}: ConversationItemProps) {
  return (
    <div
      className={`group p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-muted/50'
      }`}
      onClick={!isEditing ? onSelect : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <Input
                value={newTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRename()
                  if (e.key === 'Escape') onCancelRename()
                }}
                className="h-7 text-sm"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={onRename} className="h-6 px-2 text-xs">
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelRename} className="h-6 px-2 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm truncate">{conversation.title}</h4>
                {conversation.pinned && <PinIcon className="h-3 w-3 text-brand-600 flex-shrink-0" />}
              </div>
              {conversation.last_message && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {conversation.last_message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(conversation.last_message_at || conversation.created_at), { addSuffix: true })}
              </p>
            </>
          )}
        </div>

        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVerticalIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartRename}>
                <EditIcon className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePin}>
                <PinIcon className="h-4 w-4 mr-2" />
                {conversation.pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: any
  isStreaming?: boolean
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.sender === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-brand-600 text-white'
            : 'bg-muted border'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center">
              <ChefHatIcon className="h-3 w-3 text-brand-600" />
            </div>
            <span className="text-xs font-medium text-brand-600">Chef Nourish</span>
          </div>
        )}
        
        <div className="whitespace-pre-wrap text-sm">
          {message.text}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
          )}
        </div>
        
        <div className={`text-xs mt-2 ${isUser ? 'text-white/70' : 'text-muted-foreground'}`}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  )
}