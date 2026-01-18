'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send } from 'lucide-react'
import { ParticleBackground } from '@/components/zen/ParticleBackground'
import { Navigation } from '@/components/zen/Navigation'

interface Message {
  id: number
  type: 'user' | 'ai'
  text: string
  insight?: string
  agent?: string
  mentor?: MentorInfo
}

interface MentorInfo {
  id?: string
  name: string
  title: string
  era: string
  expertise?: string[]
  philosophy?: string
  life_story?: string
  notable_works?: string[]
  signature_quote?: string
}

interface MentorOption extends MentorInfo {
  id: string
}

export default function Counsel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'ai',
      text: "I'm here to listen. What's on your mind?",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeMentor, setActiveMentor] = useState<MentorInfo | null>(null)
  const [mentorOptions, setMentorOptions] = useState<MentorOption[]>([])
  const [showMentorPicker, setShowMentorPicker] = useState(false)
  const [selectedMentorId, setSelectedMentorId] = useState('')
  const [isMentorUpdating, setIsMentorUpdating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const loadMentors = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/mentors`)
        if (!response.ok) {
          throw new Error('Failed to load mentors')
        }
        const data = await response.json()
        setMentorOptions(data.mentors ?? [])
      } catch (error) {
        console.error('Error loading mentors:', error)
      }
    }

    loadMentors()
  }, [])

  useEffect(() => {
    if (!activeMentor || mentorOptions.length === 0) return
    const matched = mentorOptions.find((option) => option.name === activeMentor.name)
    if (matched) {
      setSelectedMentorId(matched.id)
    }
  }, [activeMentor, mentorOptions])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      text: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          user_id: 'demo-user',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      const mentorInfo = data.message.mentor ?? data.mentor ?? undefined

      const aiMessage: Message = {
        id: messages.length + 2,
        type: 'ai',
        text: data.message.content,
        insight: data.message.insight,
        agent: data.agent,
        mentor: mentorInfo,
      }

      if (mentorInfo) {
        setActiveMentor(mentorInfo)
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: messages.length + 2,
        type: 'ai',
        text: 'I apologize, but I encountered an issue. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectMentor = async () => {
    if (!selectedMentorId || isMentorUpdating) return
    setIsMentorUpdating(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/mentor/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mentor_id: selectedMentorId,
          user_id: 'demo-user',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to change mentor')
      }

      const data = await response.json()
      if (data.mentor) {
        setActiveMentor(data.mentor)
        setShowMentorPicker(false)
      }
    } catch (error) {
      console.error('Error changing mentor:', error)
    } finally {
      setIsMentorUpdating(false)
    }
  }

  const handleExitMentor = async () => {
    if (isMentorUpdating) return
    setIsMentorUpdating(true)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/mentor/exit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'demo-user',
        }),
      })
      setActiveMentor(null)
      setShowMentorPicker(false)
      setSelectedMentorId('')
    } catch (error) {
      console.error('Error exiting mentor mode:', error)
    } finally {
      setIsMentorUpdating(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navigation />

      <div className="ml-20 relative z-10">
        <div className="min-h-screen flex items-center justify-center px-16 py-10">
          <div className="max-w-5xl w-full h-[92vh] flex flex-col">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="mb-8 flex items-center justify-between"
            >
              <div>
                <h2 className="mb-2">Counsel</h2>
                <p style={{ color: 'var(--color-text-light)' }}>
                  A space for reflection and understanding
                </p>
              </div>
            </motion.div>

            {activeMentor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-4 p-4 rounded-2xl"
                style={{
                  background: 'rgba(212, 201, 224, 0.18)',
                  border: '1px solid rgba(212, 201, 224, 0.25)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(212, 201, 224, 0.3)',
                    }}
                  >
                    <span className="text-lg">🧭</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm mb-1"
                      style={{ color: 'var(--color-lavender)' }}
                    >
                      Wise Mentor Connected
                    </h3>
                    <p className="text-sm serif truncate" style={{ color: 'var(--color-text-light)' }}>
                      {activeMentor.name} — {activeMentor.title} ({activeMentor.era})
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-light)' }}>
                      You are now speaking with a mentor who has lived through similar experiences.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {activeMentor.expertise && activeMentor.expertise.length > 0 && (
                        <span
                          className="text-[11px] px-2 py-1 rounded-full"
                          style={{
                            background: 'rgba(212, 201, 224, 0.25)',
                            color: 'var(--color-lavender)',
                            border: '1px solid rgba(212, 201, 224, 0.35)',
                          }}
                        >
                          {activeMentor.expertise.slice(0, 2).join(' · ')}
                        </span>
                      )}
                      {activeMentor.notable_works && activeMentor.notable_works.length > 0 && (
                        <span
                          className="text-[11px] px-2 py-1 rounded-full"
                          style={{
                            background: 'rgba(168, 201, 195, 0.2)',
                            color: 'var(--color-teal)',
                            border: '1px solid rgba(168, 201, 195, 0.3)',
                          }}
                        >
                          {activeMentor.notable_works[0]}
                        </span>
                      )}
                    </div>
                    {activeMentor.signature_quote && (
                      <p className="text-xs mt-2 italic" style={{ color: 'var(--color-text-light)' }}>
                        "{activeMentor.signature_quote}"
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowMentorPicker((prev) => !prev)}
                        className="text-xs px-3 py-2 rounded-full"
                        style={{
                          background: 'rgba(212, 201, 224, 0.25)',
                          color: 'var(--color-lavender)',
                          border: '1px solid rgba(212, 201, 224, 0.35)',
                        }}
                      >
                        Change mentor
                      </button>
                      <button
                        type="button"
                        onClick={handleExitMentor}
                        className="text-xs px-3 py-2 rounded-full"
                        style={{
                          background: 'rgba(168, 201, 195, 0.25)',
                          color: 'var(--color-teal)',
                          border: '1px solid rgba(168, 201, 195, 0.35)',
                        }}
                      >
                        Exit mentor mode
                      </button>
                    </div>
                    {showMentorPicker && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <select
                          value={selectedMentorId}
                          onChange={(event) => setSelectedMentorId(event.target.value)}
                          className="text-xs px-3 py-2 rounded-full bg-transparent outline-none"
                          style={{
                            background: 'rgba(255, 255, 255, 0.7)',
                            border: '1px solid rgba(168, 201, 195, 0.3)',
                          }}
                        >
                          <option value="" disabled>
                            Choose a mentor
                          </option>
                          {mentorOptions.map((mentor) => (
                            <option key={mentor.id} value={mentor.id}>
                              {mentor.name} — {mentor.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleSelectMentor}
                          disabled={!selectedMentorId || isMentorUpdating}
                          className="text-xs px-3 py-2 rounded-full disabled:opacity-50"
                          style={{
                            background: 'rgba(212, 201, 224, 0.3)',
                            color: 'var(--color-lavender)',
                            border: '1px solid rgba(212, 201, 224, 0.4)',
                          }}
                        >
                          Confirm change
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              className="flex-1 min-h-[52vh] overflow-y-auto mb-4 p-8 rounded-3xl"
              style={{
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(168, 201, 195, 0.2)',
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    className={`mb-8 ${
                      message.type === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block max-w-2xl p-6 rounded-2xl ${
                        message.type === 'ai' && message.mentor ? 'serif' : ''
                      }`}
                      style={{
                        background:
                          message.type === 'user'
                            ? 'rgba(168, 201, 195, 0.2)'
                            : 'rgba(255, 255, 255, 0.6)',
                        border:
                          message.type === 'user'
                            ? '1px solid rgba(168, 201, 195, 0.3)'
                            : '1px solid rgba(168, 201, 195, 0.15)',
                      }}
                    >
                      <p className="text-lg leading-relaxed">{message.text}</p>
                    </div>

                    {message.insight && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="mt-3 px-4 py-2 inline-block rounded-full text-sm"
                        style={{
                          background: 'rgba(212, 201, 224, 0.2)',
                          color: 'var(--color-lavender)',
                          border: '1px solid rgba(212, 201, 224, 0.3)',
                        }}
                      >
                        {message.insight}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-left mb-8"
                  >
                    <div
                      className="inline-block p-6 rounded-2xl"
                      style={{
                        background: 'rgba(255, 255, 255, 0.6)',
                        border: '1px solid rgba(168, 201, 195, 0.15)',
                      }}
                    >
                      <div className="flex gap-2">
                        <span className="w-2 h-2 rounded-full bg-zen-teal animate-pulse" />
                        <span className="w-2 h-2 rounded-full bg-zen-teal animate-pulse delay-100" />
                        <span className="w-2 h-2 rounded-full bg-zen-teal animate-pulse delay-200" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </motion.div>

            <motion.div
              className="flex gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Share what's on your heart..."
                className="flex-1 px-6 py-4 rounded-full text-lg bg-transparent outline-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.6)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(168, 201, 195, 0.2)',
                }}
                disabled={isLoading}
              />
              <motion.button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="px-8 py-4 rounded-full flex items-center gap-2 disabled:opacity-50"
                style={{
                  background: 'rgba(168, 201, 195, 0.3)',
                  color: 'var(--color-teal)',
                  border: '1px solid rgba(168, 201, 195, 0.4)',
                }}
              >
                <Send size={20} strokeWidth={1.5} />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
