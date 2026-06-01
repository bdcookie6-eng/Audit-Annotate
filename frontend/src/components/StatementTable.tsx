import React from 'react'
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
  const v = val / multiplier  // display in original units
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  if (Math.abs(v) >= 1) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${v.toFixed(2)}`
}

function pctChange(cy: number | null, py: number | null): string | null {
  if (cy === null || py === null || py === 0) return null
  const pct = ((cy - py) / Math.abs(py)) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

export default function StatementTable({ data, findings, selectedFinding, onSelectFinding }: Props) {
  const { sections = [], total, unit = 'ones', period } = data

  // Build lookup maps from field_name → finding
  const findingByField = new Map<string, Finding>()
  for (const f of findings) {
    if (f.field_name && f.status === 'open') findingByField.set(f.field_name, f)
  }

  const errorFields = new Set(
    findings.filter(f => f.severity === 'error' && f.status === 'open').map(f => f.field_name)
  )
  const warningFields = new Set(
    findings.filter(f => f.severity === 'warning' && f.status === 'open').map(f => f.field_name)
  )

  const findingForField = (label: string): Finding | null => findingByField.get(label) ?? null

  const rowClass = (label: string, isSubtotal: boolean, isTotal: boolean): string => {
    const base = isTotal
      ? 'bg-slate-700/60 font-semibold text-white border-t border-slate-500'
      : isSubtotal
      ? 'bg-slate-800/60 font-medium text-slate-200 border-t border-slate-700'
      : 'hover:bg-slate-800/30 text-slate-300'

    if (errorFields.has(label)) return `${base} bg-red-950/30 border-l-2 border-l-red-500`
    if (warningFields.has(label)) return `${base} bg-amber-950/30 border-l-2 border-l-amber-500`
    return base
  }

  const renderRow = (item: LineItem) => {
    const finding = findingForField(item.label)
    const change = pctChange(item.current_year, item.prior_year)
    const isSelected = selectedFinding?.id === finding?.id

    return (
      <tr
        key={item.label}
        className={`
          transition-colors cursor-default
          ${rowClass(item.label, item.is_subtotal, item.is_total)}
          ${isSelected ? 'ring-1 ring-inset ring-blue-400' : ''}
          ${finding ? 'cursor-pointer' : ''}
        `}
        onClick={() => finding && onSelectFinding(isSelected ? null : finding)}
      >
        <td
          className="py-2 pr-4 text-sm"
          style={{ paddingLeft: `${12 + (item.indent_level ?? 0) * 20}px` }}
        >
          {item.label}
        </td>
        <td className="py-2 px-4 text-sm text-right font-mono tabular-nums">
          {fmt(item.current_year, unit)}
        </td>
        {item.prior_year !== undefined && (
          <>
            <td className="py-2 px-4 text-sm text-right font-mono tabular-nums text-slate-400">
              {fmt(item.prior_year, unit)}
            </td>
            <td className={`py-2 pl-4 text-xs text-right font-mono tabular-nums ${
              change
                ? parseFloat(change) > 0 ? 'text-green-400' : parseFloat(change) < 0 ? 'text-red-400' : 'text-slate-500'
                : 'text-slate-600'
            }`}>
              {change ?? '—'}
            </td>
          </>
        )}
        <td className="py-2 pl-2 pr-3 text-center w-8">
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

  const hasPriorYear = sections.some(s =>
    s.line_items.some(li => li.prior_year !== null)
  )

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
          <p className="text-xs text-slate-500 pb-2">
            Figures in {data.unit} of {data.currency}
          </p>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
            <th className="py-2.5 px-3 text-left font-medium">Line Item</th>
            <th className="py-2.5 px-4 text-right font-medium">Current Year</th>
            {hasPriorYear && (
              <>
                <th className="py-2.5 px-4 text-right font-medium">Prior Year</th>
                <th className="py-2.5 pl-4 text-right font-medium">Change</th>
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
