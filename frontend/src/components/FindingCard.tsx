import { useState } from 'react'
import { AlertCircle, AlertTriangle, Info, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import type { Finding } from '../types'

interface Props {
  finding: Finding
  isSelected: boolean
  onClick: () => void
  onStatusChange: (status: string, note?: string) => void
}

const SEVERITY_CONFIG = {
  error:   { icon: AlertCircle,   bg: 'bg-red-950/60',    border: 'border-red-800/50',   text: 'text-red-400',    badge: 'bg-red-900 text-red-300',    label: 'Error' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-950/60',  border: 'border-amber-800/50', text: 'text-amber-400',  badge: 'bg-amber-900 text-amber-300',  label: 'Warning' },
  info:    { icon: Info,          bg: 'bg-blue-950/60',   border: 'border-blue-800/50',  text: 'text-blue-400',   badge: 'bg-blue-900 text-blue-300',    label: 'Info' },
}

const STATUS_CONFIG = {
  open:      { color: 'text-slate-400', label: 'Open' },
  approved:  { color: 'text-green-400', label: 'Approved' },
  dismissed: { color: 'text-slate-500', label: 'Dismissed' },
  noted:     { color: 'text-purple-400', label: 'Noted' },
}

export default function FindingCard({ finding, isSelected, onClick, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [noteText, setNoteText] = useState(finding.note ?? '')
  const [showNoteInput, setShowNoteInput] = useState(false)

  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info
  const Icon = cfg.icon
  const statusCfg = STATUS_CONFIG[finding.status] ?? STATUS_CONFIG.open

  const handleNote = () => {
    onStatusChange('noted', noteText)
    setShowNoteInput(false)
  }

  return (
    <div
      className={`
        rounded-lg border transition-all duration-150 cursor-pointer
        ${cfg.bg} ${cfg.border}
        ${isSelected ? 'ring-1 ring-blue-500/50' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          {/* Numbered badge */}
          {finding.number != null ? (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${cfg.badge}`}>
              {finding.number}
            </span>
          ) : (
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.text}`} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</span>
            </div>
            <p className="text-sm text-slate-200 font-medium leading-snug">{finding.title}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-2.5 pl-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">{finding.description}</p>

            {finding.note && !showNoteInput && (
              <div className="text-xs text-purple-300 bg-purple-950/40 rounded p-2 mb-3">
                <span className="font-medium">Note:</span> {finding.note}
              </div>
            )}

            {showNoteInput && (
              <div className="mb-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note for the reviewer…"
                  className="w-full text-xs bg-slate-800 border border-slate-600 rounded p-2 text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500"
                  rows={3}
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleNote}
                    className="text-xs px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors"
                  >
                    Save Note
                  </button>
                  <button
                    onClick={() => setShowNoteInput(false)}
                    className="text-xs px-2.5 py-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {finding.status === 'open' && !showNoteInput && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => onStatusChange('approved')}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-green-900/60 hover:bg-green-800 text-green-300 rounded transition-colors"
                >
                  <CheckCircle className="w-3 h-3" /> Approve
                </button>
                <button
                  onClick={() => onStatusChange('dismissed')}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  <XCircle className="w-3 h-3" /> Dismiss
                </button>
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-300 rounded transition-colors"
                >
                  <MessageSquare className="w-3 h-3" /> Add Note
                </button>
              </div>
            )}

            {finding.status !== 'open' && (
              <button
                onClick={() => onStatusChange('open')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Reopen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
