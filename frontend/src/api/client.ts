import type { Document, ReportDraft } from '../types'

const BASE = '/api'

export async function uploadDocument(file: File): Promise<{ id: string; status: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/documents/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Upload failed')
  }
  return res.json()
}

export async function pollDocumentStatus(
  id: string
): Promise<{ id: string; status: string; error_message: string | null }> {
  const res = await fetch(`${BASE}/documents/${id}/status`)
  if (!res.ok) throw new Error('Status check failed')
  return res.json()
}

export async function getDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/documents/${id}`)
  if (!res.ok) throw new Error('Failed to fetch document')
  return res.json()
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/documents/`)
  if (!res.ok) throw new Error('Failed to list documents')
  return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`${BASE}/documents/${id}`, { method: 'DELETE' })
}

export async function updateFinding(
  docId: string,
  findingId: string,
  patch: { status?: string; note?: string }
): Promise<void> {
  await fetch(`${BASE}/documents/${docId}/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export async function getSummary(docId: string): Promise<{ summary: string }> {
  const res = await fetch(`${BASE}/chat/summary/${docId}`)
  if (!res.ok) throw new Error('Failed to get summary')
  return res.json()
}

export function streamChatMessage(
  docId: string,
  message: string,
  history: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): void {
  fetch(`${BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: docId, message, history }),
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        onError('Chat request failed')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) onChunk(parsed.text)
            if (parsed.error) onError(parsed.error)
          } catch (_) { /* ignore malformed chunks */ }
        }
      }
      onDone()
    })
    .catch((e) => onError(e.message))
}

export async function draftReport(documentIds: string[]): Promise<ReportDraft> {
  const res = await fetch(`${BASE}/report/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids: documentIds }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Failed to generate report draft')
  }
  return res.json()
}

export async function generateReport(docId: string): Promise<string> {
  const draft = await draftReport([docId])
  const { report, figure_map } = draft
  const lines: string[] = [report.title, '']
  if (report.addressee) lines.push(`To the ${report.addressee}`, '')
  for (const section of report.sections) {
    lines.push(section.heading.toUpperCase(), '')
    for (const para of section.paragraphs) {
      const resolved = para.replace(/\{\{(fig_\d+)\}\}/g, (_, id) => {
        const fig = figure_map.find(f => f.id === id)
        return fig ? fig.display : id
      })
      lines.push(resolved, '')
    }
  }
  if (report.signature) lines.push(report.signature)
  if (report.location) lines.push(report.location)
  if (report.date) lines.push(report.date)
  return lines.join('\n')
}
