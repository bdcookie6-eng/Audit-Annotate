import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { FileText, Upload, Trash2, ChevronLeft, Clock, FileSearch, Loader } from 'lucide-react'
import type { Document, Finding, ReportDraft } from './types'
import { uploadDocument, pollDocumentStatus, getDocument, listDocuments, deleteDocument, updateFinding, draftReport } from './api/client'
import UploadZone from './components/UploadZone'
import CopilotPanel from './components/CopilotPanel'
import DocumentPanel from './components/DocumentPanel'
import ReportSourcePanel from './components/ReportSourcePanel'
import AuditReportPreview from './components/AuditReportPreview'
import ToolNav from './components/ToolNav'

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 }

function assignNumbers(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  )
  return sorted.map((f, i) => ({ ...f, number: i + 1 }))
}

type AppState = 'home' | 'workbench'
type WorkbenchMode = 'review' | 'report'

export default function App() {
  const [appState, setAppState] = useState<AppState>('home')
  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>('review')
  const [activeDocument, setActiveDocument] = useState<Document | null>(null)
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)

  // Report draft state
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null)

  const numberedFindings = useMemo(
    () => activeDocument ? assignNumbers(activeDocument.findings) : [],
    [activeDocument]
  )

  useEffect(() => {
    listDocuments()
      .then(docs => setRecentDocs(docs.filter(d => d.status === 'ready').slice(0, 5)))
      .catch(() => {})
  }, [])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const { id } = await uploadDocument(file)
      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const { status, error_message } = await pollDocumentStatus(id)
            if (status === 'ready') { clearInterval(interval); resolve() }
            if (status === 'error') { clearInterval(interval); reject(new Error(error_message ?? 'Processing failed')) }
          } catch (e) { clearInterval(interval); reject(e) }
        }, 2000)
      })
      const doc = await getDocument(id)
      setActiveDocument(doc)
      setSelectedFinding(null)
      setAppState('workbench')
      setWorkbenchMode('review')
      setReportDraft(null)
      setRecentDocs(prev => [doc, ...prev.filter(d => d.id !== doc.id)].slice(0, 5))
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const handleOpenDocument = useCallback(async (doc: Document) => {
    try {
      const fresh = await getDocument(doc.id)
      setActiveDocument(fresh)
      setSelectedFinding(null)
      setAppState('workbench')
      setWorkbenchMode('review')
    } catch (_) {
      setUploadError('Failed to load document')
    }
  }, [])

  const handleDeleteDocument = useCallback(async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteDocument(docId)
    setRecentDocs(prev => prev.filter(d => d.id !== docId))
    if (activeDocument?.id === docId) {
      setActiveDocument(null)
      setAppState('home')
    }
  }, [activeDocument])

  const handleFindingUpdate = useCallback(async (findingId: string, patch: { status: string; note?: string }) => {
    if (!activeDocument) return
    await updateFinding(activeDocument.id, findingId, patch)
    const updated = await getDocument(activeDocument.id)
    setActiveDocument(updated)
    if (selectedFinding?.id === findingId) {
      const updatedFinding = updated.findings.find(f => f.id === findingId)
      setSelectedFinding(updatedFinding ?? null)
    }
  }, [activeDocument, selectedFinding])

  const handleSwitchToReport = useCallback(async () => {
    setWorkbenchMode('report')
    setSelectedFigureId(null)
    if (reportDraft) return // already generated
    const readyIds = recentDocs.filter(d => d.status === 'ready').map(d => d.id)
    if (readyIds.length === 0) return
    setReportLoading(true)
    setReportError(null)
    try {
      const draft = await draftReport(readyIds)
      setReportDraft(draft)
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setReportLoading(false)
    }
  }, [recentDocs, reportDraft])

  const handleRegenerateDraft = useCallback(async () => {
    const readyIds = recentDocs.filter(d => d.status === 'ready').map(d => d.id)
    if (readyIds.length === 0) return
    setReportLoading(true)
    setReportError(null)
    setReportDraft(null)
    setSelectedFigureId(null)
    try {
      const draft = await draftReport(readyIds)
      setReportDraft(draft)
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setReportLoading(false)
    }
  }, [recentDocs])

  if (appState === 'home') {
    return (
      <div className="relative">
        <UploadZone onUpload={handleUpload} uploading={uploading} error={uploadError} />
        {recentDocs.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6">
            <div className="bg-slate-800/90 backdrop-blur rounded-xl border border-slate-700 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Recent Documents
              </p>
              <div className="space-y-1.5">
                {recentDocs.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenDocument(doc)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">{doc.filename}</p>
                        <p className="text-xs text-slate-500 capitalize">
                          {doc.statement_type?.replace(/_/g, ' ') ?? 'Unknown type'} &middot;{' '}
                          {doc.findings.filter(f => f.severity === 'error').length} errors,{' '}
                          {doc.findings.filter(f => f.severity === 'warning').length} warnings
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-2 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Workbench view
  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700/50 shrink-0">
        <button
          onClick={() => setAppState('home')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="w-px h-4 bg-slate-600" />
        <ToolNav />
        {activeDocument && (
          <>
            <div className="w-px h-4 bg-slate-600" />
            <span className="text-xs text-slate-400 truncate max-w-xs">{activeDocument.filename}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              activeDocument.statement_type === 'balance_sheet' ? 'bg-purple-900/60 text-purple-300' :
              activeDocument.statement_type === 'income_statement' ? 'bg-green-900/60 text-green-300' :
              activeDocument.statement_type === 'cash_flow' ? 'bg-cyan-900/60 text-cyan-300' :
              'bg-slate-700 text-slate-400'
            }`}>
              {activeDocument.statement_type?.replace(/_/g, ' ') ?? 'Unknown'}
            </span>
          </>
        )}

        {/* Mode tabs */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5 border border-slate-700/50">
            <button
              onClick={() => setWorkbenchMode('review')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                workbenchMode === 'review'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Document Review
            </button>
            <button
              onClick={handleSwitchToReport}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                workbenchMode === 'report'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSearch className="w-3.5 h-3.5" />
              Draft Report
            </button>
          </div>

          <button
            onClick={() => {
              const input = window.document.createElement('input')
              input.type = 'file'
              input.accept = '.pdf,.xlsx,.xls,.csv'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) { setAppState('home'); handleUpload(file) }
              }
              input.click()
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            <Upload className="w-3 h-3" />
            New Document
          </button>
        </div>
      </header>

      {/* Split-screen body */}
      <div className="flex-1 overflow-hidden flex">
        {workbenchMode === 'review' && activeDocument && (
          <>
            {/* Left: AI Copilot (38%) */}
            <div className="w-[38%] min-w-[300px] flex flex-col overflow-hidden border-r border-slate-700/50">
              <CopilotPanel
                document={activeDocument}
                numberedFindings={numberedFindings}
                selectedFinding={selectedFinding}
                onSelectFinding={setSelectedFinding}
                onFindingUpdate={handleFindingUpdate}
              />
            </div>
            {/* Right: Document Viewer (62%) */}
            <div className="flex-1 overflow-hidden">
              <DocumentPanel
                document={activeDocument}
                numberedFindings={numberedFindings}
                selectedFinding={selectedFinding}
                onSelectFinding={setSelectedFinding}
              />
            </div>
          </>
        )}

        {workbenchMode === 'report' && (
          <>
            {/* Left: Source Documents (38%) */}
            <div className="w-[38%] min-w-[300px] flex flex-col overflow-hidden border-r border-slate-700/50">
              <ReportSourcePanel
                documents={recentDocs}
                figureMap={reportDraft?.figure_map ?? []}
                selectedFigureId={selectedFigureId}
                onSelectFigure={setSelectedFigureId}
              />
            </div>

            {/* Right: Audit Report Preview (62%) */}
            <div className="flex-1 overflow-hidden">
              {reportLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader className="w-8 h-8 text-blue-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm text-slate-300 font-medium">Drafting audit report…</p>
                    <p className="text-xs text-slate-500 mt-1">Claude is analyzing your documents and writing the report</p>
                  </div>
                </div>
              )}

              {!reportLoading && reportError && (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
                  <p className="text-sm text-red-400">{reportError}</p>
                  <button
                    onClick={handleRegenerateDraft}
                    className="text-xs px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!reportLoading && !reportError && reportDraft && (
                <div className="flex flex-col h-full">
                  <AuditReportPreview
                    draft={reportDraft}
                    selectedFigureId={selectedFigureId}
                    onSelectFigure={setSelectedFigureId}
                  />
                  <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-800/30 flex items-center justify-end shrink-0">
                    <button
                      onClick={handleRegenerateDraft}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Regenerate draft
                    </button>
                  </div>
                </div>
              )}

              {!reportLoading && !reportError && !reportDraft && (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <p className="text-sm text-slate-500">No report generated yet</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
