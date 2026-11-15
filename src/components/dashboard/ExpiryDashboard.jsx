import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Mail, RefreshCw, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../ui/PageHeader'
import SegmentedControl from '../ui/SegmentedControl'
import { useAuth } from '../auth/AuthContext'
import { dateCell } from '../../utils/directoryDisplay'

const URGENCY_CONFIG = {
  all: {
    badgeColor: 'bg-raised text-fg-secondary',
    label: 'All',
    dot: 'bg-fg-muted',
    description: 'Expired or due in 90 days'
  },
  expired: {
    badgeColor: 'bg-danger-soft text-danger',
    label: 'Expired',
    dot: 'bg-danger',
    description: 'Past expiry date'
  },
  critical: {
    badgeColor: 'bg-warning-soft text-warning',
    label: 'Due in 0–30 days',
    dot: 'bg-warning',
    description: 'Within 30 days'
  },
  urgent: {
    badgeColor: 'bg-progress-soft text-progress',
    label: 'Due in 31–60 days',
    dot: 'bg-progress',
    description: '30–60 days'
  },
  moderate: {
    badgeColor: 'bg-success-soft text-success',
    label: 'Due in 61–90 days',
    dot: 'bg-success',
    description: '60–90 days'
  }
}

const DOCUMENT_TYPE_LABELS = {
  passport: 'Passport',
  seaman_book: "Seaman's Book (CDC)",
  seamanbook: "Seaman's Book (CDC)",
  visa: 'Visa',
  coc: 'Certificate of Competency',
  gmdss: 'GMDSS Certificate',
  medical: 'Medical Certificate',
  yellow_fever: 'Yellow Fever Vaccination',
  yellowfever: 'Yellow Fever Vaccination',
  course: 'Training Course',
  endorsement: 'Endorsement'
}

function formatDate(dateString) {
  return dateCell(dateString)
}

function getDocumentTypeLabel(type) {
  return DOCUMENT_TYPE_LABELS[type] || type
}

export default function ExpiryDashboard() {
  const { isOperator } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [documents, setDocuments] = useState([])
  const [selectedUrgency, setSelectedUrgency] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sendingWarnings, setSendingWarnings] = useState(false)
  const [warningsResult, setWarningsResult] = useState('')

  const sendExpiryWarnings = async () => {
    if (!isOperator) return
    // Warnings already go out on a schedule; this is for a deliberate extra send.
    if (!window.confirm('Send expiry warning emails now?')) return
    if (sendingWarnings) return
    setSendingWarnings(true)
    setWarningsResult('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-expiry-warnings', { body: {} })
      if (fnError) throw fnError
      const sent = data?.results?.warnings_sent ?? data?.warnings_sent
      setWarningsResult(typeof sent === 'number' ? `Sent ${sent} warning email${sent === 1 ? '' : 's'}.` : (data?.message || 'Done.'))
    } catch (invokeError) {
      console.error('Failed to process expiry warnings:', invokeError)
      setWarningsResult(invokeError?.message || 'Failed to process expiry warnings.')
    } finally {
      setSendingWarnings(false)
    }
  }

  const fetchExpiringDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: docsError } = await supabase
        .from('v_expiring_documents')
        .select('*')
        .order('expiry_date', { ascending: true })

      if (docsError) throw docsError

      setDocuments(data || [])
    } catch (err) {
      console.error('Error fetching expiring documents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpiringDocuments()
  }, [])

  const summary = useMemo(
    () =>
      documents.reduce(
        (accumulator, document) => {
          accumulator.all += 1
          if (accumulator[document.urgency_level] !== undefined) {
            accumulator[document.urgency_level] += 1
          }
          return accumulator
        },
        { all: 0, expired: 0, critical: 0, urgent: 0, moderate: 0 }
      ),
    [documents]
  )

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return documents.filter((document) => {
      if (selectedUrgency !== 'all' && document.urgency_level !== selectedUrgency) {
        return false
      }

      if (!query) return true

      const haystack = [
        document.document_name,
        document.document_type,
        document.applicant_name,
        document.reference_number
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [documents, searchTerm, selectedUrgency])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-fg-secondary" aria-label="Loading" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="recruiter-panel p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-danger" />
          <div>
            <h3 className="mb-1 font-semibold text-danger">Couldn’t load expiring documents</h3>
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={fetchExpiringDocuments}
              className="mt-4 rounded-control bg-accent-fill px-4 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document expiry"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button onClick={fetchExpiringDocuments} className="workspace-action-button workspace-action-button--secondary">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {isOperator && <button
              onClick={sendExpiryWarnings}
              disabled={sendingWarnings}
              className="workspace-action-button workspace-action-button--primary"
              title="Emails tiered 30/60/90-day warnings for expiring documents"
            >
              <Mail className="h-4 w-4" />
              {sendingWarnings ? 'Sending…' : 'Send expiry warnings'}
            </button>}
          </div>
        }
      />

      {warningsResult ? (
        <div className="rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg-secondary">
          {warningsResult}
        </div>
      ) : null}

      <SegmentedControl label="Expiry window" value={selectedUrgency} onChange={setSelectedUrgency} options={['all', 'expired', 'critical', 'urgent', 'moderate'].map(key => ({ value:key, label:URGENCY_CONFIG[key].label, count:summary[key] }))} size="sm" />

      <div className="recruiter-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-[24rem]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by applicant, reference, or document..."
              className="w-full rounded-card border border-line bg-surface py-3 pl-11 pr-4 text-sm text-fg outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/30"
            />
          </div>
        </div>

        {documents.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">No documents expire in the next 90 days.</p>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-6 text-sm text-fg-secondary">No matching documents. <button className="text-accent-text underline" onClick={() => { setSearchTerm(''); setSelectedUrgency('all') }}>Clear filters</button></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr className="text-left text-xs font-semibold text-fg-muted">
                  <th className="px-5 py-4">Applicant</th>
                  <th className="px-5 py-4">Reference</th>
                  <th className="px-5 py-4">Document</th>
                  <th className="px-5 py-4">Expiry</th>
                  <th className="px-5 py-4">Days</th>
                  <th className="px-5 py-4">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {filteredDocuments.map((document) => {
                  const config = URGENCY_CONFIG[document.urgency_level] || URGENCY_CONFIG.all
                  const isExpired = document.days_until_expiry < 0

                  return (
                    <tr key={`${document.application_id}-${document.document_key || document.document_type}`} className="align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-fg">{document.applicant_name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-fg-secondary">{document.reference_number || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-fg">{document.document_name}</div>
                        {getDocumentTypeLabel(document.document_type) !== document.document_name ? (
                          <div className="text-xs text-fg-muted">{getDocumentTypeLabel(document.document_type)}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm text-fg-secondary">{formatDate(document.expiry_date)}</td>
                      <td className={`px-5 py-4 text-sm font-medium ${isExpired ? 'text-danger' : 'text-fg-secondary'}`}>
                        {isExpired ? `${Math.abs(document.days_until_expiry)} overdue` : document.days_until_expiry}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.badgeColor}`}>
                          {config.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
