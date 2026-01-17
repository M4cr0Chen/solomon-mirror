import Link from 'next/link'
import { Terminal } from 'lucide-react'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-8">
        <div className="flex justify-center">
          <Terminal className="w-24 h-24 terminal-glow" />
        </div>

        <h1 className="text-6xl font-bold terminal-glow">
          THE MIRROR
        </h1>

        <p className="text-xl text-terminal-muted max-w-2xl">
          A Self-Discovery Engine that helps you overcome Solomon&apos;s Paradox
          <br />
          by creating a Digital Twin and Council of Agents
        </p>

        <div className="flex gap-4 justify-center mt-12 flex-wrap">
          <Link
            href="/council"
            className="px-8 py-4 border-2 border-terminal-accent hover:bg-terminal-accent hover:text-terminal-bg transition-all duration-300"
          >
            ENTER THE COUNCIL
          </Link>

          <Link
            href="/journal"
            className="px-8 py-4 border-2 border-terminal-muted text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent transition-all duration-300"
          >
            JOURNAL ENTRY
          </Link>

          <Link
            href="/meditation"
            className="px-8 py-4 border-2 border-terminal-muted text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent transition-all duration-300"
          >
            MEDITATION
          </Link>
        </div>

        <div className="mt-16 text-sm text-terminal-muted">
          <p>Press any key to begin your journey...</p>
        </div>
      </div>
    </main>
  )
}
