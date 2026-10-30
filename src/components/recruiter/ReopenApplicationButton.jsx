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
        className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-[14px] border border-warning-line bg-warning-soft px-4 py-3 font-semibold text-warning transition hover:bg-warning-soft"
      >
        <RotateCcw className="w-4 h-4" />
        Reopen Application
      </button>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="recruiter-modal-backdrop">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="recruiter-modal recruiter-modal--narrow relative">
            <div className="recruiter-modal__header">
              <div className="recruiter-modal__header-main">
                <div className="recruiter-modal__icon">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="recruiter-modal__title">{getTitle()}</h2>
                  <p className="recruiter-modal__subtitle">
                    Moves the application back to Under review.
                  </p>
                </div>
              </div>
            </div>

            <div className="recruiter-modal__body">
              <div className={`recruiter-note mb-4 ${isRejected ? 'recruiter-note--danger' : 'recruiter-note--warning'}`}>
                <p className="recruiter-note__title">
                  Original {isRejected ? 'rejection' : 'withdrawal'} reason
                </p>
                <p className="recruiter-note__body">{getReasonText()}</p>
              </div>

              <div className="recruiter-surface mb-4">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-fg-secondary">Reference:</span>
                  <span className="font-medium text-fg">{application.reference_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-secondary">Candidate:</span>
                  <span className="font-medium text-fg">{application.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-secondary">Position:</span>
                  <span className="font-medium text-fg">{application.applied_rank}</span>
                </div>
              </div>
              </div>

              <div className="recruiter-form-field">
                <label className="recruiter-form-label">
                Reason for Reopening <span className="text-fg-muted">(Optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={`e.g., '${isWithdrawn ? 'Candidate available again' : 'Better fit for Chief Engineer role'}' or 'New position available that matches their experience'`}
                  rows={3}
                  className="recruiter-form-textarea"
                />
              </div>

              <div className="recruiter-note recruiter-note--info mt-4">
                <p className="recruiter-note__title">What happens next</p>
                <p className="recruiter-note__body">
                  {getDescription()} The applicant will show back up in active review queues.
                </p>
              </div>
            </div>

            <div className="recruiter-modal__footer">
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setNotes('')
                }}
                disabled={loading}
                className="workspace-action-button workspace-action-button--secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={loading}
                className="workspace-action-button border border-warning-line bg-warning-soft text-warning hover:border-warning disabled:opacity-50"
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
