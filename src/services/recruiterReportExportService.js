import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { supabase } from '../lib/supabase'

function sanitizeFileName(value) {
  return String(value || 'report')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function escapeCsvCell(value) {
  const cell = String(value ?? '')
  return `"${cell.replaceAll('"', '""')}"`
}

function downloadBlob({ filename, mimeType, content }) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)
}

async function hashRowIds(rowIds = []) {
  const normalized = [...new Set((rowIds || []).filter(Boolean).map((value) => String(value)))].sort()
  const encoded = new TextEncoder().encode(JSON.stringify(normalized))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function sanitizeExportMetadata(value, depth = 0) {
  if (value == null) return value
  if (depth > 2) return null
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeExportMetadata(entry, depth + 1))
  }
  if (typeof value === 'string') {
    return value.slice(0, 200)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 25)
        .map(([key, entry]) => [key.slice(0, 80), sanitizeExportMetadata(entry, depth + 1)])
    )
  }
  return null
}

export async function logRecruiterExport({
  reportType,
  exportFormat,
  rowIds = [],
  rowCount = rowIds.length,
  filters = {},
  sort = {},
  notesIncluded = false,
  prospectId = null,
  requirementId = null,
  applicationId = null,
}) {
  const rowIdsHash = await hashRowIds(rowIds)
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  if (!sessionData?.session?.user?.id) return null

  const payload = {
    report_type: reportType,
    export_format: exportFormat,
    row_count: rowCount,
    row_ids_hash: rowIdsHash,
    notes_included: notesIncluded,
    filters: sanitizeExportMetadata(filters),
    sort: sanitizeExportMetadata(sort),
  }

  if (prospectId) payload.prospect_id = prospectId
  if (requirementId) payload.requirement_id = requirementId
  if (applicationId) payload.application_id = applicationId

  const { error } = await supabase.functions.invoke('log-recruiter-export', {
    body: payload,
  })

  if (error) {
    throw error
  }

  return payload
}

export async function downloadCsvReport({
  filename,
  columns,
  rows,
}) {
  const headerLine = columns.map((column) => escapeCsvCell(column.label)).join(',')
  const bodyLines = rows.map((row) => columns.map((column) => escapeCsvCell(column.value(row))).join(','))
  const csv = [headerLine, ...bodyLines].join('\n')

  downloadBlob({
    filename: `${sanitizeFileName(filename)}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content: csv,
  })
}

export async function downloadPdfReport({
  filename,
  title,
  subtitle = '',
  summaryItems = [],
  tables = [],
  footerNote = '',
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(title, pageWidth / 2, 42, { align: 'center' })

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(subtitle, pageWidth / 2, 60, { align: 'center', maxWidth: pageWidth - 80 })
  }

  let y = subtitle ? 86 : 70

  if (summaryItems.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Summary', 'Value']],
      body: summaryItems.map((item) => [item.label, String(item.value ?? '')]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 20
  }

  tables.forEach((table, index) => {
    if (index > 0 || summaryItems.length > 0) {
      if (y > 700) {
        doc.addPage()
        y = 40
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text(table.title, 40, y)
    y += 8

    doc.autoTable({
      startY: y,
      head: [table.headers],
      body: table.rows,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 18
  })

  if (footerNote) {
    if (y > 760) {
      doc.addPage()
      y = 40
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(footerNote, 40, y, { maxWidth: pageWidth - 80 })
  }

  const pdfBlob = doc.output('blob')
  downloadBlob({
    filename: `${sanitizeFileName(filename)}.pdf`,
    mimeType: 'application/pdf',
    content: pdfBlob,
  })
}
