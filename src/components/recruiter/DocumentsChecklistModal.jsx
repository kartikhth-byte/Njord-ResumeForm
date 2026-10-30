import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function DocumentsChecklistModal({ application, onClose, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')

  // Default document checklist for maritime recruitment
  const [requiredDocuments] = useState([
    { id: 'coc', label: 'Certificate of Competency (COC)', required: true },
    { id: 'passport', label: 'Valid Passport', required: true },
    { id: 'seaman_book', label: 'Seaman\'s Book', required: true },
    { id: 'medical', label: 'Medical Certificate', required: true },
    { id: 'stcw', label: 'STCW Certificates', required: true },
    { id: 'visa', label: 'Visa (if required)', required: false },
    { id: 'vaccination', label: 'Vaccination Records', required: false },
    { id: 'references', label: 'Employment References', required: false },
  ])

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleConfirm = async () => {
    try {
      setLoading(true)

      // Prepare documents checklist data
      const documentsData = {
        required_documents: requiredDocuments,
        started_at: new Date().toISOString(),
        notes: notes || null
      }

      // Update application status and store documents checklist
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'documents_pending',
          documents_checklist: documentsData,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id)

      if (error) throw error

      // Success
      if (onComplete) {
        onComplete()
      }
      onClose()

    } catch (error) {
      console.error('Error starting documents stage:', error)
      alert('Failed to start documents stage: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return createPortal((
    <div 
      className="recruiter-modal-backdrop"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="recruiter-modal max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="recruiter-modal__title">Start documents collection</h2>
              <p className="recruiter-modal__subtitle">
                {application.reference_number} - {application.full_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="recruiter-modal__close"
          >
            <X className="w-5 h-5 text-fg-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="recruiter-modal__body space-y-6">
          {/* Info Box */}

          {/* Documents Checklist */}
          <div className="space-y-3">
            <h3 className="font-semibold text-fg">Documents Checklist</h3>
            
            <div className="space-y-2">
              {requiredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 p-3 bg-raised rounded-lg border border-line"
                >
                  <CheckCircle className="w-5 h-5 text-fg-muted mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-fg">
                      {doc.label}
                      {doc.required && <span className="text-danger ml-1">*</span>}
                    </p>
                    {!doc.required && (
                      <p className="text-xs text-fg-muted mt-0.5">Optional</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-fg-muted mt-2">
              * Required documents must be submitted before candidate can be hired
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-fg-secondary mb-2">
              Additional Notes <span className="text-fg-muted">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes about document collection..."
              rows={3}
              className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          {/* Warning */}
          <div className="bg-warning-soft border border-warning-line rounded-lg p-4">
            <p className="text-sm text-warning">
              <strong>⚠️ Note:</strong> The candidate is notified to send these documents.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="recruiter-modal__footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="workspace-action-button workspace-action-button--secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="workspace-action-button workspace-action-button--primary min-w-[14rem] justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Start Document Collection
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body)
}
