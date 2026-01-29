import { useState } from 'react'
import { XCircle, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function WithdrawalModal({ application, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  const [withdrawalReason, setWithdrawalReason] = useState('')
  const [withdrawalNotes, setWithdrawalNotes] = useState('')

  const withdrawalReasons = [
    'Candidate declined offer',
    'Candidate accepted another offer',
    'Candidate not responding',
    'Failed to provide required documents',
    'Failed background check',
    'Failed medical examination',
    'Visa issues',
    'Other'
  ]

  const handleConfirm = async () => {
    if (!withdrawalReason) {
      alert('Please select a withdrawal reason')
      return
    }

    try {
      setLoading(true)

      // Prepare withdrawal data
      const withdrawalData = {
        reason: withdrawalReason,
        notes: withdrawalNotes || null,
        withdrawn_at: new Date().toISOString(),
        previous_status: application.status
      }

      // Update application status
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'withdrawn',
          withdrawal_data: withdrawalData,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id)

      if (error) throw error

      // Success
      if (onConfirm) {
        onConfirm()
      }
      onClose()

    } catch (error) {
      console.error('Error withdrawing application:', error)
      alert('Failed to withdraw application: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full relative z-[10001]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Withdraw Application</h2>
              <p className="text-sm text-gray-600">
                {application.reference_number}
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
        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-900">
              <strong>⚠️ Important:</strong> This will mark the application as "Withdrawn". The candidate information will be preserved, and you can reopen the application later if needed.
            </p>
          </div>

          {/* Application Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Candidate:</span>
                <span className="font-medium text-gray-900">{application.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Status:</span>
                <span className="font-medium text-gray-900 capitalize">
                  {application.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Position:</span>
                <span className="font-medium text-gray-900">{application.applied_rank}</span>
              </div>
            </div>
          </div>

          {/* Withdrawal Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Withdrawal <span className="text-red-500">*</span>
            </label>
            <select
              value={withdrawalReason}
              onChange={(e) => setWithdrawalReason(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Select a reason...</option>
              {withdrawalReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              value={withdrawalNotes}
              onChange={(e) => setWithdrawalNotes(e.target.value)}
              placeholder="Add any additional details about the withdrawal..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
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
              disabled={loading || !withdrawalReason}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Withdrawing...
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  Withdraw Application
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}