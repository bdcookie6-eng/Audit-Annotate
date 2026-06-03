import React, { useEffect, useRef, useState } from 'react'
import { Send, Bot, User, Loader, AlertCircle, AlertTriangle, Info, ChevronDown, FileText } from 'lucide-react'
import type { Document, Finding, ChatMessage } from '../types'
import { getSummary, streamChatMessage, generateReport } from '../api/client'
import FindingCard from './FindingCard'

interface Props {
  document: Document
  numberedFindings: Finding[]
  selectedFinding: Finding | null
  onSelectFinding: (f: Finding | null) => void
  onFindingUpdate: (findingId: string, patch: { status: string; note?: string }) => void
}

function FindingsBadge({ findings }: { findings: Finding[] }) {
  const errors = findings.filter(f => f.severity === 'error' && f.status === 'open').length
  const warnings = findings.filter(f => f.severity === 'warning' && f.status === 'open').length
  const infos = findings.filter(f => f.severity === 'info' && f.status === 'open').length
  const reviewed = findings.filter(f => f.status !== 'open').length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {errors > 0 && (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-900/60 text-red-300 rounded-full">
          <AlertCircle className="w-3 h-3" />{errors} error{errors !== 1 ? 's' : ''}
        </span>
      )}
      {warnings > 0 && (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-900/60 text-amber-300 rounded-full">
          <AlertTriangle className="w-3 h-3" />{warnings} warning{warnings !== 1 ? 's' : ''}
        </span>
      )}
      {infos > 0 && (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded-full">
          <Info className="w-3 h-3" />{infos} info
        </span>
      )}
      {reviewed > 0 && (
        <span className="text-xs text-slate-500">{reviewed} reviewed</span>
      )}
    </div>
  )
}

export default function CopilotPanel({ document: doc, numberedFindings, selectedFinding, onSelectFinding, onFindingUpdate }: Props) {
  const [summary, setSummary] = useState<string>('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showFindings, setShowFindings] = useState(true)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'open' | 'reviewed'>('open')

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Use cached summary from document if available; otherwise fetch on demand
  useEffect(() => {
    if (doc.summary) {
      setSummary(doc.summary)
      setSummaryLoading(false)
      return
    }
    setSummaryLoading(true)
    getSummary(doc.id)
      .then(({ summary }) => setSummary(summary))
      .catch(() => setSummary('Unable to generate summary.'))
      .finally(() => setSummaryLoading(false))
  }, [doc.id, doc.summary])

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // When a finding is selected in the document panel, explain it
  useEffect(() => {
    if (!selectedFinding) return
    const question = `Explain finding: "${selectedFinding.title}" — ${selectedFinding.description}`
    sendMessage(question)
  }, [selectedFinding?.id])

  const sendMessage = (text?: string) => {
    const messageText = (text ?? input).trim()
    if (!messageText || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    streamChatMessage(
      doc.id,
      messageText,
      messages,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      },
      () => setStreaming(false),
      (err) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: `Error: ${err}`,
          }
          return updated
        })
        setStreaming(false)
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredFindings = numberedFindings.filter(f => {
    if (filter === 'open') return f.status === 'open'
    if (filter === 'reviewed') return f.status !== 'open'
    return true
  })

  const openCount = numberedFindings.filter(f => f.status === 'open').length
  const reviewedCount = numberedFindings.filter(f => f.status !== 'open').length

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">AI Audit Copilot</span>
        </div>

        {/* Summary */}
        <div className="bg-slate-800/60 rounded-lg p-3 mb-3">
          {summaryLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Loader className="w-3 h-3 animate-spin" />
              <span>Generating summary…</span>
            </div>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <FindingsBadge findings={doc.findings} />
          <button
            onClick={async () => {
              setReportGenerating(true)
              try {
                const text = await generateReport(doc.id)
                const blob = new Blob([text], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${doc.client_name || 'audit'}_report.txt`
                a.click()
                URL.revokeObjectURL(url)
              } catch (e) {
                alert('Report generation failed: ' + (e instanceof Error ? e.message : String(e)))
              } finally {
                setReportGenerating(false)
              }
            }}
            disabled={reportGenerating}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
          >
            {reportGenerating ? <Loader className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            {reportGenerating ? 'Generating…' : 'GAAP Report'}
          </button>
        </div>
      </div>

      {/* Findings section */}
      <div className="border-b border-slate-700/50">
        <button
          onClick={() => setShowFindings(!showFindings)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>FINDINGS ({doc.findings.length})</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFindings ? '' : '-rotate-90'}`} />
        </button>

        {showFindings && (
          <div className="px-3 pb-3">
            {/* Filter tabs */}
            <div className="flex gap-1 mb-2">
              {(['open', 'all', 'reviewed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    filter === f ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f === 'open' ? `Open (${openCount})` : f === 'reviewed' ? `Reviewed (${reviewedCount})` : `All (${doc.findings.length})`}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {filteredFindings.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">
                  {filter === 'open' ? 'All findings reviewed.' : 'No findings.'}
                </p>
              ) : (
                filteredFindings.map(f => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    isSelected={selectedFinding?.id === f.id}
                    onClick={() => onSelectFinding(selectedFinding?.id === f.id ? null : f)}
                    onStatusChange={(status, note) => onFindingUpdate(f.id, { status, note })}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-slate-600 mb-3">Ask anything about this document</p>
            <div className="space-y-1.5">
              {[
                'Are there any red flags I should investigate?',
                'Explain the most critical finding',
                'What changed significantly from prior year?',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="block w-full text-left text-xs px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'
            }`}>
              {msg.role === 'user' ? <User className="w-3 h-3 text-slate-300" /> : <Bot className="w-3 h-3 text-white" />}
            </div>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-slate-700 text-slate-200 rounded-tr-sm'
                : 'bg-slate-800 text-slate-200 rounded-tl-sm'
            } ${streaming && i === messages.length - 1 && msg.role === 'assistant' && msg.content === '' ? 'cursor-blink' : ''}`}>
              {msg.content || (streaming && i === messages.length - 1 ? '' : '…')}
            </div>
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-700/50 bg-slate-800/20">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this document… (Enter to send)"
            disabled={streaming}
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50 max-h-24"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            {streaming ? (
              <Loader className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
