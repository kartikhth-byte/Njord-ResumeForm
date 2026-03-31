import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, Loader2, Plus, RefreshCw, Save, Upload, XCircle } from 'lucide-react'
import {
  createWorksheetCustomer,
  listWorksheetCustomers,
  listWorksheetMappings,
  saveWorksheetMappings,
  uploadWorksheetTemplate,
} from '../../services/worksheetConfigService'

function groupMappingsBySection(mappings) {
  return mappings.reduce((accumulator, mapping) => {
    const sectionLabel = mapping.section_label
    if (!accumulator[sectionLabel]) {
      accumulator[sectionLabel] = []
    }
    accumulator[sectionLabel].push(mapping)
    return accumulator
  }, {})
}

export default function RecruiterWorksheetMappingsSection() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [mappings, setMappings] = useState([])
  const [newCustomerName, setNewCustomerName] = useState('')
  const [templateNotes, setTemplateNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingTemplate, setUploadingTemplate] = useState(false)
  const [templateUploadStage, setTemplateUploadStage] = useState('idle')
  const [status, setStatus] = useState(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  )

  const groupedMappings = useMemo(
    () => groupMappingsBySection(mappings),
    [mappings]
  )

  const templateStatus = useMemo(() => {
    if (uploadingTemplate || templateUploadStage === 'uploading') {
      return {
        tone: 'info',
        label: 'Uploading',
        message: 'The template file is being uploaded to storage.',
      }
    }
    if (!selectedCustomer) {
      return {
        tone: 'neutral',
        label: 'No customer selected',
        message: 'Select a customer to manage its worksheet template.',
      }
    }
    const activeTemplate = selectedCustomer.worksheet_templates?.find((template) => template.is_active)
    if (!activeTemplate) {
      return {
        tone: 'warning',
        label: 'No template',
        message: 'No active XLSX worksheet template is uploaded for this customer.',
      }
    }
    return {
      tone: 'success',
      label: 'Ready',
      message: 'The uploaded XLSX template is ready for worksheet generation.',
    }
  }, [selectedCustomer, uploadingTemplate, templateUploadStage])

  const loadMappings = useCallback(async (customerId, customerSlug) => {
    if (!customerId || !customerSlug) return
    try {
      const loadedMappings = await listWorksheetMappings(customerId, customerSlug)
      setMappings(loadedMappings)
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to load worksheet mappings.' })
    }
  }, [])

  const loadCustomers = useCallback(async (nextCustomerId = null) => {
    setLoading(true)
    try {
      const loadedCustomers = await listWorksheetCustomers()
      setCustomers(loadedCustomers)
      const targetCustomerId = nextCustomerId || loadedCustomers[0]?.id || ''
      const targetCustomer = loadedCustomers.find((entry) => entry.id === targetCustomerId) || null
      setSelectedCustomerId(targetCustomerId)
      if (targetCustomerId && targetCustomer?.slug) {
        await loadMappings(targetCustomerId, targetCustomer.slug)
      } else {
        setMappings([])
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to load worksheet customers.' })
    } finally {
      setLoading(false)
    }
  }, [loadMappings])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (!selectedCustomerId || loading) return
    if (!selectedCustomer?.slug) return
    loadMappings(selectedCustomerId, selectedCustomer.slug)
  }, [selectedCustomerId, selectedCustomer, loading, loadMappings])

  const handleMappingCellChange = (fieldKey, nextCellRef) => {
    setMappings((current) =>
      current.map((mapping) =>
        mapping.field_key === fieldKey
          ? { ...mapping, cell_ref: nextCellRef.toUpperCase() }
          : mapping
      )
    )
  }

  const handleSaveMappings = async () => {
    if (!selectedCustomerId) return

    setSaving(true)
    setStatus(null)
    try {
      await saveWorksheetMappings(selectedCustomerId, mappings)
      await loadMappings(selectedCustomerId, selectedCustomer?.slug)
      setStatus({ type: 'success', message: 'Worksheet mappings saved successfully.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to save worksheet mappings.' })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return

    setStatus(null)
    try {
      const createdCustomer = await createWorksheetCustomer({ name: newCustomerName })
      setNewCustomerName('')
      await loadCustomers(createdCustomer.id)
      setStatus({ type: 'success', message: 'Customer added successfully.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to create customer.' })
    }
  }

  const handleTemplateUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !selectedCustomer) return

    setUploadingTemplate(true)
    setTemplateUploadStage('uploading')
    setStatus(null)
    try {
      await uploadWorksheetTemplate({
        customer: selectedCustomer,
        file,
        notes: templateNotes,
        onStageChange: setTemplateUploadStage,
      })
      await loadCustomers(selectedCustomer.id)
      setTemplateNotes('')
      setStatus({
        type: 'success',
        message: 'Template uploaded successfully.',
      })
    } catch (error) {
      setTemplateUploadStage('failed')
      setStatus({ type: 'error', message: error.message || 'Failed to upload template.' })
    } finally {
      setUploadingTemplate(false)
      event.target.value = ''
    }
  }

  const handleRefreshTemplateStatus = async () => {
    if (!selectedCustomer) return
    setTemplateUploadStage('refreshing')
    try {
      await loadCustomers(selectedCustomer.id)
      setStatus(null)
    } finally {
      setTemplateUploadStage('idle')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading worksheet settings...</span>
        </div>
      </div>
    )
  }

  const activeTemplate = selectedCustomer?.worksheet_templates?.find((template) => template.is_active)
  const templateStatusClasses = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  }
  const templateStatusIcon = templateStatus.tone === 'success'
    ? <CheckCircle2 className="h-4 w-4" />
    : templateStatus.tone === 'warning'
      ? <XCircle className="h-4 w-4" />
      : <Loader2 className={`h-4 w-4 ${templateStatus.tone === 'info' ? 'animate-spin' : ''}`} />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Worksheet Export Admin</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">Customer Templates &amp; Mappings</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Manage customer worksheet templates and adjust field-to-cell mappings section by section. Upload customer
            templates as normalized XLSX files here. The app will use the uploaded workbook directly during export.
          </p>
        </div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
          <FileSpreadsheet className="h-5 w-5" />
        </span>
      </div>

      {status ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          status.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          {status.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Customer</p>
            <select
              value={selectedCustomerId}
              onChange={(event) => setSelectedCustomerId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <div className="mt-5 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Add Customer</label>
              <input
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                placeholder="New customer name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={handleCreateCustomer}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Customer
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active Template</p>
              <button
                type="button"
                onClick={handleRefreshTemplateStatus}
                disabled={!selectedCustomer || uploadingTemplate || templateUploadStage === 'refreshing'}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${templateUploadStage === 'refreshing' ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p>{activeTemplate ? activeTemplate.file_name : 'No active template uploaded yet.'}</p>
              {activeTemplate?.source_extension ? (
                <p className="text-xs text-slate-500">Source format: .{activeTemplate.source_extension}</p>
              ) : null}
              <div className={`rounded-2xl border px-3 py-3 ${templateStatusClasses[templateStatus.tone]}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {templateStatusIcon}
                  <span>{templateStatus.label}</span>
                </div>
                <p className="mt-1 text-xs leading-5">{templateStatus.message}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <textarea
                value={templateNotes}
                onChange={(event) => setTemplateNotes(event.target.value)}
                rows={3}
                placeholder="Template notes (optional)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              />
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900">
                {uploadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload XLSX Template
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleTemplateUpload}
                  disabled={uploadingTemplate || !selectedCustomer}
                />
              </label>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Editable Mapping</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedCustomer?.name || 'Customer'} Mapping
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Left side shows the worksheet field. Right side is the editable target cell. Complex repeating and
                  computed worksheet logic still remains code-managed for now.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveMappings}
                disabled={saving || !selectedCustomerId}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Mapping
              </button>
            </div>
          </div>

          {Object.entries(groupedMappings).map(([sectionLabel, sectionMappings], sectionIndex) => (
            <div key={`${sectionLabel}-${sectionIndex}`} className="rounded-3xl border border-slate-200 bg-white p-5">
              <h4 className="text-lg font-semibold text-slate-900">{sectionLabel}</h4>
              <div className="mt-4 space-y-3">
                {sectionMappings.map((mapping, index) => (
                  <div
                    key={mapping.field_key || `${sectionLabel}-${mapping.cell_ref || 'row'}-${index}`}
                    className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 md:grid-cols-[minmax(0,1fr),180px]"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{mapping.field_label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {mapping.sheet_name} · {mapping.source_path} · {mapping.transform}
                      </p>
                    </div>
                    <input
                      value={mapping.cell_ref}
                      onChange={(event) => handleMappingCellChange(mapping.field_key, event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
