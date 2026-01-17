'use client'

import { Terminal, Heart, Sparkles } from 'lucide-react'

interface AgentAvatarProps {
  agent: string
}

const agentConfig = {
  orchestrator: {
    icon: Terminal,
    color: 'text-green-400',
    label: 'ORCHESTRATOR',
  },
  mindfulness: {
    icon: Heart,
    color: 'text-blue-400',
    label: 'THE EMPATH',
  },
  wise_mentor: {
    icon: Sparkles,
    color: 'text-purple-400',
    label: 'THE SAGE',
  },
}

export function AgentAvatar({ agent }: AgentAvatarProps) {
  const config = agentConfig[agent as keyof typeof agentConfig] || agentConfig.orchestrator
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-10 h-10 rounded-full border-2 border-current flex items-center justify-center ${config.color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </div>
  )
}
