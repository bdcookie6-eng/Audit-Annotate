import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { FileText, Upload, Trash2, ChevronLeft, Clock } from 'lucide-react'
import type { Document, Finding } from './types'
import { uploadDocument, pollDocumentStatus, getDocument, listDocuments, deleteDocument, updateFinding } from './api/client'
import UploadZone from './components/UploadZone'
import CopilotPanel from './components/CopilotPanel'
import DocumentPanel from './components/DocumentPanel'
import ToolNav from './components/ToolNav'

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 }

function assignNumbers(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  )
  return sorted.map((f, i) => ({ ...f, number: i + 1 }))
}

type AppState = 'home' | 'workbench'

export default function App() {
  const [appState, setAppState] = useState<AppState>('home')
  const [activeDocument, setActiveDocument] = useState<Document | null>(null)
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)

  const numberedFindings = useMemo(
    () => activeDocument ? assignNumbers(activeDocument.findings) : [],
    [activeDocument]
  )

  // Load recent documents on mount
  useEffect(() => {
    listDocuments()
      .then(docs => setRecentDocs(docs.filter(d => d.status === 'ready').slice(0, 5)))
      .catch(() => {})
  }, [])

  // Deep-link: if URL has ?doc=<id> (sent from TB tool), open that document directly
  useEffect(() => {
    const docId = new URLSearchParams(window.location.search).get('doc')
    if (!docId) return
    // Remove the query param from the URL bar without reloading
    window.history.replaceState({}, '', window.location.pathname)
    const poll = setInterval(async () => {
      try {
        const { status } = await pollDocumentStatus(docId)
        if (status === 'ready') {
          clearInterval(poll)
          const doc = await getDocument(docId)
          setActiveDocument(doc)
          setSelectedFinding(null)
          setAppState('workbench')
        }
        if (status === 'error') clearInterval(poll)
      } catch { clearInterval(poll) }
    }, 2000)
    return () => clearInterval(poll)
  }, [])

  const handleUpload = useCallback(async (file: File, clientName?: string) => {
    setUploading(true)
    setUploadError(null)
    try {
      const { id } = await uploadDocument(file, clientName)
      // Poll until ready
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
    // Refresh document to get updated findings
    const updated = await getDocument(activeDocument.id)
    setActiveDocument(updated)
    if (selectedFinding?.id === findingId) {
      const updatedFinding = updated.findings.find(f => f.id === findingId)
      setSelectedFinding(updatedFinding ?? null)
    }
  }, [activeDocument, selectedFinding])

  if (appState === 'home') {
    return (
      <div className="relative">
        <UploadZone onUpload={(file, cn) => handleUpload(file, cn)} uploading={uploading} error={uploadError} />
        {recentDocs.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-md">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Recent Documents
              </p>
              <div className="space-y-1.5">
                {recentDocs.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => handleOpenDocument(doc)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#EEF7F4] hover:bg-[#D6EDE7] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 truncate">{doc.filename}</p>
                        <p className="text-xs text-slate-500 capitalize truncate">
                          {doc.client_name && <span className="text-slate-500 mr-1">{doc.client_name} ·</span>}
                          {doc.statement_type?.replace(/_/g, ' ') ?? 'Unknown type'} ·{' '}
                          {doc.findings.filter(f => f.severity === 'error').length} errors,{' '}
                          {doc.findings.filter(f => f.severity === 'warning').length} warnings
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-2 shrink-0"
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
    <div className="flex flex-col h-screen bg-[#f1f5f9] overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-[#1A5C4A] border-b border-[#154D3E] shrink-0">
        <button
          onClick={() => setAppState('home')}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="w-px h-4 bg-white/20" />
        <ToolNav />
        {activeDocument && (
          <>
            <div className="w-px h-4 bg-white/20" />
            {activeDocument.client_name && (
              <span className="text-xs text-white font-medium truncate max-w-[120px]">{activeDocument.client_name}</span>
            )}
            {activeDocument.client_name && <div className="w-px h-4 bg-white/20" />}
            <span className="text-xs text-white/70 truncate max-w-xs">{activeDocument.filename}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              activeDocument.statement_type === 'balance_sheet' ? 'bg-purple-100 text-purple-700' :
              activeDocument.statement_type === 'income_statement' ? 'bg-[#EEF7F4] text-[#1A5C4A]' :
              activeDocument.statement_type === 'cash_flow' ? 'bg-cyan-100 text-cyan-700' :
              'bg-white/20 text-white'
            }`}>
              {activeDocument.statement_type?.replace(/_/g, ' ') ?? 'Unknown'}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
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
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white text-[#1A5C4A] hover:bg-[#D6EDE7] rounded-lg transition-colors font-medium"
          >
            <Upload className="w-3 h-3" />
            New Document
          </button>
        </div>
      </header>

      {/* Split-screen body */}
      {activeDocument && (
        <div className="flex-1 overflow-hidden flex">
          {/* Left: AI Copilot (38%) */}
          <div className="w-[38%] min-w-[300px] flex flex-col overflow-hidden border-r border-slate-200">
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
        </div>
      )}
    </div>
  )
}
