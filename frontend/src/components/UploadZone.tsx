import React, { useCallback, useState } from 'react'
import { Upload, FileText, AlertCircle } from 'lucide-react'

interface Props {
  onUpload: (file: File) => void
  uploading: boolean
  error: string | null
}

export default function UploadZone({ onUpload, uploading, error }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      const allowed = ['pdf', 'xlsx', 'xls', 'csv']
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!allowed.includes(ext)) {
        alert(`Unsupported file type: .${ext}\nSupported: PDF, Excel (.xlsx/.xls), CSV`)
        return
      }
      onUpload(file)
    },
    [onUpload]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Audit-Annotate</h1>
        </div>
        <p className="text-slate-400 text-sm max-w-sm">
          AI-powered financial statement audit workbench for CPA teams
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
          ${dragging ? 'border-blue-500 bg-blue-950/30' : 'border-slate-600 bg-slate-800/40'}
          ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:border-slate-400 hover:bg-slate-800/60'}
        `}
        onClick={() => !uploading && document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={onInputChange}
        />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-300 font-medium">Processing document…</p>
              <p className="text-slate-500 text-sm">Claude is extracting and analyzing the financial data</p>
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${dragging ? 'bg-blue-600' : 'bg-slate-700'}`}>
                <Upload className={`w-7 h-7 ${dragging ? 'text-white' : 'text-slate-300'}`} />
              </div>
              <div>
                <p className="text-white font-medium mb-1">
                  {dragging ? 'Drop to upload' : 'Upload financial document'}
                </p>
                <p className="text-slate-400 text-sm">Drag & drop or click to browse</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {['PDF', 'Excel (.xlsx)', 'CSV'].map((fmt) => (
                  <span key={fmt} className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded-full">
                    {fmt}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 text-red-400 text-sm max-w-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-8 text-slate-600 text-xs text-center max-w-sm">
        Balance sheets, income statements, and cash flow statements supported.
        Files are processed securely and not shared externally.
      </p>
    </div>
  )
}
