'use client'

import { motion } from 'framer-motion'
import { AgentAvatar } from './AgentAvatar'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  agent?: string
}

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto space-y-6 p-6">
      {messages.map((message, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`flex gap-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          {message.role === 'assistant' && (
            <AgentAvatar agent={message.agent || 'orchestrator'} />
          )}

          <div
            className={`max-w-2xl p-4 rounded-lg border ${
              message.role === 'user'
                ? 'border-terminal-accent bg-terminal-accent/10'
                : 'border-terminal-muted bg-terminal-muted/5'
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>

          {message.role === 'user' && (
            <div className="w-10 h-10 rounded-full border border-terminal-accent flex items-center justify-center">
              <span className="text-sm">YOU</span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
