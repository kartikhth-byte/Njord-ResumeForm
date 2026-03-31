import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

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

  return createPortal((
    <div 
      className="recruiter-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="recruiter-modal recruiter-modal--narrow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="recruiter-modal__eyebrow">Closure workflow</p>
              <h2 className="recruiter-modal__title">Withdraw application</h2>
              <p className="recruiter-modal__subtitle">
                {application.reference_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="recruiter-modal__close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="recruiter-modal__body space-y-4">
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
              disabled={loading || !withdrawalReason}
              className="workspace-action-button min-w-[12rem] justify-center bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
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
  ), document.body)
}
