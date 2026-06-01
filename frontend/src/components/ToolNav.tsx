import { Scale, FileSearch } from 'lucide-react'

interface Tool {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  available: boolean
}

// The Trial Balance URL is set at build time via VITE_TRIAL_BALANCE_URL.
// Falls back to '#' if not configured so the tab still renders.
const TRIAL_BALANCE_URL = import.meta.env.VITE_TRIAL_BALANCE_URL || '#'

const TOOLS: Tool[] = [
  {
    id: 'trial-balance',
    label: 'Trial Balance',
    href: TRIAL_BALANCE_URL,
    icon: Scale,
    active: false,
    available: TRIAL_BALANCE_URL !== '#',
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
    <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50">
      {TOOLS.map((tool) => {
        const Icon = tool.icon

        if (tool.active) {
          return (
            <span
              key={tool.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium select-none"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-500 text-xs font-medium cursor-not-allowed select-none"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 text-xs font-medium transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {tool.label}
          </a>
        )
      })}
    </div>
  )
}
