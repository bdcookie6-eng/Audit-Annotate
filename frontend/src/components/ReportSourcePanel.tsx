import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, AlertCircle } from 'lucide-react'
import type { Document, ReportFigure } from '../types'

interface Props {
  documents: Document[]
  figureMap: ReportFigure[]
  selectedFigureId: string | null
  onSelectFigure: (id: string | null) => void
}

export default function ReportSourcePanel({ documents, figureMap, selectedFigureId, onSelectFigure }: Props) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(
    new Set(documents.map(d => d.id))
  )

  const toggleDoc = (id: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const readyDocs = documents.filter(d => d.status === 'ready')

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
        <h2 className="text-sm font-semibold text-white">Source Documents</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Click a figure to highlight it in the report
        </p>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {readyDocs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <AlertCircle className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">No documents loaded</p>
            <p className="text-xs text-slate-600 mt-1">Upload a document to generate a report</p>
          </div>
        )}

        {readyDocs.map(doc => {
          const docFigures = figureMap.filter(f => f.source_document_id === doc.id)
          const isExpanded = expandedDocs.has(doc.id)

          return (
            <div
              key={doc.id}
              className="bg-slate-800/50 rounded-xl border border-slate-700/40 overflow-hidden"
            >
              {/* Document row */}
              <button
                onClick={() => toggleDoc(doc.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-700/30 transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate font-medium">{doc.filename}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">
                    {doc.statement_type?.replace(/_/g, ' ') ?? 'Unknown'}
                    {docFigures.length > 0 && (
                      <> &middot; <span className="text-blue-400">{docFigures.length} figure{docFigures.length !== 1 ? 's' : ''} in report</span></>
                    )}
                  </p>
                </div>
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </button>

              {/* Figure list */}
              {isExpanded && (
                <div className="border-t border-slate-700/40">
                  {docFigures.length === 0 ? (
                    <p className="text-xs text-slate-600 px-4 py-3 italic">
                      No figures from this document appear in the report.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-700/30">
                      {docFigures.map(fig => {
                        const isSelected = selectedFigureId === fig.id
                        return (
                          <button
                            key={fig.id}
                            onClick={() => onSelectFigure(isSelected ? null : fig.id)}
                            className={`w-full flex items-start justify-between px-4 py-2.5 text-left transition-all hover:bg-slate-700/30 ${
                              isSelected
                                ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
                                : 'border-l-2 border-l-transparent'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <p className={`text-xs font-medium truncate ${
                                isSelected ? 'text-blue-300' : 'text-slate-300'
                              }`}>
                                {fig.label}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {fig.source_section && (
                                  <span className="text-slate-600">{fig.source_section} &rarr; </span>
                                )}
                                <span className="text-slate-500">cited in </span>
                                <span className="text-slate-400">{fig.report_section_heading}</span>
                              </p>
                            </div>
                            <span className={`text-xs font-mono shrink-0 mt-0.5 px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700/60 text-slate-300'
                            }`}>
                              {fig.display}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
