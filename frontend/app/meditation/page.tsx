'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { ParticleBackground } from '@/components/zen/ParticleBackground'
import { Navigation } from '@/components/zen/Navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface MeditationStage {
  id: string
  name: string
  duration: number
  icon: string
  description: string
}

export default function Meditation() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(10) // minutes
  const [timeRemaining, setTimeRemaining] = useState(600) // seconds
  const [isMuted, setIsMuted] = useState(false)
  const [currentStage, setCurrentStage] = useState(0)
  const [stages, setStages] = useState<MeditationStage[]>([])
  const [currentLine, setCurrentLine] = useState('')
  const [captionHistory, setCaptionHistory] = useState<string[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [lineIndex, setLineIndex] = useState(0) // Track line index for unique keys

  const audioRef = useRef<HTMLAudioElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const maxHistoryLines = 5 // Show last 5 lines for context

  const durations = [5, 10, 15, 20, 30]

  // Fetch meditation stages on mount
  useEffect(() => {
    fetch(`${API_URL}/api/meditation/stages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stages) {
          setStages(data.stages)
        }
      })
      .catch((err) => console.error('Failed to fetch meditation stages:', err))
  }, [])

  // Update time remaining when duration changes
  useEffect(() => {
    setTimeRemaining(duration * 60)
  }, [duration])

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => prev - 1)
      }, 1000)
    } else if (timeRemaining === 0) {
      setIsPlaying(false)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
    return () => clearInterval(interval)
  }, [isPlaying, timeRemaining])

  // Stream meditation content for current stage
  useEffect(() => {
    if (isPlaying && stages.length > 0) {
      const stageIndex = Math.floor((duration * 60 - timeRemaining) / (duration * 60 / 5)) // 5 stages
      if (stageIndex !== currentStage && stageIndex < 5) {
        setCurrentStage(stageIndex)
        startStreamingStage(stageIndex)
      }
    }
  }, [isPlaying, timeRemaining, duration, stages, currentStage])

  const startStreamingStage = (stageIndex: number) => {
    // Close existing stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Clear previous content and reset line index
    setCurrentLine('')
    setCaptionHistory([])
    setLineIndex(0)

    const stageIds = ['welcome', 'breathing', 'bodyscan', 'visualization', 'closing']
    const stageId = stageIds[stageIndex] || 'welcome'

    setIsLoadingContent(true)
    console.log(`[MEDITATION] Starting stream for stage: ${stageId}`)

    // Start Server-Sent Events stream
    const eventSource = new EventSource(`${API_URL}/api/meditation/stream/${stageId}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'line') {
          console.log(`[MEDITATION DEBUG] Received line ${data.index}/${data.total}: "${data.content}"`)

          // Increment line index for unique keys
          setLineIndex((prev) => prev + 1)

          // Move current line to history BEFORE setting new line
          setCurrentLine((prevLine) => {
            console.log(`[MEDITATION DEBUG] Previous line: "${prevLine}"`)

            if (prevLine && prevLine.trim()) {
              // Use setTimeout to ensure this happens after render
              setTimeout(() => {
                setCaptionHistory((prevHistory) => {
                  console.log(`[MEDITATION DEBUG] History before: [${prevHistory.join(' | ')}]`)
                  // Check if line already exists to prevent duplicates
                  if (prevHistory.includes(prevLine)) {
                    console.log(`[MEDITATION DEBUG] ⚠️ Line already in history, skipping`)
                    return prevHistory
                  }
                  const newHistory = [...prevHistory, prevLine]
                  const trimmedHistory = newHistory.slice(-maxHistoryLines)
                  console.log(`[MEDITATION DEBUG] History after: [${trimmedHistory.join(' | ')}]`)
                  return trimmedHistory
                })
              }, 0)
            }

            console.log(`[MEDITATION DEBUG] New current line: "${data.content}"`)
            return data.content
          })
          setIsLoadingContent(false)
        } else if (data.type === 'complete') {
          console.log(`[MEDITATION] Stage ${data.stage_id} complete`)
          // Don't close yet, let stage transition handle it
        } else if (data.type === 'error') {
          console.error('[MEDITATION] Stream error:', data.message)
          setCurrentLine('Breathe... and be here... just as you are.')
          setIsLoadingContent(false)
        }
      } catch (err) {
        console.error('[MEDITATION] Failed to parse stream data:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('[MEDITATION] EventSource error:', err)
      eventSource.close()
      setIsLoadingContent(false)
    }
  }

  // Cleanup stream on unmount or stop
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (!isPlaying && eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [isPlaying])

  // Audio player control
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch((err) => console.error('Audio playback failed:', err))
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause()
    }
  }, [isPlaying])

  // Mute control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted
    }
  }, [isMuted])

  const togglePlay = () => {
    if (timeRemaining === 0) {
      setTimeRemaining(duration * 60)
      setCurrentStage(0)
      setCurrentLine('')
      setCaptionHistory([])
      setLineIndex(0)
    }
    setIsPlaying(!isPlaying)

    // Start streaming when starting
    if (!isPlaying && currentLine === '') {
      startStreamingStage(0)
    }
  }

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const progress = 1 - timeRemaining / (duration * 60)

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navigation />

      {/* Audio player for background music */}
      <audio
        ref={audioRef}
        loop
        preload="auto"
        src="/audio/meditation-ambient.mp3"
      />

      <div className="ml-20 relative z-10">
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-20 py-16">
          {/* Animated Background Waves */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 50% 50%, rgba(168, 201, 195, ${
                    0.05 + i * 0.03
                  }) 0%, transparent 70%)`,
                }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{
                  duration: 10 + i * 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 2,
                }}
              />
            ))}
          </div>

          {/* Breathing Particles */}
          {isPlaying && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: 'rgba(168, 201, 195, 0.5)',
                    left: '50%',
                    top: '50%',
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos((i * Math.PI * 2) / 8) * 200,
                    y: Math.sin((i * Math.PI * 2) / 8) * 200,
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: (i * 6) / 8,
                  }}
                />
              ))}
            </div>
          )}

          {/* Main Content - Compact */}
          <div className="relative z-10 text-center w-full max-w-2xl">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="mb-6"
            >
              Meditation
            </motion.h2>

            {/* Breathing Circle - Smaller */}
            <motion.div
              className="relative w-64 h-64 mx-auto mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              {/* Outer ring */}
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(168, 201, 195, 0.2)"
                  strokeWidth="0.5"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--color-teal)"
                  strokeWidth="0.5"
                  strokeDasharray="283"
                  strokeDashoffset={283 * (1 - progress)}
                  strokeLinecap="round"
                  transition={{ duration: 0.5 }}
                />
              </svg>

              {/* Inner breathing circle - Smaller */}
              <motion.div
                className="absolute inset-0 m-auto rounded-full"
                style={{
                  width: '160px',
                  height: '160px',
                  background: 'rgba(168, 201, 195, 0.15)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(168, 201, 195, 0.3)',
                }}
                animate={
                  isPlaying
                    ? {
                        scale: [1, 1.15, 1],
                      }
                    : { scale: 1 }
                }
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Time Display - Smaller */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="text-4xl font-light"
                  style={{ color: 'var(--color-teal)' }}
                  animate={isPlaying ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </motion.div>
              </div>
            </motion.div>

            {/* Guided Captions - Compact */}
            <div className="mb-6 h-[160px] flex items-end justify-center px-8 overflow-hidden">
              <AnimatePresence mode="wait">
                {isPlaying && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center max-w-2xl w-full relative pb-4"
                  >
                    <div className="relative flex flex-col items-center justify-end">
                      {/* All lines container - scrolls upward */}
                      <AnimatePresence mode="popLayout">
                        {/* Previous lines - faded for context */}
                        {captionHistory.map((line, index) => {
                          const historyStartIndex = lineIndex - captionHistory.length
                          return (
                            <motion.p
                              key={`history-${historyStartIndex + index}`}
                              layout
                              initial={{ opacity: 0, y: 40 }}
                              animate={{
                                opacity: 0.25 + (index / captionHistory.length) * 0.15,
                                y: 0,
                              }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{
                                layout: { duration: 0.6, ease: 'easeInOut' },
                                opacity: { duration: 0.5 },
                                y: { duration: 0.6, ease: 'easeOut' },
                              }}
                              className="text-base font-light mb-2"
                              style={{ color: 'var(--color-text-light)' }}
                            >
                              {line}
                            </motion.p>
                          )
                        })}

                        {/* Current line - highlighted and centered */}
                        {currentLine && (
                          <motion.p
                            key={`current-${lineIndex}`}
                            layout
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{
                              layout: { duration: 0.6, ease: 'easeInOut' },
                              opacity: { duration: 0.8 },
                              y: { duration: 0.6, ease: 'easeOut' },
                              scale: { duration: 0.6 },
                            }}
                            className="text-xl font-light leading-relaxed mb-2"
                            style={{ color: 'var(--color-teal)' }}
                          >
                            {currentLine}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      {/* Loading indicator */}
                      {!currentLine && isLoadingContent && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.6 }}
                          className="text-lg font-light"
                          style={{ color: 'var(--color-text-light)' }}
                        >
                          Preparing guidance...
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls - Compact */}
            <div className="h-12 flex items-center justify-center gap-4">
              <AnimatePresence mode="wait">
                {!isPlaying && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex gap-2"
                  >
                    {durations.map((d) => (
                      <motion.button
                        key={d}
                        onClick={() => setDuration(d)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-2 text-sm rounded-full transition-all duration-500"
                        style={{
                          background:
                            duration === d
                              ? 'rgba(168, 201, 195, 0.3)'
                              : 'rgba(168, 201, 195, 0.1)',
                          color:
                            duration === d ? 'var(--color-teal)' : 'var(--color-text-light)',
                          border: `1px solid ${
                            duration === d
                              ? 'rgba(168, 201, 195, 0.5)'
                              : 'rgba(168, 201, 195, 0.2)'
                          }`,
                        }}
                      >
                        {d} min
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                onClick={togglePlay}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(168, 201, 195, 0.3)',
                  border: '1px solid rgba(168, 201, 195, 0.4)',
                }}
              >
                {isPlaying ? (
                  <Pause size={20} strokeWidth={1.5} style={{ color: 'var(--color-teal)' }} />
                ) : (
                  <Play
                    size={20}
                    strokeWidth={1.5}
                    style={{ color: 'var(--color-teal)', marginLeft: '2px' }}
                  />
                )}
              </motion.button>

              <motion.button
                onClick={() => setIsMuted(!isMuted)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(168, 201, 195, 0.2)',
                  border: '1px solid rgba(168, 201, 195, 0.3)',
                }}
              >
                {isMuted ? (
                  <VolumeX
                    size={18}
                    strokeWidth={1.5}
                    style={{ color: 'var(--color-text-light)' }}
                  />
                ) : (
                  <Volume2 size={18} strokeWidth={1.5} style={{ color: 'var(--color-teal)' }} />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
