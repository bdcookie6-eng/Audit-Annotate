import { useState } from 'react'
import { FileText, Table, ExternalLink } from 'lucide-react'
import type { Document, Finding } from '../types'
import StatementTable from './StatementTable'
import PDFViewer from './PDFViewer'

interface Props {
  document: Document
  numberedFindings: Finding[]
  selectedFinding: Finding | null
  onSelectFinding: (f: Finding | null) => void
}

type Tab = 'table' | 'raw'

export default function DocumentPanel({ document: doc, numberedFindings, selectedFinding, onSelectFinding }: Props) {
  const [tab, setTab] = useState<Tab>('table')

  const hasExtractedData = doc.extracted_data && doc.extracted_data.sections?.length > 0
  const isPdf = doc.file_type === 'pdf'
  const fileUrl = `/api/documents/${doc.id}/file`

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700/50">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
        <button
          onClick={() => setTab('table')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t border-b-2 transition-colors ${
            tab === 'table'
              ? 'border-blue-500 text-blue-400 bg-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          Extracted Data
        </button>

        {isPdf && (
          <button
            onClick={() => setTab('raw')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t border-b-2 transition-colors ${
              tab === 'raw'
                ? 'border-blue-500 text-blue-400 bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Annotated PDF
          </button>
        )}

        <div className="ml-auto pb-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Download
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'table' ? (
          hasExtractedData ? (
            <StatementTable
              data={doc.extracted_data!}
              findings={numberedFindings}
              selectedFinding={selectedFinding}
              onSelectFinding={onSelectFinding}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Table className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm font-medium">No structured data extracted</p>
              <p className="text-slate-600 text-xs mt-1">
                Claude could not parse structured financial data from this document.
                {isPdf && ' Switch to the Annotated PDF tab.'}
              </p>
            </div>
          )
        ) : isPdf ? (
          <PDFViewer
            fileUrl={fileUrl}
            findings={numberedFindings}
            selectedFinding={selectedFinding}
            onSelectFinding={onSelectFinding}
          />
        ) : null}
      </div>
    </div>
  )
}
