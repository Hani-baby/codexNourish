import React, { useState, useEffect, useRef } from 'react'
import { Search, Pin, MoreHorizontal, Plus, MessageSquare, ChevronDown } from 'lucide-react'
import Button from './Button'

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  pinned: boolean
  unread: boolean
}

interface ConversationListProps {
  conversations: Conversation[]
  selectedId?: string
  onSelect: (conversation: Conversation) => void
  onCreateNew: () => void
  onPin: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  isMobile?: boolean
  onClose?: () => void
}

type FilterType = 'all' | 'pinned' | 'recent' | 'archived'

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreateNew,
  onPin,
  onDelete,
  onRename,
  isMobile = false,
  onClose
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const conversationsContainerRef = useRef<HTMLDivElement>(null)

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (!matchesSearch) return false
    
    switch (filter) {
      case 'pinned':
        return conversation.pinned
      case 'recent':
        return !conversation.pinned && conversation.timestamp.includes('hour') || conversation.timestamp.includes('day')
      case 'archived':
        return false // No archived conversations in mock data
      default:
        return true
    }
  })

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })

  const handleRename = (id: string) => {
    const conversation = conversations.find(c => c.id === id)
    if (conversation) {
      setEditingId(id)
      setEditTitle(conversation.title)
    }
  }

  const handleSaveRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim())
      setEditingId(null)
      setEditTitle('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditTitle('')
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        // Focus search input
        const searchInput = document.getElementById('conversation-search')
        if (searchInput) searchInput.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle scroll events to show/hide scroll-to-top button
  useEffect(() => {
    const container = conversationsContainerRef.current
    if (container) {
      const handleScroll = () => {
        const { scrollTop } = container
        setShowScrollToTop(scrollTop > 100)
      }
      
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const scrollToTop = () => {
    if (conversationsContainerRef.current) {
      conversationsContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="conversation-list">
      <div className="conversation-header">
        <h2 className="conversation-title">Chef Nourish AI</h2>
        <Button 
          size="sm" 
          leftIcon={<Plus size={16} />}
          onClick={onCreateNew}
        >
          New Chat
        </Button>
      </div>

      <div className="search-section">
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            id="conversation-search"
            type="text"
            placeholder="Search conversations"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="filter-tabs">
        {(['all', 'pinned', 'recent', 'archived'] as FilterType[]).map((filterType) => (
          <button
            key={filterType}
            onClick={() => setFilter(filterType)}
            className={`filter-tab ${filter === filterType ? 'active' : ''}`}
          >
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </button>
        ))}
      </div>

      <div className="conversations-container" ref={conversationsContainerRef}>
        {sortedConversations.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={24} />
            <p>No conversations found</p>
          </div>
        ) : (
          sortedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${conversation.id === selectedId ? 'selected' : ''} ${conversation.unread ? 'unread' : ''}`}
              onClick={() => onSelect(conversation)}
              aria-selected={conversation.id === selectedId}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(conversation)
                }
              }}
            >
              
              <div className="conversation-avatar">
                <div className="avatar-initials">
                  {conversation.title.charAt(0).toUpperCase()}
                </div>
                {conversation.unread && <div className="unread-dot" />}
              </div>
              
              <div className="conversation-content">
                <div className="conversation-header-row">
                  {editingId === conversation.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={handleKeyPress}
                      onBlur={handleSaveRename}
                      className="edit-title-input"
                      autoFocus
                    />
                  ) : (
                    <span className="conversation-title-text">
                      {conversation.title}
                      {conversation.pinned && <Pin size={12} className="pin-icon" />}
                    </span>
                  )}
                  <div className="conversation-actions">
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPin(conversation.id)
                      }}
                      aria-label="Pin conversation"
                    >
                      <Pin size={12} />
                    </button>
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRename(conversation.id)
                      }}
                      aria-label="Rename conversation"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  </div>
                </div>
                <p className="conversation-preview">{conversation.lastMessage}</p>
                <span className="conversation-time">{conversation.timestamp}</span>
              </div>
            </div>
          ))
        )}
        
        {showScrollToTop && (
          <button
            className="scroll-to-top-button"
            onClick={scrollToTop}
            aria-label="Scroll to top"
          >
            <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>

      <style jsx>{`
        .conversation-list {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--panel-2);
          border-right: 1px solid var(--border);
        }

        .conversation-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
        }

        .conversation-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0;
        }

        .search-section {
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
        }

        .search-wrapper {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: var(--space-3);
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          z-index: 1;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: var(--space-2) var(--space-3) var(--space-2) calc(var(--space-3) + 22px);
          background-color: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: var(--radius-md);
          color: var(--input-text);
          font-size: var(--text-sm);
          box-sizing: border-box;
          outline: none;
          transition: border-color var(--transition-fast);
        }
        
        .search-input:focus {
          border-color: var(--brand);
        }
        
        .search-input::placeholder {
          color: var(--text-muted);
          opacity: 1;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--focus-ring);
          box-shadow: 0 0 0 2px var(--focus-ring);
        }

        .filter-tabs {
          display: flex;
          padding: var(--space-2) var(--space-4);
          gap: var(--space-1);
          border-bottom: 1px solid var(--border);
        }

        .filter-tab {
          padding: var(--space-1) var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .filter-tab:hover {
          background-color: var(--hover-bg);
          color: var(--text);
        }

        .filter-tab.active {
          background-color: var(--brand-100);
          color: var(--brand);
        }

        .conversations-container {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-2);
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }

        .conversations-container::-webkit-scrollbar {
          width: 6px;
        }

        .conversations-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .conversations-container::-webkit-scrollbar-thumb {
          background-color: var(--border);
          border-radius: 3px;
        }

        .conversations-container::-webkit-scrollbar-thumb:hover {
          background-color: var(--text-muted);
        }

        .conversation-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-bottom: var(--space-2);
          position: relative;
        }

        .conversation-item:hover {
          background-color: var(--hover-bg);
          transform: translateY(-1px);
        }

        .conversation-item.selected {
          background-color: var(--hi-bg);
          border-left: 3px solid var(--brand);
        }
        
        [data-theme="dark"] .conversation-item.selected {
          background-color: var(--hi-bg);
        }

        .conversation-item.unread {
          background-color: var(--brand-50);
        }

        .conversation-avatar {
          position: relative;
          flex-shrink: 0;
        }

        .avatar-initials {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--brand-100);
          color: var(--brand);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .unread-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--brand);
        }

        .conversation-content {
          flex: 1;
          min-width: 0;
        }

        .conversation-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-1);
        }

        .conversation-title-text {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .pin-icon {
          color: var(--brand);
        }

        .conversation-actions {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }

        .conversation-item:hover .conversation-actions {
          opacity: 1;
        }

        .action-button {
          background: none;
          border: none;
          padding: var(--space-1);
          cursor: pointer;
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .action-button:hover {
          background-color: var(--hover-bg);
          color: var(--text);
        }

        .edit-title-input {
          background: transparent;
          border: none;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text);
          padding: 0;
          width: 100%;
        }

        .edit-title-input:focus {
          outline: none;
        }

        .conversation-preview {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 0 0 var(--space-1) 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .conversation-time {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
          color: var(--text-muted);
          text-align: center;
        }

        .empty-state p {
          margin: var(--space-2) 0 0 0;
          font-size: var(--text-sm);
        }

        .scroll-to-top-button {
          position: fixed;
          bottom: var(--space-4);
          right: var(--space-4);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--brand);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-lg);
          transition: all var(--transition-fast);
          z-index: var(--z-sticky);
        }

        .scroll-to-top-button:hover {
          background-color: var(--brand-600);
          transform: translateY(-2px);
          box-shadow: var(--shadow-xl);
        }

        .scroll-to-top-button:active {
          transform: translateY(0);
        }

        @media (max-width: 1279px) {
          .conversation-list {
            width: 100%;
            max-width: 400px;
          }
        }
      `}</style>
    </div>
  )
}
