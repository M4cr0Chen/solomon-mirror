'use client'

import { useState } from 'react'
import { Circle, Play, Square, Waves } from 'lucide-react'
import Link from 'next/link'

export default function MeditationPage() {
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)

  const startSession = () => {
    console.log('[MEDITATION] Starting session...')
    setIsSessionActive(true)
    setTranscript([])

    try {
      // Connect to WebSocket
      const websocket = new WebSocket('ws://localhost:8000/api/meditation/ws/session')

      websocket.onopen = () => {
        console.log('[MEDITATION] WebSocket connected')
        setTranscript((prev) => [...prev, 'Connected to meditation guide...'])
      }

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[MEDITATION] Received:', data)

          if (data.type === 'transcript') {
            setTranscript((prev) => [...prev, data.text])
          } else if (data.type === 'error') {
            setTranscript((prev) => [...prev, `Error: ${data.message}`])
          }
        } catch (err) {
          console.error('[MEDITATION] Failed to parse message:', err)
        }
      }

      websocket.onerror = (error) => {
        console.error('[MEDITATION] WebSocket error:', error)
        setTranscript((prev) => [
          ...prev,
          'Connection error. Please make sure the backend is running.',
        ])
      }

      websocket.onclose = () => {
        console.log('[MEDITATION] WebSocket closed')
        setIsSessionActive(false)
      }

      setWs(websocket)
    } catch (error) {
      console.error('[MEDITATION] Failed to start session:', error)
      setIsSessionActive(false)
    }
  }

  const stopSession = () => {
    console.log('[MEDITATION] Stopping session...')
    if (ws) {
      ws.close()
      setWs(null)
    }
    setIsSessionActive(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-terminal-muted p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Waves className="w-8 h-8 terminal-glow" />
            <div>
              <h1 className="text-2xl font-bold terminal-glow">MEDITATION SESSION</h1>
              <p className="text-sm text-terminal-muted">
                Real-time guided meditation with AI
              </p>
            </div>
          </div>
          <Link
            href="/council"
            className="px-4 py-2 border border-terminal-muted hover:border-terminal-accent transition-all"
          >
            BACK TO COUNCIL
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8">
          {/* Breathing Orb Placeholder */}
          <div className="flex justify-center">
            <div
              className={`w-64 h-64 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-600/20 border-2 flex items-center justify-center ${
                isSessionActive
                  ? 'border-terminal-accent animate-pulse'
                  : 'border-terminal-muted'
              }`}
            >
              <Circle
                className={`w-32 h-32 ${
                  isSessionActive ? 'text-terminal-accent' : 'text-terminal-muted'
                }`}
              />
            </div>
          </div>

          {/* Status */}
          <div className="text-center">
            {!isSessionActive ? (
              <p className="text-terminal-muted">
                Ready to begin your meditation session
              </p>
            ) : (
              <p className="text-terminal-accent animate-pulse">Session in progress...</p>
            )}
          </div>

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="border border-terminal-muted p-4 rounded max-h-64 overflow-y-auto space-y-2">
              <p className="text-xs text-terminal-muted mb-2">TRANSCRIPT:</p>
              {transcript.map((text, index) => (
                <p key={index} className="text-sm">
                  {text}
                </p>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {!isSessionActive ? (
              <button
                onClick={startSession}
                className="px-8 py-4 border-2 border-terminal-accent bg-terminal-accent/10 hover:bg-terminal-accent hover:text-terminal-bg transition-all duration-300 flex items-center gap-3"
              >
                <Play className="w-6 h-6" />
                START SESSION
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="px-8 py-4 border-2 border-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center gap-3"
              >
                <Square className="w-6 h-6" />
                END SESSION
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-terminal-muted space-y-2">
            <p>Find a quiet space. Put on headphones for the best experience.</p>
            <p className="text-xs">
              Phase 2: Basic meditation session with text transcript
              <br />
              Phase 3 will add audio-reactive visualizations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
