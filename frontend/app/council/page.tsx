'use client'

import { useState } from 'react'
import { MessageList, Message } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { Terminal } from 'lucide-react'

export default function CouncilPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Welcome to The Council. I am here to help you navigate your thoughts and emotions. How are you feeling today?',
      agent: 'orchestrator',
    },
  ])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async (content: string) => {
    // Add user message
    const userMessage: Message = { role: 'user', content }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Call the API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          user_id: 'demo-user', // Hardcoded for hackathon
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      console.log('[COUNCIL] Received data:', data)
      console.log('[COUNCIL] Message content:', data.message.content)
      console.log('[COUNCIL] Content length:', data.message.content.length)

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message.content,
        agent: data.agent,
      }
      console.log('[COUNCIL] Assistant message:', assistantMessage)
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please make sure the backend is running.',
          agent: 'orchestrator',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-terminal-muted p-6">
        <div className="flex items-center gap-4">
          <Terminal className="w-8 h-8 terminal-glow" />
          <div>
            <h1 className="text-2xl font-bold terminal-glow">THE COUNCIL</h1>
            <p className="text-sm text-terminal-muted">Your Digital Twin and Agents</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <MessageList messages={messages} />

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
