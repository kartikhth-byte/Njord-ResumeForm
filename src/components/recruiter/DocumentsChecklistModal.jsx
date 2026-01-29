import { useState } from 'react'
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

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
      onClick={(e) => {
        // Close if clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-[10001]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Start Documents Collection</h2>
              <p className="text-sm text-gray-600">
                {application.reference_number} - {application.full_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>📋 Required Documents:</strong> The following documents will need to be collected from the candidate before they can be marked as "Hired". You can track document submission progress in the application details.
            </p>
          </div>

          {/* Documents Checklist */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Documents Checklist</h3>
            
            <div className="space-y-2">
              {requiredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {doc.label}
                      {doc.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {!doc.required && (
                      <p className="text-xs text-gray-500 mt-0.5">Optional</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              * Required documents must be submitted before candidate can be hired
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes about document collection..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">
              <strong>⚠️ Note:</strong> Moving to "Documents Pending" will send a notification to the candidate requesting these documents. Make sure the candidate has accepted the offer before proceeding.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
  )
}