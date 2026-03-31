import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabase'
import PageHeader from '../ui/PageHeader'

const URGENCY_CONFIG = {
  all: {
    badgeColor: 'bg-slate-100 text-slate-700',
    label: 'All',
    description: 'Every tracked expiry inside the current 90-day window'
  },
  expired: {
    badgeColor: 'bg-red-100 text-red-800',
    cardClass: 'border-red-200 bg-red-50',
    label: 'Expired',
    description: 'Already past the document expiry date'
  },
  critical: {
    badgeColor: 'bg-orange-100 text-orange-800',
    cardClass: 'border-orange-200 bg-orange-50',
    label: 'Critical',
    description: 'Expires within 30 days'
  },
  urgent: {
    badgeColor: 'bg-yellow-100 text-yellow-800',
    cardClass: 'border-yellow-200 bg-yellow-50',
    label: 'Urgent',
    description: 'Expires within 30-60 days'
  },
  moderate: {
    badgeColor: 'bg-emerald-100 text-emerald-800',
    cardClass: 'border-emerald-200 bg-emerald-50',
    label: 'Moderate',
    description: 'Expires within 60-90 days'
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
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Loading expiry workspace...</p>
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
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-600">Loading expiring documents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="recruiter-panel p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600" />
          <div>
            <h3 className="mb-1 font-semibold text-red-900">Error Loading Expiry Data</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchExpiringDocuments}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
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
        eyebrow="Expiry Workspace"
        title="Document Expiry"
        description="Track expiring applicant documents, narrow the urgency bucket, and review the affected records in one table."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-slate-500">
              {lastSyncedAt
                ? `Last synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Sync pending'}
            </p>
            <button onClick={fetchExpiringDocuments} className="workspace-action-button">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {['all', 'expired', 'critical', 'urgent', 'moderate'].map((key) => {
          const config = URGENCY_CONFIG[key]
          const active = selectedUrgency === key

          return (
            <button
              key={key}
              onClick={() => setSelectedUrgency(key)}
              className={`rounded-3xl border p-5 text-left transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : `${config.cardClass || 'border-slate-200 bg-white'} hover:border-slate-300 hover:shadow-sm`
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${active ? 'text-white/70' : 'text-slate-500'}`}>
                    {config.label}
                  </p>
                  <h3 className={`mt-3 text-4xl font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>
                    {summary[key]}
                  </h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-white/15 text-white' : config.badgeColor}`}>
                  {config.label}
                </span>
              </div>
              <p className={`mt-4 text-sm ${active ? 'text-white/75' : 'text-slate-600'}`}>
                {config.description}
              </p>
            </button>
          )
        })}
      </div>

      <div className="recruiter-panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="recruiter-page-header__eyebrow !mb-2">Results</p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {selectedUrgency === 'all'
                ? 'Showing every tracked document inside the expiry window.'
                : `Filtered to ${URGENCY_CONFIG[selectedUrgency].label.toLowerCase()} documents.`}
            </p>
          </div>

          <div className="relative w-full lg:w-[24rem]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by applicant, reference, or document..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-6">
            <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 px-6 py-12 text-center">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
              <h3 className="text-xl font-semibold text-slate-900">All clear</h3>
              <p className="mt-2 text-sm text-slate-600">
                No documents are expiring within the next 90 days.
              </p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-6">
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900">No matching documents</h3>
              <p className="mt-2 text-sm text-slate-500">
                Clear the urgency filter or adjust the search term to broaden the result set.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-5 py-4">Applicant</th>
                  <th className="px-5 py-4">Reference</th>
                  <th className="px-5 py-4">Document</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Expiry</th>
                  <th className="px-5 py-4">Days</th>
                  <th className="px-5 py-4">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredDocuments.map((document) => {
                  const config = URGENCY_CONFIG[document.urgency_level]
                  const isExpired = document.days_until_expiry < 0

                  return (
                    <tr key={`${document.application_id}-${document.document_type}`} className="align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{document.applicant_name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{document.reference_number || 'N/A'}</td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{document.document_name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          {getDocumentTypeLabel(document.document_type)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {formatDate(document.expiry_date)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <div className={`inline-flex items-center gap-2 font-medium ${isExpired ? 'text-red-700' : 'text-slate-700'}`}>
                          <Clock className="h-4 w-4 text-slate-400" />
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
