import { supabase } from '../lib/supabase'
import { getWorksheetMappingDefaults } from '../constants/worksheetMappingDefaults'
import { getClientRuntimeSettings } from './runtimeSettingsService'

const TEMPLATE_BUCKET = 'worksheet-templates'

function normalizeMappingRow(mapping, customerId) {
  return {
    customer_id: customerId ?? mapping.customer_id ?? null,
    section_key: mapping.section_key ?? mapping.sectionKey ?? '',
    section_label: mapping.section_label ?? mapping.sectionLabel ?? '',
    field_key: mapping.field_key ?? mapping.fieldKey ?? '',
    field_label: mapping.field_label ?? mapping.fieldLabel ?? '',
    source_path: mapping.source_path ?? mapping.sourcePath ?? '',
    sheet_name: mapping.sheet_name ?? mapping.sheetName ?? 'Main',
    cell_ref: mapping.cell_ref ?? mapping.cellRef ?? '',
    transform: mapping.transform ?? 'text',
    sort_order: mapping.sort_order ?? mapping.sortOrder ?? 0,
  }
}

function slugifyCustomerName(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

export async function listWorksheetCustomers() {
  const { data, error } = await supabase
    .from('worksheet_customers')
    .select(`
      *,
      worksheet_templates (
        id,
        file_name,
        storage_path,
        source_extension,
        is_active,
        notes,
        created_at
      )
    `)
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createWorksheetCustomer({ name }) {
  const slug = slugifyCustomerName(name)
  const { data, error } = await supabase
    .from('worksheet_customers')
    .insert({ name: name.trim(), slug })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function uploadWorksheetTemplate({ customer, file, notes = '', onStageChange = null }) {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  if (extension !== 'xlsx') {
    throw new Error('Upload a normalized .xlsx worksheet template.')
  }
  const storagePath = `${customer.slug}/${Date.now()}-${sanitizeFileName(file.name)}`

  onStageChange?.('uploading')
  const { error: uploadError } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

  if (uploadError) throw uploadError

  const { error: deactivateError } = await supabase
    .from('worksheet_templates')
    .update({ is_active: false })
    .eq('customer_id', customer.id)
    .eq('is_active', true)

  if (deactivateError) throw deactivateError

  const { data, error } = await supabase
    .from('worksheet_templates')
    .insert({
      customer_id: customer.id,
      file_name: file.name,
      storage_path: storagePath,
      source_extension: extension || 'xlsx',
      notes,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) throw error
  onStageChange?.('completed')
  return data
}

export async function listWorksheetMappings(customerId, customerSlug) {
  const { data, error } = await supabase
    .from('worksheet_mappings')
    .select('*')
    .eq('customer_id', customerId)
    .order('section_label', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw error

  if (data && data.length > 0) {
    return data.map((entry) => normalizeMappingRow(entry, customerId))
  }

  return getWorksheetMappingDefaults(customerSlug).map((entry) =>
    normalizeMappingRow(entry, customerId)
  )
}

export async function saveWorksheetMappings(customerId, mappings) {
  const payload = mappings.map((mapping, index) => ({
    ...normalizeMappingRow(mapping, customerId),
    sort_order: mapping.sort_order ?? mapping.sortOrder ?? index,
  }))

  const { data, error } = await supabase
    .from('worksheet_mappings')
    .upsert(payload, { onConflict: 'customer_id,field_key' })
    .select('*')

  if (error) throw error
  return data || []
}

export async function getActiveWorksheetTemplate(customerId) {
  const { data, error } = await supabase
    .from('worksheet_templates')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export function getWorksheetExportReadiness(customer) {
  const activeTemplate = (customer?.worksheet_templates || []).find((template) => template.is_active)

  if (!activeTemplate) {
    return {
      ready: false,
      message: 'No active XLSX worksheet template uploaded for this customer.',
    }
  }

  return {
    ready: true,
    message: 'Template ready. Workbook generation will use the uploaded XLSX template.',
  }
}

export async function downloadGeneratedWorksheet({ applicationId, customerId }) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const accessToken = sessionData?.session?.access_token
  if (!accessToken) {
    throw new Error('Authentication is required to generate worksheets')
  }

  const { WORKSHEET_SERVICE_URL = '' } = await getClientRuntimeSettings()
  const targetUrl = WORKSHEET_SERVICE_URL.trim()
    ? `${WORKSHEET_SERVICE_URL.replace(/\/$/, '')}/api/customer-worksheets/generate`
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-customer-worksheet`

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ applicationId, customerId }),
  })

  if (!response.ok) {
    let errorMessage = `Failed to generate worksheet (${response.status})`
    try {
      const body = await response.json()
      errorMessage = body?.error || errorMessage
    } catch {
      // ignore
    }
    throw new Error(errorMessage)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get('Content-Disposition') || ''
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/)
  const fileName = fileNameMatch?.[1] || 'customer-worksheet.xlsx'

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(objectUrl)

  return { fileName }
}
