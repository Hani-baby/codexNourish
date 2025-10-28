import React from 'react'
import { User, Bot } from 'lucide-react'

interface MessageAction {
  id: string
  label: string
  variant: 'brand' | 'ghost'
}

interface MessageBubbleProps {
  type: 'user' | 'assistant'
  content: string | undefined | null
  timestamp: string
  attachments?: File[]
  actions?: MessageAction[]
  onAction?: (actionId: string) => void
  isStreaming?: boolean
  isLastInGroup?: boolean
  meta?: any
}

// Simple markdown parser for basic formatting
const parseMarkdown = (text: string | undefined | null) => {
  // Handle null, undefined, or empty text
  if (!text) {
    return ''
  }
  
  // Bold text: **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  
  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Code blocks: `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // Line breaks
  text = text.replace(/\n/g, '<br />')
  
  return text
}

export default function MessageBubble({
  type,
  content,
  timestamp,
  attachments,
  actions,
  onAction,
  isStreaming = false,
  isLastInGroup = true,
  meta
}: MessageBubbleProps) {
  const parsedContent = parseMarkdown(content)
  const card = meta?.card
  
  return (
    <div className={`message-bubble ${type} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-avatar">
        {type === 'assistant' ? (
          <div className="ai-avatar">
            <img 
              src="/mascot.png" 
              alt="Chef Nourish" 
              className="nourish-mascot"
              width={16}
              height={16}
            />
            <div className="availability-dot" />
          </div>
        ) : (
          <div className="user-avatar">
            <User size={16} />
          </div>
        )}
      </div>
      
      <div className="message-content">
        {card && (
          <div className="message-card">
            {card.card_type === 'plan_preview' && (
              <div className="plan-card">
                <div className="plan-card-header">Meal plan ready</div>
                <div className="plan-card-body">
                  <div className="plan-card-row">
                    <span>Plan ID</span>
                    <code>{card.meal_plan_id}</code>
                  </div>
                  {card.grocery_list_id && (
                    <div className="plan-card-row">
                      <span>Grocery list</span>
                      <code>{card.grocery_list_id}</code>
                    </div>
                  )}
                </div>
                <div className="plan-card-actions">
                  <a className="cta" href={`/plans?plan_id=${card.meal_plan_id}`}>View plan</a>
                  {card.grocery_list_id && (
                    <a className="cta ghost" href={`/groceries?list_id=${card.grocery_list_id}`}>View groceries</a>
                  )}
                </div>
              </div>
            )}
            {card.card_type === 'recipe_card' && (
              <div className="recipe-card">
                <div className="recipe-card-header">Recipe created</div>
                <div className="recipe-card-body">
                  <div className="recipe-card-row">
                    <span>Recipe ID</span>
                    <code>{card.recipe_id}</code>
                  </div>
                </div>
                <div className="recipe-card-actions">
                  <a className="cta" href={`/recipes?recipe_id=${card.recipe_id}`}>Open recipe</a>
                </div>
              </div>
            )}
            {card.card_type === 'grocery_summary' && (
              <div className="grocery-card">
                <div className="plan-card-header">Grocery list ready</div>
                <div className="plan-card-body">
                  <div className="plan-card-row">
                    <span>List ID</span>
                    <code>{card.grocery_list_id}</code>
                  </div>
                </div>
                <div className="plan-card-actions">
                  <a className="cta" href={`/groceries?list_id=${card.grocery_list_id}`}>Open list</a>
                </div>
              </div>
            )}
          </div>
        )}

        {(parsedContent || (attachments && attachments.length === 0)) && !card && (
          <div 
            className="message-text"
            dangerouslySetInnerHTML={{ __html: parsedContent || '<em>No content</em>' }}
          />
        )}
        
        {attachments && attachments.length > 0 && (
          <div className="message-attachments">
            {attachments.map((file, index) => (
              <div key={index} className="attachment-item">
                {file.type.startsWith('audio/') ? (
                  <div className="audio-attachment">
                    <audio controls className="audio-player">
                      <source src={URL.createObjectURL(file)} type={file.type} />
                      Your browser does not support the audio element.
                    </audio>
                    <span className="attachment-name">{file.name}</span>
                  </div>
                ) : file.type.startsWith('image/') ? (
                  <div className="image-attachment">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="attachment-image"
                    />
                    <span className="attachment-name">{file.name}</span>
                  </div>
                ) : (
                  <div className="file-attachment">
                    <span className="attachment-name">{file.name}</span>
                    <span className="attachment-size">
                      {file.size > 1024 * 1024 
                        ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                        : `${(file.size / 1024).toFixed(0)}KB`
                      }
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {actions && type === 'assistant' && (
          <div className="message-actions">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => onAction?.(action.id)}
                className={`action-chip ${action.variant}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        
        {isLastInGroup && (
          <span className="message-timestamp">
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
      </div>
      
      {isStreaming && (
        <div className="streaming-caret">
          <div className="caret" />
        </div>
      )}
      
      <style jsx>{`
        .message-bubble {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
          position: relative;
        }
        
        .message-bubble.user {
          flex-direction: row-reverse;
        }
        
        .message-avatar {
          flex-shrink: 0;
          position: relative;
        }
        
        .ai-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--brand-100) 0%, var(--panel-2) 100%);
          color: var(--brand);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        
        .nourish-mascot {
          width: 20px;
          height: 20px;
          object-fit: contain;
          border-radius: 50%;
        }
        
        .availability-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--success);
          border: 2px solid var(--panel);
        }
        
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--panel-2);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .message-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-width: 720px;
        }

        .message-card {
          background-color: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .plan-card-header, .recipe-card-header {
          font-weight: var(--font-semibold);
          color: var(--text);
        }
        .plan-card-row, .recipe-card-row {
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
          font-size: var(--text-sm);
          color: var(--text);
        }
        .plan-card-actions, .recipe-card-actions {
          display: flex;
          gap: var(--space-2);
        }
        .cta {
          background-color: var(--brand);
          border: none;
          color: white;
          padding: 6px 10px;
          border-radius: var(--radius-md);
          text-decoration: none;
        }
        .cta.ghost {
          background-color: transparent;
          color: var(--brand);
          border: 1px solid var(--brand);
        }
        
        .message-bubble.user .message-content {
          align-items: flex-end;
        }
        
        .message-text {
          background-color: var(--panel-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          line-height: 1.6;
          color: var(--text);
          position: relative;
        }
        
        .message-bubble.user .message-text {
          background-color: var(--brand);
          color: white;
          font-weight: var(--font-medium);
        }
        
        .message-text :global(strong) {
          font-weight: var(--font-semibold);
          color: var(--brand);
        }
        
        .message-text :global(code) {
          background-color: var(--panel);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: var(--text-xs);
          color: var(--text);
        }
        
        .message-text :global(a) {
          color: var(--brand);
          text-decoration: none;
        }
        
        .message-text :global(a:hover) {
          text-decoration: underline;
        }
        
        .message-attachments {
          margin-top: var(--space-2);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        
        .attachment-item {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        
        .audio-attachment {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        
        .audio-player {
          width: 100%;
          max-width: 300px;
          height: 32px;
          border-radius: var(--radius-md);
          background-color: var(--panel);
          border: 1px solid var(--border);
        }
        
        .image-attachment {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        
        .attachment-image {
          max-width: 200px;
          max-height: 200px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          object-fit: cover;
        }
        
        .file-attachment {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-2);
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        
        .attachment-name {
          font-size: var(--text-xs);
          color: var(--text-muted);
          word-break: break-word;
        }
        
        .attachment-size {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        
        .message-actions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        
        .action-chip {
          padding: var(--space-1) var(--space-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .action-chip.brand {
          background-color: var(--brand);
          color: white;
          border-color: var(--brand);
        }
        
        .action-chip.brand:hover {
          background-color: var(--brand-600);
        }
        
        .action-chip.ghost:hover {
          background-color: var(--hover-bg);
          border-color: var(--brand);
        }
        
        .message-timestamp {
          font-size: var(--text-xs);
          color: var(--text-muted);
          padding: 0 var(--space-2);
        }
        
        .streaming-caret {
          display: flex;
          align-items: center;
          margin-left: var(--space-2);
        }
        
        .caret {
          width: 2px;
          height: 16px;
          background-color: var(--brand);
          animation: blink 1s infinite;
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .message-bubble.streaming .message-text {
          background: linear-gradient(135deg, var(--panel-2) 0%, var(--panel) 100%);
        }
        
        @media (max-width: 767px) {
          .message-content {
            max-width: 100%;
          }
          
          .message-text {
            padding: var(--space-2) var(--space-3);
          }
          
          .message-actions {
            gap: var(--space-1);
          }
          
          .action-chip {
            padding: var(--space-1) var(--space-2);
            font-size: var(--text-xs);
          }
        }
      `}</style>
    </div>
  )
}
