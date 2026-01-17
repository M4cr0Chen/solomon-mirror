'use client'

import { useState } from 'react'
import { Book, Save, Check } from 'lucide-react'
import Link from 'next/link'

export default function JournalPage() {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const saveEntry = async () => {
    if (!content.trim()) return

    setIsLoading(true)
    setSaved(false)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/journal/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save journal entry')
      }

      setSaved(true)
      setTimeout(() => {
        setContent('')
        setSaved(false)
      }, 2000)
    } catch (error) {
      console.error('Error saving journal entry:', error)
      alert('Failed to save journal entry. Please make sure the backend is running.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-terminal-muted p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Book className="w-8 h-8 terminal-glow" />
            <div>
              <h1 className="text-2xl font-bold terminal-glow">JOURNAL ENTRY</h1>
              <p className="text-sm text-terminal-muted">
                Feed your Digital Twin with your thoughts
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

      {/* Journal Input */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <label htmlFor="journal" className="block text-sm mb-2 text-terminal-muted">
              What&apos;s on your mind?
            </label>
            <textarea
              id="journal"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your thoughts, feelings, or experiences here..."
              className="w-full h-96 bg-transparent border border-terminal-muted p-4 rounded focus:outline-none focus:border-terminal-accent resize-none"
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-terminal-muted">
              {content.length} characters
            </p>

            <button
              onClick={saveEntry}
              disabled={isLoading || !content.trim()}
              className="px-8 py-3 border border-terminal-accent bg-terminal-accent/10 hover:bg-terminal-accent hover:text-terminal-bg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saved ? (
                <>
                  <Check className="w-5 h-5" />
                  SAVED
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isLoading ? 'SAVING...' : 'SAVE ENTRY'}
                </>
              )}
            </button>
          </div>

          {saved && (
            <div className="p-4 border border-terminal-accent bg-terminal-accent/10 rounded">
              <p className="text-sm">
                Your entry has been saved and embedded into your Digital Twin.
                <br />
                This memory will be used to provide personalized guidance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
