import { useState, useRef, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import type { Finding } from '../types'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const SEVERITY_COLORS = {
  error:   { ring: '#ef4444', bg: '#dc2626', text: 'white', highlight: 'rgba(239,68,68,0.18)' },
  warning: { ring: '#f59e0b', bg: '#d97706', text: 'white', highlight: 'rgba(245,158,11,0.15)' },
  info:    { ring: '#3b82f6', bg: '#2563eb', text: 'white', highlight: 'rgba(59,130,246,0.13)' },
}

interface Props {
  fileUrl: string
  findings: Finding[]           // already numbered (.number assigned by parent)
  selectedFinding: Finding | null
  onSelectFinding: (f: Finding | null) => void
}

interface PageDimensions {
  width: number
  height: number
}

export default function PDFViewer({ fileUrl, findings, selectedFinding, onSelectFinding }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.2)
  const [pageDims, setPageDims] = useState<PageDimensions | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setCurrentPage(1)
  }

  const onPageLoadSuccess = useCallback((page: { width: number; height: number }) => {
    setPageDims({ width: page.width * scale, height: page.height * scale })
  }, [scale])

  // Findings visible on the current page that have coordinates
  const pageFindings = findings.filter(
    f => f.coordinates?.page === currentPage - 1 && f.status === 'open'
  )

  const zoomIn  = () => setScale(s => Math.min(s + 0.2, 2.5))
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.6))

  // Navigate to the page containing a selected finding
  const goToFindingPage = useCallback((f: Finding) => {
    if (f.coordinates) setCurrentPage(f.coordinates.page + 1)
    onSelectFinding(f)
  }, [onSelectFinding])

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="p-1 text-slate-400 hover:text-white transition-colors rounded">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1 text-slate-400 hover:text-white transition-colors rounded">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-4 bg-slate-600" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400">
            Page {currentPage} of {numPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Jump-to-finding buttons */}
        {findings.filter(f => f.coordinates && f.status === 'open').length > 0 && (
          <>
            <div className="w-px h-4 bg-slate-600" />
            <div className="flex items-center gap-1">
              {findings
                .filter(f => f.coordinates && f.status === 'open')
                .map(f => {
                  const c = SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.info
                  const isActive = selectedFinding?.id === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => goToFindingPage(f)}
                      title={f.title}
                      style={{
                        backgroundColor: isActive ? c.bg : 'transparent',
                        borderColor: c.ring,
                        color: isActive ? c.text : c.ring,
                      }}
                      className="w-5 h-5 rounded-full border text-xs font-bold flex items-center justify-center transition-all hover:opacity-80"
                    >
                      {f.number}
                    </button>
                  )
                })}
            </div>
          </>
        )}
      </div>

      {/* PDF canvas area */}
      <div className="flex-1 overflow-auto flex justify-center py-4 px-2" ref={containerRef}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center w-full h-40 text-slate-500 text-sm">
              Loading PDF…
            </div>
          }
          error={
            <div className="flex items-center justify-center w-full h-40 text-red-400 text-sm">
              Failed to load PDF.
            </div>
          }
        >
          <div className="relative shadow-2xl">
            <Page
              pageNumber={currentPage}
              scale={scale}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={true}
              renderAnnotationLayer={false}
            />

            {/* Annotation overlay — absolutely positioned on top of the rendered page */}
            {pageDims && pageFindings.map(finding => {
              const coords = finding.coordinates!
              const c = SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info
              const isSelected = selectedFinding?.id === finding.id

              const left   = coords.x * pageDims.width
              const top    = coords.y * pageDims.height
              const width  = coords.w * pageDims.width
              const height = Math.max(coords.h * pageDims.height, 14)

              return (
                <div key={finding.id}>
                  {/* Row highlight */}
                  <div
                    className="absolute pointer-events-none transition-opacity duration-150"
                    style={{
                      left: 0,
                      top: top - 2,
                      width: pageDims.width,
                      height: height + 4,
                      backgroundColor: isSelected ? c.highlight : 'transparent',
                      borderLeft: isSelected ? `3px solid ${c.ring}` : `3px solid transparent`,
                    }}
                  />

                  {/* Underline on the text */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left,
                      top: top + height - 1,
                      width,
                      height: 2,
                      backgroundColor: c.ring,
                      opacity: isSelected ? 1 : 0.7,
                    }}
                  />

                  {/* Numbered badge */}
                  <button
                    onClick={() => onSelectFinding(isSelected ? null : finding)}
                    title={finding.title}
                    className="absolute flex items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                    style={{
                      left: left - 20,
                      top: top + (height / 2) - 9,
                      width: 18,
                      height: 18,
                      backgroundColor: c.bg,
                      color: c.text,
                      border: `2px solid ${isSelected ? 'white' : c.ring}`,
                      boxShadow: isSelected ? `0 0 0 2px ${c.ring}` : '0 1px 3px rgba(0,0,0,0.4)',
                      zIndex: 10,
                      fontSize: '10px',
                    }}
                  >
                    {finding.number}
                  </button>
                </div>
              )
            })}
          </div>
        </Document>
      </div>
    </div>
  )
}
