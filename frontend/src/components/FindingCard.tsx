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
  error:   { icon: AlertCircle,   bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-600',    badge: 'bg-red-100 text-red-700',    label: 'Error' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: 'Warning' },
  info:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700',    label: 'Info' },
}

const STATUS_CONFIG = {
  open:      { color: 'text-slate-500', label: 'Open' },
  approved:  { color: 'text-green-600', label: 'Approved' },
  dismissed: { color: 'text-slate-400', label: 'Dismissed' },
  noted:     { color: 'text-purple-600', label: 'Noted' },
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
        ${isSelected ? 'ring-1 ring-[#1A5C4A]/50' : ''}
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
            <p className="text-sm text-slate-800 font-medium leading-snug">{finding.title}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-2.5 pl-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">{finding.description}</p>

            {finding.note && !showNoteInput && (
              <div className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded p-2 mb-3">
                <span className="font-medium">Note:</span> {finding.note}
              </div>
            )}

            {showNoteInput && (
              <div className="mb-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note for the reviewer…"
                  className="w-full text-xs bg-white border border-slate-200 rounded p-2 text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:border-[#1A5C4A]"
                  rows={3}
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleNote}
                    className="text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  >
                    Save Note
                  </button>
                  <button
                    onClick={() => setShowNoteInput(false)}
                    className="text-xs px-2.5 py-1 text-slate-500 hover:text-slate-700 transition-colors"
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
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                >
                  <CheckCircle className="w-3 h-3" /> Approve
                </button>
                <button
                  onClick={() => onStatusChange('dismissed')}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                >
                  <XCircle className="w-3 h-3" /> Dismiss
                </button>
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
                >
                  <MessageSquare className="w-3 h-3" /> Add Note
                </button>
              </div>
            )}

            {finding.status !== 'open' && (
              <button
                onClick={() => onStatusChange('open')}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
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
