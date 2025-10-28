import React, { useState } from 'react'
import { Pin, MoreHorizontal, Edit3, Download, Trash2, Menu } from 'lucide-react'
import Button from './Button'

interface ChatHeaderProps {
  title: string
  subtitle?: string
  isPinned?: boolean
  isStreaming?: boolean
  onRename?: (title: string) => void
  onPin?: () => void
  onExport?: () => void
  onDelete?: () => void
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export default function ChatHeader({
  title,
  subtitle = "Chat with Chef Nourish AI",
  isPinned = false,
  isStreaming = false,
  onRename,
  onPin,
  onExport,
  onDelete,
  onMenuClick,
  showMenuButton = false
}: ChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)

  const handleRename = () => {
    if (isEditing && editTitle.trim()) {
      onRename?.(editTitle.trim())
      setIsEditing(false)
    } else {
      setIsEditing(true)
      setEditTitle(title)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditTitle(title)
    }
  }

  return (
    <div className="chat-header">
      <div className="header-left">
        {showMenuButton && (
          <button
            className="menu-button"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        )}
        
        <div className="chat-info">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleRename}
              className="edit-title-input"
              autoFocus
            />
          ) : (
            <h3 className="chat-title" onClick={onRename ? () => setIsEditing(true) : undefined}>
              {title}
              {isPinned && <Pin size={14} className="pin-icon" />}
            </h3>
          )}
          <p className="chat-subtitle">{subtitle}</p>
        </div>
      </div>
      
      <div className="header-right">
        {isStreaming && (
          <div className="streaming-status">
            <div className="status-dot" />
            <span>Planning...</span>
          </div>
        )}
        
        <div className="header-actions">
          {onRename && (
            <button
              className="action-button"
              onClick={handleRename}
              aria-label="Rename conversation"
            >
              <Edit3 size={16} />
            </button>
          )}
          
          {onPin && (
            <button
              className={`action-button ${isPinned ? 'active' : ''}`}
              onClick={onPin}
              aria-label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
            >
              <Pin size={16} />
            </button>
          )}
          
          {onExport && (
            <button
              className="action-button"
              onClick={onExport}
              aria-label="Export conversation"
            >
              <Download size={16} />
            </button>
          )}
          
          {onDelete && (
            <button
              className="action-button danger"
              onClick={onDelete}
              aria-label="Delete conversation"
            >
              <Trash2 size={16} />
            </button>
          )}
          
          <div className="mobile-menu">
            <button
              className="action-button"
              onClick={() => {
                // In a real app, this would open a dropdown menu
                console.log('Open mobile menu')
              }}
              aria-label="More options"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .chat-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: var(--panel);
          position: sticky;
          top: 0;
          z-index: var(--z-sticky);
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex: 1;
          min-width: 0;
        }
        
        .menu-button {
          display: none;
          background: none;
          border: none;
          padding: var(--space-2);
          cursor: pointer;
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        
        .menu-button:hover {
          background-color: var(--hover-bg);
          color: var(--text);
        }
        
        .chat-info {
          flex: 1;
          min-width: 0;
        }
        
        .chat-title {
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          margin: 0 0 var(--space-1) 0;
          display: flex;
          align-items: center;
          gap: var(--space-1);
          cursor: ${onRename ? 'pointer' : 'default'};
          transition: color var(--transition-fast);
        }
        
        .chat-title:hover {
          color: ${onRename ? 'var(--brand-500)' : 'var(--text)'};
        }
        
        .pin-icon {
          color: var(--brand-500);
        }

        [data-theme="dark"] .pin-icon {
          color: var(--brand-400);
        }
        
        .chat-subtitle {
          font-size: var(--text-sm);
          color: var(--text-muted);
          margin: 0;
        }
        
        .edit-title-input {
          background: transparent;
          border: none;
          font-size: var(--text-lg);
          font-weight: var(--font-semibold);
          color: var(--text);
          padding: 0;
          width: 100%;
          border-bottom: 2px solid var(--brand-500);
        }
        
        .edit-title-input:focus {
          outline: none;
        }
        
        .header-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        
        .streaming-status {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-1) var(--space-3);
          background-color: var(--brand-100);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--brand-500);
        }

        [data-theme="dark"] .streaming-status {
          color: var(--brand-400);
        }
        
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--brand-500);
          animation: pulse 2s infinite;
        }

        [data-theme="dark"] .status-dot {
          background-color: var(--brand-400);
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .header-actions {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }
        
        .action-button {
          background: none;
          border: none;
          padding: var(--space-2);
          cursor: pointer;
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .action-button:hover {
          background-color: var(--hover-bg);
          color: var(--text);
        }
        
        .action-button.active {
          color: var(--brand-500);
          background-color: var(--brand-100);
        }

        [data-theme="dark"] .action-button.active {
          color: var(--brand-400);
        }
        
        .action-button.danger:hover {
          color: var(--danger);
          background-color: var(--danger);
          color: white;
        }
        
        .mobile-menu {
          display: none;
        }
        
        @media (max-width: 1279px) {
          .menu-button {
            display: flex;
          }
        }
        
        @media (max-width: 767px) {
          .chat-header {
            padding: var(--space-3);
          }
          
          .header-left {
            gap: var(--space-2);
          }
          
          .chat-title {
            font-size: var(--text-base);
          }
          
          .chat-subtitle {
            font-size: var(--text-xs);
          }
          
          .streaming-status {
            display: none;
          }
          
          .header-actions {
            display: none;
          }
          
          .mobile-menu {
            display: flex;
          }
        }
      `}</style>
    </div>
  )
}
