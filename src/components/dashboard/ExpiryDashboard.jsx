// src/components/dashboard/ExpiryDashboard.jsx
// Dashboard to view all expiring documents grouped by urgency

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import DashboardHeader from './DashboardHeader'
import { AlertCircle, Calendar, FileText, Clock, CheckCircle, RefreshCw } from 'lucide-react'


const URGENCY_CONFIG = {
  expired: {
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    badgeColor: 'bg-red-100 text-red-800',
    icon: '🔴',
    label: 'EXPIRED',
    description: 'Documents that have already expired'
  },
  critical: {
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    badgeColor: 'bg-orange-100 text-orange-800',
    icon: '🟠',
    label: 'CRITICAL',
    description: 'Expires within 30 days'
  },
  urgent: {
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    icon: '🟡',
    label: 'URGENT',
    description: 'Expires within 30-60 days'
  },
  moderate: {
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    badgeColor: 'bg-green-100 text-green-800',
    icon: '🟢',
    label: 'MODERATE',
    description: 'Expires within 60-90 days'
  }
}

export default function ExpiryDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [documents, setDocuments] = useState([])
  const [summary, setSummary] = useState({
    expired: 0,
    critical: 0,
    urgent: 0,
    moderate: 0
  })
  const [selectedUrgency, setSelectedUrgency] = useState('all')

  useEffect(() => {
    fetchExpiringDocuments()
  }, [])

  const fetchExpiringDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch expiring documents from the view
      const { data: docs, error: docsError } = await supabase
        .from('v_expiring_documents')
        .select('*')
        .order('expiry_date', { ascending: true })

      if (docsError) throw docsError

      setDocuments(docs || [])

      // Calculate summary
      const summary = {
        expired: 0,
        critical: 0,
        urgent: 0,
        moderate: 0
      }

      docs?.forEach(doc => {
        if (summary[doc.urgency_level] !== undefined) {
          summary[doc.urgency_level]++
        }
      })

      setSummary(summary)

    } catch (err) {
      console.error('Error fetching expiring documents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocuments = selectedUrgency === 'all' 
    ? documents 
    : documents.filter(doc => doc.urgency_level === selectedUrgency)

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDocumentTypeLabel = (type) => {
    const labels = {
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
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading expiring documents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-900 font-semibold mb-1">Error Loading Documents</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={fetchExpiringDocuments}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalDocuments = documents.length

  return (
  <div className="space-y-6">
    {/* Header with Back Navigation */}
    <DashboardHeader
      title="Document Expiry Dashboard"
      description="Monitor and manage document expiry dates for all applicants"
      onRefresh={fetchExpiringDocuments}
    />
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedUrgency(selectedUrgency === key ? 'all' : key)}
            className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg p-5 text-left transition-all hover:shadow-lg ${
              selectedUrgency === key ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">{config.icon}</span>
              <span className={`text-3xl font-bold ${config.textColor}`}>
                {summary[key]}
              </span>
            </div>
            <h3 className={`font-semibold ${config.textColor} text-sm mb-1`}>
              {config.label}
            </h3>
            <p className="text-xs text-gray-600">
              {config.description}
            </p>
          </button>
        ))}
      </div>

      {/* Filter Info */}
      {selectedUrgency !== 'all' && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{URGENCY_CONFIG[selectedUrgency].icon}</span>
            <span className="text-blue-900 font-medium">
              Showing {filteredDocuments.length} {URGENCY_CONFIG[selectedUrgency].label} documents
            </span>
          </div>
          <button
            onClick={() => setSelectedUrgency('all')}
            className="text-blue-700 hover:text-blue-900 text-sm font-medium"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Documents List */}
      {totalDocuments === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            All Clear! 🎉
          </h3>
          <p className="text-gray-600">
            No documents are expiring within the next 90 days
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            No documents in this category
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => {
            const config = URGENCY_CONFIG[doc.urgency_level]
            const isExpired = doc.days_until_expiry < 0
            
            return (
              <div
                key={doc.id}
                className={`${config.bgColor} ${config.borderColor} border rounded-lg p-5 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Document Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {doc.document_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {doc.applicant_name} • {doc.reference_number}
                        </p>
                      </div>
                    </div>

                    <div className="ml-11 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          {getDocumentTypeLabel(doc.document_type)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          Expires: {formatDate(doc.expiry_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className={`font-semibold ${config.textColor}`}>
                          {isExpired 
                            ? `${Math.abs(doc.days_until_expiry)} days overdue`
                            : `${doc.days_until_expiry} days remaining`
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Urgency Badge */}
                  <span className={`${config.badgeColor} px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap`}>
                    {config.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer Info */}
      {totalDocuments > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Automatic Notifications</p>
              <p>
                Applicants receive email warnings at 90, 60, and 30 days before expiry. 
                The system runs daily at 9 AM UTC to check for expiring documents.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}