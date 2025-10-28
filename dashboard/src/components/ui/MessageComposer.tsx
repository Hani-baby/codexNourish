import React, { useState, useRef, useEffect } from 'react'
import { Send, Mic, Paperclip, StopCircle, Camera, Video, File as FileIcon } from 'lucide-react'
import Button from './Button'

interface Suggestion {
  id: string
  label: string
}

interface MessageComposerProps {
  onSend: (message: string, attachments?: File[]) => void
  onStop?: () => void
  isStreaming?: boolean
  suggestions?: Suggestion[]
  onSuggestionClick?: (suggestion: Suggestion) => void
  placeholder?: string
  disabled?: boolean
}

export default function MessageComposer({
  onSend,
  onStop,
  isStreaming = false,
  suggestions = [],
  onSuggestionClick,
  placeholder = "Ask Chef Nourish anything about nutrition, recipes, or meal planning...",
  disabled = false
}: MessageComposerProps) {
  const [message, setMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const handleSend = () => {
    if (isRecordingAudio) {
      // Stop recording and send the audio
      mediaRecorderRef.current?.stop()
      setIsRecordingAudio(false)
      return
    }
    
    if ((message.trim() || attachments.length > 0) && !disabled) {
      onSend(message.trim(), attachments)
      setMessage('')
      setAttachments([])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleMicClick = async () => {
    if (!isRecordingAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data)
        }

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          const audioFile = new File([audioBlob], 'voice-message.wav', { type: 'audio/wav' })
          setAttachments(prev => [...prev, audioFile])
          stream.getTracks().forEach(track => track.stop())
        }

        mediaRecorder.start()
        setIsRecordingAudio(true)
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('Unable to access microphone. Please check permissions.')
      }
    } else {
      mediaRecorderRef.current?.stop()
      setIsRecordingAudio(false)
    }
  }

  const handleAttachClick = () => {
    setShowAttachmentMenu(!showAttachmentMenu)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const maxFileSize = 10 * 1024 * 1024 // 10MB limit
    
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`)
        return false
      }
      return true
    })
    
    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles])
    }
    setShowAttachmentMenu(false)
    
    // Reset input value to allow selecting the same file again
    if (event.target) {
      event.target.value = ''
    }
  }

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*'
      fileInputRef.current.capture = 'environment'
      fileInputRef.current.click()
    }
  }

  const handleVideoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'video/*'
      fileInputRef.current.click()
    }
  }

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = '*/*'
      fileInputRef.current.click()
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onSuggestionClick?.(suggestion)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  // Focus textarea when component mounts
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus()
    }
  }, [disabled])

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showAttachmentMenu && target && !target.closest('.attachment-menu-container')) {
        setShowAttachmentMenu(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showAttachmentMenu])

  return (
    <div className="message-composer">
      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className="suggestion-chip"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="attachments-preview">
          {attachments.map((file, index) => (
            <div key={index} className="attachment-item">
              <div className="attachment-icon">
                {file.type.startsWith('image/') ? (
                  <Camera size={12} />
                ) : file.type.startsWith('video/') ? (
                  <Video size={12} />
                ) : file.type.startsWith('audio/') ? (
                  <Mic size={12} />
                ) : (
                  <FileIcon size={12} />
                )}
              </div>
              <span className="attachment-name">{file.name}</span>
              <span className="attachment-size">
                {file.size > 1024 * 1024 
                  ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                  : `${(file.size / 1024).toFixed(0)}KB`
                }
              </span>
              <button
                className="remove-attachment"
                onClick={() => removeAttachment(index)}
                aria-label="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="composer-input">
        <div className="left-actions">
          <div className="attachment-menu-container">
            <button
              className="action-button"
              onClick={handleAttachClick}
              disabled={disabled}
              aria-label="Attach file"
            >
              <Paperclip size={16} />
            </button>
            
            {showAttachmentMenu && (
              <div className="attachment-menu">
                <button
                  className="attachment-option"
                  onClick={handleCameraClick}
                  aria-label="Take photo"
                >
                  <Camera size={16} />
                  <span>Camera</span>
                </button>
                <button
                  className="attachment-option"
                  onClick={handleVideoClick}
                  aria-label="Record video"
                >
                  <Video size={16} />
                  <span>Video</span>
                </button>
                <button
                  className="attachment-option"
                  onClick={handleFileClick}
                  aria-label="Choose file"
                >
                  <FileIcon size={16} />
                  <span>File</span>
                </button>
              </div>
            )}
          </div>
          
          <button
            className={`action-button mic-button ${isRecordingAudio ? 'recording' : ''}`}
            onClick={handleMicClick}
            disabled={disabled}
            aria-label="Voice recording"
          >
            <Mic size={16} />
          </button>
        </div>
        
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="message-textarea"
            rows={1}
            disabled={disabled}
          />
        </div>
        
        <div className="right-actions">
          {isStreaming && onStop && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<StopCircle size={16} />}
              onClick={onStop}
            >
              Stop
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && attachments.length === 0 && !isRecordingAudio) || disabled}
            leftIcon={isRecordingAudio ? <StopCircle size={16} /> : <Send size={16} />}
          >
            {isRecordingAudio ? 'Stop & Send' : 'Send'}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple
      />
      
      <style jsx>{`
        .message-composer {
          padding: var(--space-4);
          border-top: 1px solid var(--border);
          background-color: var(--panel);
          position: sticky;
          bottom: 0;
          z-index: var(--z-sticky);
        }
        
        .suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }
        
        .suggestion-chip {
          padding: var(--space-1) var(--space-3);
          background-color: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text);
          font-size: var(--text-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        
        .suggestion-chip:hover {
          background-color: var(--hover-bg);
          border-color: var(--brand);
        }

        .attachments-preview {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .attachment-item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background-color: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
        }

        .attachment-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .attachment-size {
          color: var(--text-muted);
          font-size: var(--text-xs);
          flex-shrink: 0;
        }

        .attachment-name {
          color: var(--text);
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .remove-attachment {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: var(--text-lg);
          line-height: 1;
          padding: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .remove-attachment:hover {
          background-color: var(--hover-bg);
          color: var(--danger);
        }
        
        .composer-input {
          display: flex;
          align-items: flex-end;
          gap: var(--space-3);
          background-color: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          transition: all var(--transition-fast);
        }
        
        .composer-input:focus-within {
          border-color: var(--focus-ring);
          box-shadow: 0 0 0 2px var(--focus-ring);
        }
        
        .left-actions {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          flex-shrink: 0;
        }

        .attachment-menu-container {
          position: relative;
        }

        .attachment-menu {
          position: absolute;
          bottom: 100%;
          left: 0;
          background-color: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: var(--space-2);
          z-index: var(--z-dropdown);
          min-width: 120px;
        }

        .attachment-option {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: var(--space-2) var(--space-3);
          background: none;
          border: none;
          color: var(--text);
          font-size: var(--text-sm);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .attachment-option:hover {
          background-color: var(--hover-bg);
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
        
        .action-button:hover:not(:disabled) {
          background-color: var(--hover-bg);
          color: var(--text);
        }
        
        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .mic-button.recording {
          color: var(--danger);
          animation: pulse 2s infinite;
        }

        .mic-button.recording::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          background-color: var(--danger);
          border-radius: 50%;
          animation: pulse 1s infinite;
        }

        .mic-button.recording {
          position: relative;
        }

        .mic-button.recording::before {
          content: 'Recording...';
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--panel);
          color: var(--danger);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          white-space: nowrap;
          margin-bottom: var(--space-1);
          border: 1px solid var(--border);
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .input-wrapper {
          flex: 1;
          min-width: 0;
        }
        
        .message-textarea {
          width: 100%;
          background: transparent;
          border: none;
          resize: none;
          font-size: var(--text-sm);
          color: var(--text);
          min-height: 20px;
          max-height: 120px;
          line-height: 1.5;
          font-family: inherit;
        }
        
        .message-textarea::placeholder {
          color: var(--text-muted);
        }
        
        .message-textarea:focus {
          outline: none;
        }
        
        .message-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .right-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        
        @media (max-width: 767px) {
          .message-composer {
            padding: var(--space-3);
            padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
          }
          
          .composer-input {
            padding: var(--space-2);
          }
          
          .suggestions {
            gap: var(--space-1);
          }
          
          .suggestion-chip {
            padding: var(--space-1) var(--space-2);
            font-size: var(--text-xs);
          }
          
          .left-actions,
          .right-actions {
            gap: var(--space-1);
          }
          
          .action-button {
            padding: var(--space-1);
          }

          .attachment-menu {
            position: fixed;
            bottom: 80px;
            left: var(--space-3);
            right: var(--space-3);
            min-width: auto;
            max-width: 200px;
          }

          .attachment-name {
            max-width: 100px;
          }
        }
      `}</style>
    </div>
  )
}
