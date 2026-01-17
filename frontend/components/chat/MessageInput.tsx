'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface MessageInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-terminal-muted p-6">
      <div className="flex gap-4">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={disabled}
          className="flex-1 bg-transparent border border-terminal-muted px-4 py-3 rounded focus:outline-none focus:border-terminal-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="px-6 py-3 border border-terminal-accent bg-terminal-accent/10 hover:bg-terminal-accent hover:text-terminal-bg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          SEND
        </button>
      </div>
    </form>
  )
}
