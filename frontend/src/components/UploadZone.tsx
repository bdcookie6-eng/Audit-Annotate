import React, { useCallback, useState } from 'react'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import ToolNav from './ToolNav'

interface Props {
  onUpload: (file: File, clientName?: string) => void
  uploading: boolean
  error: string | null
}

export default function UploadZone({ onUpload, uploading, error }: Props) {
  const [dragging, setDragging] = useState(false)
  const [clientName, setClientName] = useState('')

  const handleFile = useCallback(
    (file: File) => {
      const allowed = ['pdf', 'xlsx', 'xls', 'csv']
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!allowed.includes(ext)) {
        alert(`Unsupported file type: .${ext}\nSupported: PDF, Excel (.xlsx/.xls), CSV`)
        return
      }
      onUpload(file, clientName.trim() || undefined)
    },
    [onUpload, clientName]
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
    <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
      {/* Top bar with tool nav */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#154D3E] bg-[#1A5C4A]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Audit Suite</span>
        </div>
        <ToolNav />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#1A5C4A] rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Audit & Annotate</h1>
        </div>
        <p className="text-slate-500 text-sm">AI audit workbench for CPA teams</p>
      </div>

      {/* Client / Engagement field */}
      <div className="w-full max-w-lg mb-4">
        <label className="block text-xs text-slate-500 mb-1.5">
          Client / Engagement <span className="text-slate-400">(optional — labels the document)</span>
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Acme Corp — FY2024"
          maxLength={80}
          disabled={uploading}
          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A5C4A] disabled:opacity-50"
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
          ${dragging ? 'border-[#1A5C4A] bg-[#EEF7F4]' : 'border-slate-200 bg-white'}
          ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:border-[#1A5C4A] hover:bg-[#EEF7F4]'}
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
              <div className="w-12 h-12 border-2 border-[#1A5C4A] border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-700 font-medium">Processing…</p>
            </>
          ) : (
            <>
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${dragging ? 'bg-[#1A5C4A]' : 'bg-slate-100'}`}>
                <Upload className={`w-7 h-7 ${dragging ? 'text-white' : 'text-slate-500'}`} />
              </div>
              <div>
                <p className="text-slate-800 font-medium mb-1">
                  {dragging ? 'Drop to upload' : 'Upload financial document'}
                </p>
                <p className="text-slate-500 text-sm">Drag & drop or click to browse</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {['PDF', 'Excel (.xlsx)', 'CSV'].map((fmt) => (
                  <span key={fmt} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                    {fmt}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 text-red-600 text-sm max-w-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      </div>{/* end flex-1 center */}
    </div>
  )
}
