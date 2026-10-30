import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, Mail, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import PageHeader from '../ui/PageHeader'

const URGENCY_CONFIG = {
  all: {
    badgeColor: 'bg-raised text-fg-secondary',
    label: 'All',
    dot: 'bg-fg-muted',
    description: 'Next 90 days'
  },
  expired: {
    badgeColor: 'bg-danger-soft text-danger',
    label: 'Expired',
    dot: 'bg-danger',
    description: 'Past expiry date'
  },
  critical: {
    badgeColor: 'bg-warning-soft text-warning',
    label: 'Critical',
    dot: 'bg-warning',
    description: 'Within 30 days'
  },
  urgent: {
    badgeColor: 'bg-warning-soft text-warning',
    label: 'Urgent',
    dot: 'bg-warning',
    description: '30–60 days'
  },
  moderate: {
    badgeColor: 'bg-success-soft text-success',
    label: 'Moderate',
    dot: 'bg-success',
    description: '60–90 days'
  }
}

const DOCUMENT_TYPE_LABELS = {
  passport: 'Passport',
  seaman_book: "Seaman's Book (CDC)",
  visa: 'Visa',
  coc: 'Certificate of Competency',
  gmdss: 'GMDSS Certificate',
  medical: 'Medical Certificate',
  yellow_fever: 'Yellow Fever Vaccination',
  course: 'Training Course',
  endorsement: 'Endorsement'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getDocumentTypeLabel(type) {
  return DOCUMENT_TYPE_LABELS[type] || type
}

export default function ExpiryDashboard() {
  const { user } = useAuth()
  const { role, loading: permLoading } = usePermissions(user)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [documents, setDocuments] = useState([])
  const [selectedUrgency, setSelectedUrgency] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [sendingWarnings, setSendingWarnings] = useState(false)
  const [warningsResult, setWarningsResult] = useState('')

  const sendExpiryWarnings = async () => {
    if (sendingWarnings) return
    setSendingWarnings(true)
    setWarningsResult('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('process-expiry-warnings', { body: {} })
      if (fnError) throw fnError
      setWarningsResult(data?.message || 'Expiry warning emails processed.')
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
      setLastSyncedAt(new Date())
    } catch (err) {
      console.error('Error fetching expiring documents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!permLoading) {
      fetchExpiringDocuments()
    }
  }, [permLoading])

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

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-fg-secondary" />
          <p className="text-fg-secondary">Loading expiry workspace...</p>
        </div>
      </div>
    )
  }

  if (role !== 'Recruiter' && role !== 'Master Recruiter') {
    return <Navigate to="/recruiter/dashboard" replace />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-fg-secondary" />
          <p className="text-fg-secondary">Loading expiring documents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="recruiter-panel p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-danger" />
          <div>
            <h3 className="mb-1 font-semibold text-danger">Error Loading Expiry Data</h3>
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={fetchExpiringDocuments}
              className="mt-4 rounded-control bg-accent-fill px-4 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover"
            >
              Refresh data
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
            <p className="text-sm text-fg-muted">
              {lastSyncedAt
                ? `Last synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Sync pending'}
            </p>
            <button onClick={fetchExpiringDocuments} className="workspace-action-button">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={sendExpiryWarnings}
              disabled={sendingWarnings}
              className="workspace-action-button workspace-action-button--primary"
              title="Emails tiered 30/60/90-day warnings for expiring documents"
            >
              <Mail className="h-4 w-4" />
              {sendingWarnings ? 'Sending…' : 'Send expiry warnings'}
            </button>
          </div>
        }
      />

      {warningsResult ? (
        <div className="rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg-secondary">
          {warningsResult}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {['all', 'expired', 'critical', 'urgent', 'moderate'].map((key) => {
          const config = URGENCY_CONFIG[key]
          const active = selectedUrgency === key

          return (
            <button
              key={key}
              onClick={() => setSelectedUrgency(key)}
              aria-pressed={active}
              className={`rounded-card border p-4 text-left transition ${
                active ? 'border-accent bg-raised' : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <p className="flex items-center gap-2 text-xs font-medium text-fg-secondary">
                <span className={`h-2 w-2 rounded-full ${config.dot}`} aria-hidden="true" />
                {config.label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-fg">{summary[key]}</p>
              <p className="mt-1 text-xs text-fg-muted">{config.description}</p>
            </button>
          )
        })}
      </div>

      <div className="recruiter-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-fg">
              {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}
            </h2>
          </div>

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
          <div className="p-6">
            <div className="rounded-control border border-dashed border-success-line bg-success-soft px-6 py-12 text-center">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-success" />
              <h3 className="text-xl font-semibold text-fg">All clear</h3>
              <p className="mt-2 text-sm text-fg-secondary">Nothing expires in the next 90 days.</p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-6">
            <div className="rounded-control border border-dashed border-line-input bg-raised px-6 py-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-fg-muted" />
              <h3 className="text-lg font-semibold text-fg">No matching documents</h3>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-raised">
                <tr className="text-left text-xs font-semibold text-fg-muted">
                  <th className="px-5 py-4">Applicant</th>
                  <th className="px-5 py-4">Reference</th>
                  <th className="px-5 py-4">Document</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Expiry</th>
                  <th className="px-5 py-4">Days</th>
                  <th className="px-5 py-4">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {filteredDocuments.map((document) => {
                  const config = URGENCY_CONFIG[document.urgency_level]
                  const isExpired = document.days_until_expiry < 0

                  return (
                    <tr key={`${document.application_id}-${document.document_type}`} className="align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-fg">{document.applicant_name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-fg-secondary">{document.reference_number || 'N/A'}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-fg">{document.document_name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-fg-secondary">
                        <div className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-fg-muted" />
                          {getDocumentTypeLabel(document.document_type)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-fg-secondary">
                        <div className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-fg-muted" />
                          {formatDate(document.expiry_date)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <div className={`inline-flex items-center gap-2 font-medium ${isExpired ? 'text-danger' : 'text-fg-secondary'}`}>
                          <Clock className="h-4 w-4 text-fg-muted" />
                          {isExpired
                            ? `${Math.abs(document.days_until_expiry)} days overdue`
                            : `${document.days_until_expiry} days remaining`}
                        </div>
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
