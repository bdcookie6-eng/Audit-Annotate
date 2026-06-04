import React, { useEffect, useRef } from 'react'
import type { ReportDraft, ReportFigure } from '../types'

interface Props {
  draft: ReportDraft
  selectedFigureId: string | null
  onSelectFigure: (id: string | null) => void
}

function renderParagraph(
  text: string,
  figureMap: ReportFigure[],
  selectedFigureId: string | null,
  onSelectFigure: (id: string | null) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\{\{(fig_\d+)\}\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const figId = match[1]
    const fig = figureMap.find(f => f.id === figId)
    if (fig) {
      const isSelected = selectedFigureId === figId
      parts.push(
        <button
          key={`${figId}-${match.index}`}
          onClick={() => onSelectFigure(isSelected ? null : figId)}
          data-fig-id={figId}
          title={`${fig.label} — from ${fig.source_document_name}`}
          className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-sm font-semibold transition-all ${
            isSelected
              ? 'bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900'
              : 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/60 border border-blue-700/40 hover:border-blue-500/60'
          }`}
        >
          {fig.display}
        </button>
      )
    } else {
      parts.push(match[0])
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export default function AuditReportPreview({ draft, selectedFigureId, onSelectFigure }: Props) {
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const figureRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // When a figure is selected from the source panel, scroll to it in the report
  useEffect(() => {
    if (!selectedFigureId) return
    const btn = figureRefs.current.get(selectedFigureId)
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    // Fallback: scroll to the section
    const fig = draft.figure_map.find(f => f.id === selectedFigureId)
    if (fig) {
      sectionRefs.current.get(fig.report_section_id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedFigureId, draft.figure_map])

  const { report, figure_map } = draft

  const renderSection = (section: typeof report.sections[0]) => (
    <div
      key={section.id}
      ref={el => {
        if (el) sectionRefs.current.set(section.id, el)
        else sectionRefs.current.delete(section.id)
      }}
      className="mb-8"
    >
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-700/50">
        {section.heading}
      </h2>
      {section.paragraphs.map((para, i) => {
        const nodes = renderParagraph(para, figure_map, selectedFigureId, onSelectFigure)
        // Attach refs to figure buttons after render via a wrapper approach
        return (
          <p key={i} className="text-sm text-slate-300 leading-relaxed mb-3 last:mb-0">
            {nodes.map((node, ni) => {
              if (typeof node === 'object' && node !== null && 'props' in node) {
                const figId = (node as React.ReactElement).props['data-fig-id']
                if (figId) {
                  return React.cloneElement(node as React.ReactElement, {
                    ref: (el: HTMLButtonElement | null) => {
                      if (el) figureRefs.current.set(figId, el)
                      else figureRefs.current.delete(figId)
                    },
                    key: `${figId}-${ni}`,
                  })
                }
              }
              return node
            })}
          </p>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700/50">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
        <h2 className="text-sm font-semibold text-white">Draft Audit Report</h2>
        <span className="text-xs px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded-full border border-amber-700/40">
          Draft — Not for Distribution
        </span>
      </div>

      {/* Report body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-10 py-10">
          {/* Title block */}
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-white tracking-wide">{report.title}</h1>
            {report.addressee && (
              <p className="text-sm text-slate-400 mt-3">To the {report.addressee}</p>
            )}
          </div>

          {/* Sections */}
          {report.sections.map(renderSection)}

          {/* Signature block */}
          {(report.signature || report.location || report.date) && (
            <div className="mt-12 pt-6 border-t border-slate-700/50">
              {report.signature && (
                <p className="text-sm font-semibold text-slate-200">{report.signature}</p>
              )}
              {report.location && (
                <p className="text-sm text-slate-400 mt-1">{report.location}</p>
              )}
              {report.date && (
                <p className="text-sm text-slate-400 mt-0.5">{report.date}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
