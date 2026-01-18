'use client'

import { motion } from 'framer-motion'
import { ParticleBackground } from '@/components/zen/ParticleBackground'
import { Navigation } from '@/components/zen/Navigation'
import { useEffect, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL

interface IdentityTheme {
  name: string
  description?: string
}

interface Insights {
  coreValues: string[]
  emotionalPatterns: string[]
  identityThemes: (string | IdentityTheme)[]
  tensions: string[]
  keywords?: string[]
  analysisDate?: string
  journalEntriesAnalyzed?: number
}

export default function DigitalSelf() {
  const [insights, setInsights] = useState<Insights>({
    coreValues: ['Authenticity', 'Growth', 'Connection', 'Compassion', 'Curiosity'],
    emotionalPatterns: [
      'You often find peace in solitude',
      'Uncertainty precedes your moments of growth',
      'Gratitude appears in quiet observations',
    ],
    identityThemes: ['The Observer', 'The Learner', 'The Seeker', 'The Gentle Warrior'],
    tensions: [
      'Between doing and being',
      'Between certainty and exploration',
      'Between connection and solitude',
    ],
  })
  const [isRegenerating, setIsRegenerating] = useState(false)

  useEffect(() => {
    fetchInsights()
  }, [])

  const fetchInsights = async () => {
    try {
      const response = await fetch(`${API_URL}/api/digital-self/insights`)
      const data = await response.json()
      setInsights(data)
    } catch (error) {
      console.error('Error fetching insights:', error)
    }
  }

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true)
      const response = await fetch(`${API_URL}/api/digital-self/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json()

      if (data.status === 'success') {
        setInsights(data.insights)
      }
    } catch (error) {
      console.error('Error regenerating insights:', error)
    } finally {
      setIsRegenerating(false)
    }
  }

  // Generate floating keywords from API data or use defaults
  const keywordsData = insights.keywords || ['present', 'tender', 'seeking', 'authentic', 'evolving']
  const floatingKeywords = keywordsData.slice(0, 5).map((word, i) => ({
    word,
    x: [15, 75, 45, 25, 80][i],
    y: [20, 15, 70, 85, 60][i],
    delay: i * 0.3,
  }))

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navigation />

      <div className="ml-20 relative z-10">
        <div className="min-h-screen flex items-center justify-center px-20 py-16">
          <div className="max-w-5xl w-full relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <div className="text-center">
                <h1 className="mb-3">Your Inner Landscape</h1>
                <p className="text-lg serif" style={{ color: 'var(--color-text-light)' }}>
                  A gentle reflection of who you&apos;re becoming
                </p>
                {insights.journalEntriesAnalyzed !== undefined && insights.journalEntriesAnalyzed > 0 ? (
                  <p className="text-sm mt-2" style={{ color: 'var(--color-text-light)', opacity: 0.7 }}>
                    Based on {insights.journalEntriesAnalyzed} journal entries
                  </p>
                ) : null}
                <div className="mt-4">
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="px-6 py-2 rounded-full text-sm"
                    style={{
                      background: 'rgba(168, 201, 195, 0.2)',
                      border: '1px solid rgba(168, 201, 195, 0.3)',
                      color: 'var(--color-teal)',
                      cursor: isRegenerating ? 'wait' : 'pointer',
                      opacity: isRegenerating ? 0.6 : 1,
                    }}
                  >
                    {isRegenerating ? 'Regenerating...' : '↻ Regenerate Insights'}
                  </button>
                </div>
              </div>

              {/* Floating Keywords */}
              <div className="relative h-64 mb-16">
                {floatingKeywords.map((item, index) => (
                  <motion.div
                    key={index}
                    className="absolute text-2xl font-light"
                    style={{
                      left: `${item.x}%`,
                      top: `${item.y}%`,
                      color: 'var(--color-teal)',
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: [0.5, 1.0, 0.5],
                      scale: [1, 1.1, 1],
                      y: [0, -10, 0],
                    }}
                    transition={{
                      duration: 6,
                      delay: item.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    {item.word}
                  </motion.div>
                ))}
              </div>

              {/* Core Values */}
              <motion.div
                className="mb-12 p-10 rounded-3xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(168, 201, 195, 0.2)',
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
              >
                <h3 className="mb-6" style={{ color: 'var(--color-teal)' }}>
                  Core Values
                </h3>
                <div className="flex flex-wrap gap-4">
                  {insights.coreValues.map((value, index) => (
                    <motion.div
                      key={value}
                      className="px-6 py-3 rounded-full"
                      style={{
                        background: 'rgba(168, 201, 195, 0.2)',
                        border: '1px solid rgba(168, 201, 195, 0.3)',
                      }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                    >
                      {value}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Emotional Patterns */}
              <motion.div
                className="mb-12 p-10 rounded-3xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(212, 201, 224, 0.2)',
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                <h3 className="mb-6" style={{ color: 'var(--color-lavender)' }}>
                  Emotional Patterns
                </h3>
                <div className="space-y-4">
                  {insights.emotionalPatterns.map((pattern, index) => (
                    <motion.p
                      key={index}
                      className="text-lg serif"
                      style={{ color: 'var(--color-text)' }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.8, delay: 0.7 + index * 0.2 }}
                    >
                      {pattern}
                    </motion.p>
                  ))}
                </div>
              </motion.div>

              {/* Identity Themes & Tensions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div
                  className="p-10 rounded-3xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(168, 201, 195, 0.2)',
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.7 }}
                >
                  <h3 className="mb-6" style={{ color: 'var(--color-teal)' }}>
                    Identity Themes
                  </h3>
                  <div className="space-y-4">
                    {insights.identityThemes.map((theme, index) => {
                      const themeName = typeof theme === 'string' ? theme : theme.name
                      const themeDesc = typeof theme === 'object' ? theme.description : null
                      return (
                        <motion.div
                          key={themeName}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.6, delay: 0.9 + index * 0.15 }}
                        >
                          <div className="text-lg font-medium">{themeName}</div>
                          {themeDesc && (
                            <div className="text-sm mt-1" style={{ color: 'var(--color-text-light)', opacity: 0.8 }}>
                              {themeDesc}
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>

                <motion.div
                  className="p-10 rounded-3xl"
                  style={{
                    background: 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(232, 217, 184, 0.2)',
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.9 }}
                >
                  <h3 className="mb-6" style={{ color: 'var(--color-gold)' }}>
                    Tensions & Growth
                  </h3>
                  <div className="space-y-3">
                    {insights.tensions.map((tension, index) => (
                      <motion.div
                        key={tension}
                        className="text-lg serif"
                        style={{ color: 'var(--color-text-light)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 1.1 + index * 0.15 }}
                      >
                        {tension}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
