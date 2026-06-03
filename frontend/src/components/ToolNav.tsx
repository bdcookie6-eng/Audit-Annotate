import { Scale, FileSearch } from 'lucide-react'

interface Tool {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  available: boolean
}

const TOOLS: Tool[] = [
  {
    id: 'trial-balance',
    label: 'Trial Balance',
    href: '/',
    icon: Scale,
    active: false,
    available: true,
  },
  {
    id: 'audit-annotate',
    label: 'Audit & Annotate',
    href: '/audit',
    icon: FileSearch,
    active: true,
    available: true,
  },
]

export default function ToolNav() {
  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 border border-white/20">
      {TOOLS.map((tool) => {
        const Icon = tool.icon

        if (tool.active) {
          return (
            <span
              key={tool.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-[#1A5C4A] text-xs font-medium select-none"
            >
              <Icon className="w-3.5 h-3.5" />
              {tool.label}
            </span>
          )
        }

        if (!tool.available) {
          return (
            <span
              key={tool.id}
              title="Set VITE_TRIAL_BALANCE_URL in your .env to enable this link"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white/40 text-xs font-medium cursor-not-allowed select-none"
            >
              <Icon className="w-3.5 h-3.5" />
              {tool.label}
            </span>
          )
        }

        return (
          <a
            key={tool.id}
            href={tool.href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {tool.label}
          </a>
        )
      })}
    </div>
  )
}
