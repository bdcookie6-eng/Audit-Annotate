import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ExtractedData, Finding, LineItem } from '../types'

interface Props {
  data: ExtractedData
  findings: Finding[]
  selectedFinding: Finding | null
  onSelectFinding: (f: Finding | null) => void
}

function fmt(val: number | null, unit: string): string {
  if (val === null || val === undefined) return '—'
  const multiplier = unit === 'thousands' ? 1000 : unit === 'millions' ? 1_000_000 : 1
  const v = val / multiplier
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  if (Math.abs(v) >= 1) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${v.toFixed(2)}`
}

function fmtFull(val: number | null): string {
  if (val === null || val === undefined) return 'N/A'
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pctChange(cy: number | null, py: number | null): string | null {
  if (cy === null || py === null || py === 0) return null
  const pct = ((cy - py) / Math.abs(py)) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

interface AnnotationPopoverProps {
  finding: Finding
  anchorRef: React.RefObject<HTMLElement>
  onClose: () => void
}

function AnnotationPopover({ finding, anchorRef, onClose }: AnnotationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!anchorRef.current || !popoverRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const top = rect.bottom + 6
    const left = Math.max(8, rect.left - 8)
    setPos({ top: top + window.scrollY, left })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const SeverityIcon = finding.severity === 'error' ? AlertCircle
    : finding.severity === 'warning' ? AlertTriangle : Info
  const severityColors = finding.severity === 'error'
    ? { border: 'border-red-500', bg: 'bg-red-950/80', badge: 'bg-red-600', text: 'text-red-300', icon: 'text-red-400' }
    : finding.severity === 'warning'
    ? { border: 'border-amber-500', bg: 'bg-amber-950/80', badge: 'bg-amber-600', text: 'text-amber-300', icon: 'text-amber-400' }
    : { border: 'border-blue-500', bg: 'bg-blue-950/80', badge: 'bg-blue-600', text: 'text-blue-300', icon: 'text-blue-400' }

  return (
    <div
      ref={popoverRef}
      className={`fixed z-50 w-80 rounded-lg border ${severityColors.border} ${severityColors.bg} shadow-xl backdrop-blur-sm`}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <SeverityIcon className={`w-4 h-4 shrink-0 ${severityColors.icon}`} />
            <span className="text-sm font-semibold text-white leading-tight">{finding.title}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className={`text-xs leading-relaxed mb-3 ${severityColors.text}`}>
          {finding.description}
        </p>

        {(finding.expected_value !== null || finding.actual_value !== null) && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {finding.expected_value !== null && (
              <div className="bg-slate-900/60 rounded p-2">
                <div className="text-xs text-slate-500 mb-0.5">Expected</div>
                <div className="text-sm font-mono font-semibold text-green-300">
                  {fmtFull(finding.expected_value)}
                </div>
              </div>
            )}
            {finding.actual_value !== null && (
              <div className="bg-slate-900/60 rounded p-2">
                <div className="text-xs text-slate-500 mb-0.5">Actual</div>
                <div className={`text-sm font-mono font-semibold ${finding.severity === 'error' ? 'text-red-300' : 'text-amber-300'}`}>
                  {fmtFull(finding.actual_value)}
                </div>
              </div>
            )}
          </div>
        )}

        {finding.field_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-700 pt-2">
            <span className="text-slate-500">Source:</span>
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-300 font-mono">
              {finding.field_name}
            </code>
          </div>
        )}

        {finding.note && (
          <div className="mt-2 text-xs text-slate-400 italic border-t border-slate-700 pt-2">
            Note: {finding.note}
          </div>
        )}
      </div>
    </div>
  )
}

interface AmountCellProps {
  value: number | null
  unit: string
  finding: Finding | null
  isSelected: boolean
  onSelect: (f: Finding | null) => void
}

function AmountCell({ value, unit, finding, isSelected, onSelect }: AmountCellProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    if (!finding) return
    const next = !open
    setOpen(next)
    onSelect(next ? finding : null)
  }

  useEffect(() => {
    if (!isSelected) setOpen(false)
  }, [isSelected])

  const hasFinding = !!finding
  const colorClass = hasFinding
    ? finding.severity === 'error'
      ? 'text-red-300 underline decoration-red-500 decoration-dotted underline-offset-2 cursor-pointer hover:text-red-200'
      : finding.severity === 'warning'
      ? 'text-amber-300 underline decoration-amber-500 decoration-dotted underline-offset-2 cursor-pointer hover:text-amber-200'
      : 'text-blue-300 underline decoration-blue-500 decoration-dotted underline-offset-2 cursor-pointer hover:text-blue-200'
    : 'text-slate-200'

  return (
    <td className="py-2 pl-3 pr-2 w-28">
      {hasFinding ? (
        <>
          <button
            ref={ref}
            className={`font-mono tabular-nums text-sm text-left ${colorClass}`}
            onClick={handleClick}
          >
            {fmt(value, unit)}
          </button>
          {open && finding && (
            <AnnotationPopover
              finding={finding}
              anchorRef={ref as React.RefObject<HTMLElement>}
              onClose={() => { setOpen(false); onSelect(null) }}
            />
          )}
        </>
      ) : (
        <span className="font-mono tabular-nums text-sm text-slate-200">
          {fmt(value, unit)}
        </span>
      )}
    </td>
  )
}

export default function StatementTable({ data, findings, selectedFinding, onSelectFinding }: Props) {
  const { sections = [], total, unit = 'ones', period } = data

  const findingByField = new Map<string, Finding>()
  for (const f of findings) {
    if (f.field_name && f.status === 'open') findingByField.set(f.field_name, f)
  }

  const findingForLabel = (label: string): Finding | null => findingByField.get(label) ?? null

  const labelClass = (item: LineItem): string => {
    if (item.is_total) return 'text-white font-semibold text-sm py-2 pr-3 pl-3'
    if (item.is_subtotal) return 'text-slate-200 font-medium text-sm py-2 pr-3 pl-3'
    return 'text-slate-300 text-sm py-2 pr-3'
  }

  const rowBg = (item: LineItem, finding: Finding | null): string => {
    if (item.is_total) return 'bg-slate-700/60 border-t border-slate-500'
    if (item.is_subtotal) return 'bg-slate-800/60 border-t border-slate-700'
    if (finding?.severity === 'error') return 'bg-red-950/20 hover:bg-red-950/30'
    if (finding?.severity === 'warning') return 'bg-amber-950/20 hover:bg-amber-950/30'
    return 'hover:bg-slate-800/30'
  }

  const hasPriorYear = sections.some(s => s.line_items.some(li => li.prior_year !== null))

  const renderRow = (item: LineItem) => {
    const finding = findingForLabel(item.label)
    const isSelected = selectedFinding?.id === finding?.id
    const change = pctChange(item.current_year, item.prior_year)

    return (
      <tr key={item.label} className={`transition-colors ${rowBg(item, finding)} ${isSelected ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
        {/* Dollar value — LEFT side, clickable if flagged */}
        <AmountCell
          value={item.current_year}
          unit={unit}
          finding={finding}
          isSelected={isSelected}
          onSelect={onSelectFinding}
        />

        {/* Label */}
        <td
          className={labelClass(item)}
          style={{ paddingLeft: (item.is_total || item.is_subtotal) ? undefined : `${12 + (item.indent_level ?? 0) * 20}px` }}
        >
          {item.label}
        </td>

        {hasPriorYear && (
          <>
            <td className="py-2 px-3 text-sm text-right font-mono tabular-nums text-slate-400 w-24">
              {fmt(item.prior_year, unit)}
            </td>
            <td className={`py-2 pl-2 pr-3 text-xs text-right font-mono tabular-nums w-16 ${
              change
                ? parseFloat(change) > 0 ? 'text-green-400' : parseFloat(change) < 0 ? 'text-red-400' : 'text-slate-500'
                : 'text-slate-600'
            }`}>
              {change ?? '—'}
            </td>
          </>
        )}

        {/* Finding badge */}
        <td className="py-2 pl-1 pr-3 text-center w-6">
          {finding && finding.number != null && (
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold ${
              finding.severity === 'error'   ? 'bg-red-600 text-white' :
              finding.severity === 'warning' ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
            }`}>
              {finding.number}
            </span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 pb-0 border-b border-slate-700 mb-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-white capitalize">
            {data.statement_type?.replace(/_/g, ' ')}
          </h2>
          {period && <span className="text-xs text-slate-400">{period}</span>}
        </div>
        {data.unit !== 'ones' && (
          <p className="text-xs text-slate-500 pb-2">Figures in {data.unit} of {data.currency}</p>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
            <th className="py-2.5 pl-3 pr-2 text-left font-medium w-28">Amount</th>
            <th className="py-2.5 px-3 text-left font-medium">Line Item</th>
            {hasPriorYear && (
              <>
                <th className="py-2.5 px-3 text-right font-medium w-24">Prior Year</th>
                <th className="py-2.5 pl-2 pr-3 text-right font-medium w-16">Change</th>
              </>
            )}
            <th className="py-2.5 px-3 w-6" />
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <React.Fragment key={section.name}>
              <tr>
                <td
                  colSpan={hasPriorYear ? 5 : 3}
                  className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50 border-t border-slate-800"
                >
                  {section.name}
                </td>
              </tr>
              {section.line_items.map(renderRow)}
              {section.subtotal && renderRow(section.subtotal)}
            </React.Fragment>
          ))}
          {total && renderRow(total)}
        </tbody>
      </table>

      {sections.length === 0 && (
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
          No structured data extracted. View the raw document tab.
        </div>
      )}
    </div>
  )
}
