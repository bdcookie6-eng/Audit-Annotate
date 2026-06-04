export interface LineItem {
  label: string
  current_year: number | null
  prior_year: number | null
  is_subtotal: boolean
  is_total: boolean
  indent_level: number
}

export interface StatementSection {
  name: string
  line_items: LineItem[]
  subtotal: LineItem | null
}

export interface ExtractedData {
  statement_type: string
  period: string | null
  currency: string
  unit: string
  sections: StatementSection[]
  total: LineItem | null
  _raw_text?: string
}

export type FindingStatus = 'open' | 'approved' | 'dismissed' | 'noted'
export type FindingSeverity = 'error' | 'warning' | 'info'

export interface FindingCoordinates {
  page: number
  x: number   // 0-1 fraction of page width
  y: number   // 0-1 fraction of page height
  w: number
  h: number
}

export interface Finding {
  id: string
  document_id: string
  check_type: string
  severity: FindingSeverity
  title: string
  description: string
  field_name: string | null
  expected_value: number | null
  actual_value: number | null
  status: FindingStatus
  note: string | null
  coordinates: FindingCoordinates | null
  number?: number   // assigned at render time, not stored
  created_at: string | null
}

export type DocumentStatus = 'processing' | 'ready' | 'error'

export interface Document {
  id: string
  filename: string
  file_type: string
  statement_type: string | null
  extracted_data: ExtractedData | null
  status: DocumentStatus
  error_message: string | null
  findings: Finding[]
  created_at: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Report draft types

export interface ReportFigure {
  id: string
  display: string
  label: string
  source_document_id: string
  source_document_name: string
  source_section: string
  source_line_item: string
  report_section_id: string
  report_section_heading: string
}

export interface ReportSection {
  id: string
  heading: string
  paragraphs: string[]
}

export interface AuditReport {
  title: string
  addressee: string
  sections: ReportSection[]
  signature: string
  date: string
  location: string
}

export interface ReportDraft {
  report: AuditReport
  figure_map: ReportFigure[]
}
