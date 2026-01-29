import { useState } from 'react'
import { RotateCcw, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ReopenApplicationButton({ application, onReopened }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Show button if application is rejected OR withdrawn
  if (application.status !== 'rejected' && application.status !== 'withdrawn') {
    return null
  }

  const isRejected = application.status === 'rejected'
  const isWithdrawn = application.status === 'withdrawn'

  const handleReopen = async () => {
    try {
      setLoading(true)

      let historicalData = {}

      if (isRejected) {
        // Store rejection data in previous_rejection
        historicalData = {
          previous_rejection: {
            rejected_at: application.updated_at,
            rejection_reason: application.interview_feedback?.rejection_reason || 
                             application.test_feedback?.rejection_reason ||
                             'Previously rejected',
            rejection_stage: application.interview_feedback ? 'interview' : 'test',
            rejection_feedback: application.interview_feedback?.rejection_feedback ||
                               application.test_feedback?.rejection_feedback,
            interview_ratings: application.interview_feedback?.ratings,
            test_scores: application.test_feedback?.scores
          }
        }
      } else if (isWithdrawn) {
        // Store withdrawal data in previous_withdrawal
        historicalData = {
          previous_withdrawal: {
            withdrawn_at: application.updated_at,
            withdrawal_reason: application.withdrawal_data?.reason || 'Previously withdrawn',
            withdrawal_notes: application.withdrawal_data?.notes,
            previous_status: application.withdrawal_data?.previous_status || 'unknown'
          }
        }
      }

      // Update application: move to under_review, save history
      const { error } = await supabase
        .from('applications')
        .update({
          status: 'under_review',
          ...historicalData,
          reopened_at: new Date().toISOString(),
          reopened_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id)

      if (error) throw error

      // Close modal and trigger refresh
      setIsModalOpen(false)
      if (onReopened) {
        onReopened()
      }

      // Show success message
      alert('Application successfully reopened and moved to "Under Review" status.')

    } catch (error) {
      console.error('Error reopening application:', error)
      alert('Failed to reopen application: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getTitle = () => {
    if (isRejected) return 'Reopen Rejected Application'
    if (isWithdrawn) return 'Reopen Withdrawn Application'
    return 'Reopen Application'
  }

  const getDescription = () => {
    if (isRejected) return 'The rejection history will be preserved.'
    if (isWithdrawn) return 'The withdrawal history will be preserved.'
    return 'This will move the application back to "Under Review" status'
  }

  const getReasonText = () => {
    if (isRejected) {
      return application.interview_feedback?.rejection_reason || 
             application.test_feedback?.rejection_reason ||
             'Rejected'
    }
    if (isWithdrawn) {
      return application.withdrawal_data?.reason || 'Withdrawn'
    }
    return ''
  }

  return (
    <>
      {/* Reopen Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
      >
        <RotateCcw className="w-4 h-4" />
        Reopen Application
      </button>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{getTitle()}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  This will move the application back to "Under Review" status. {getDescription()}
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <div className={`${isRejected ? 'bg-red' : 'bg-orange'}-50 border border-${isRejected ? 'red' : 'orange'}-200 rounded-lg p-4 mb-4`}>
              <p className="text-sm text-gray-900">
                <strong>ℹ️ Original {isRejected ? 'Rejection' : 'Withdrawal'} Reason:</strong><br />
                {getReasonText()}
              </p>
            </div>

            {/* Application Info */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference:</span>
                  <span className="font-medium text-gray-900">{application.reference_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Candidate:</span>
                  <span className="font-medium text-gray-900">{application.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Position:</span>
                  <span className="font-medium text-gray-900">{application.applied_rank}</span>
                </div>
              </div>
            </div>

            {/* Notes Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Reopening <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`e.g., '${isWithdrawn ? 'Candidate available again' : 'Better fit for Chief Engineer role'}' or 'New position available that matches their experience'`}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                This note will be visible to other recruiters when viewing this application
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setNotes('')
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Reopening...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reopen Application
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}