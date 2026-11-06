/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth/AuthContext'
import HandledBySelect from './recruiter/HandledBySelect'
import { ChevronRight, Loader2, MoreVertical, X, Check, XCircle } from 'lucide-react'
import TestSchedulingModal from './TestSchedulingModal'
import TestResultModal from './TestResultModal'
import InterviewSchedulingModal from './InterviewSchedulingModal'
import InterviewResultModal from './InterviewResultModal'
import WithdrawalModal from './recruiter/WithdrawalModal'
import { applicationStatusLabel } from '../constants/applicationStatus'
import RejectionModal from './recruiter/RejectionModal'

export default function SequentialStatusControl({ applicationId, currentStatus, onStatusChange, application, autoOpenInterview = false, onAutoOpenComplete, showHandledBy = true, emphasis = false }) {
  const { profile, user } = useAuth()
  // Who is currently handling this application (feeds the KPI dashboard).
  const [handledBy, setHandledBy] = useState(application?.handling_recruiter_id || null)
  useEffect(() => {
    setHandledBy(application?.handling_recruiter_id || null)
  }, [application?.handling_recruiter_id])

  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSchedulingModal, setShowSchedulingModal] = useState(false)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const buttonRef = useRef(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const modalOpen = showModal || showSchedulingModal || showWithdrawalModal
    if (!modalOpen) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [showModal, showSchedulingModal, showWithdrawalModal])

  // Auto-open interview modal after Teams OAuth
useEffect(() => {
  if (autoOpenInterview) {
    
    // ONLY open if the next action is to schedule an interview
    if (getNextStatus() === 'interview_scheduled') {
      setShowSchedulingModal(true)
      
      // Clear the flag
      if (onAutoOpenComplete) {
        onAutoOpenComplete()
      }
    } else {
      // Clear the flag anyway since we're not opening
      if (onAutoOpenComplete) {
        onAutoOpenComplete()
      }
    }
  }
}, [autoOpenInterview, application.id, onAutoOpenComplete])

  // DEBUG: Log component props

  // Calculate and update dropdown position
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const updatePosition = () => {
        const rect = buttonRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.right - 192
        })
      }
      
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [showMenu])

  const statusFlow = [
    'submitted',
    'under_review',
    'test_scheduled',
    'test_passed',
    'interview_scheduled',
    'interview_passed',
    'offered',
    'offer_accepted',
    'documents_pending',
    'hired'
  ]

  // Action-oriented labels for buttons (keyed by NEXT status)
  const actionLabels = {
    under_review: 'Start Review',
    test_scheduled: 'Schedule Test',
    test_passed: 'Mark as Passed',
    interview_scheduled: 'Schedule Interview',
    interview_passed: 'Mark Interview Complete',
    offered: 'Make Offer',
    offer_accepted: 'Mark Accepted',
    documents_pending: 'Start Documents',
    hired: 'Mark as Hired'
  }

  const getButtonLabel = () => {
    if (currentStatus === 'test_scheduled') {
      return 'Update Result'
    }
    
    if (currentStatus === 'interview_scheduled') {
      return 'Update Interview Result'
    }

    if (currentStatus === 'offered') {
      return 'Mark Accepted'
    }

    if (currentStatus === 'offer_accepted') {
      return 'Start Documents'
    }

    if (currentStatus === 'documents_pending') {
      return 'Mark as Hired'
    }
    
    return actionLabels[nextStatus] || applicationStatusLabel(nextStatus)
  }

  const getNextStatus = () => {
    const normalizedStatus = currentStatus === 'submitted' ? 'submitted' : currentStatus
    const currentIndex = statusFlow.indexOf(normalizedStatus)
    if (currentIndex === -1 || currentIndex === statusFlow.length - 1) {
      return null
    }
    return statusFlow[currentIndex + 1]
  }



  const nextStatus = getNextStatus()
  const isTerminal = currentStatus === 'hired' || currentStatus === 'rejected' || currentStatus === 'withdrawn'

  // For terminal statuses, don't render any controls
  if (isTerminal) {
    return null
  }

  // Check if withdraw button should be shown
  const canWithdraw = () => {
    return ['offered', 'offer_accepted', 'documents_pending'].includes(currentStatus)
  }

  const handleNextStage = () => {
    if (!nextStatus) return
    
    
    // Show TestResultModal when updating test result
    if (currentStatus === 'test_scheduled') {
      setSelectedStatus(nextStatus)
      setShowSchedulingModal(true)
      setShowMenu(false)
      return
    }
    
    // Show InterviewResultModal when updating interview result
    if (currentStatus === 'interview_scheduled') {
      setSelectedStatus(nextStatus)
      setShowSchedulingModal(true)
      setShowMenu(false)
      return
    }
    
    // Show TestSchedulingModal for scheduling tests
    if (nextStatus === 'test_scheduled') {
      setSelectedStatus(nextStatus)
      setShowSchedulingModal(true)
      setShowMenu(false)
      return
    }
    
    // Show InterviewSchedulingModal for scheduling interviews
    if (nextStatus === 'interview_scheduled') {
      setSelectedStatus(nextStatus)
      setShowSchedulingModal(true)
      setShowMenu(false)
      return
    }
    
    // Every other step (including offered, offer accepted and hired) is saved
    // by this control after a confirm, so it works on both the list and the
    // application page (whose onStatusChange only reloads).
    setSelectedStatus(nextStatus)
    setShowModal(true)
    setShowMenu(false)
  }

  const handleReject = () => {
    // Structured rejection: category, tags, keep-warm flag, notes + email.
    setShowRejectionModal(true)
    setShowMenu(false)
  }

  const handleWithdraw = () => {
    setShowWithdrawalModal(true)
    setShowMenu(false)
  }

  const handleConfirm = async () => {
    if (!selectedStatus) return

    try {
      setLoading(true)

      const updateData = {
        status: selectedStatus,
        updated_at: new Date().toISOString()
      }

      // Auto-stamp the acting recruiter as handler when nobody is assigned,
      // so every status move is attributable on the KPI dashboard.
      const actorId = profile?.id || user?.id || null
      if (!handledBy && actorId) {
        updateData.handling_recruiter_id = actorId
      }

      const { error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('id', applicationId)

      if (error) throw error

      if (updateData.handling_recruiter_id) {
        setHandledBy(updateData.handling_recruiter_id)
      }
      onStatusChange(selectedStatus)
      setShowModal(false)
    } catch (error) {
      console.error('Error updating status:', error)
      alert(`Failed to update status${error?.message ? `: ${error.message}` : ''}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${emphasis ? 'flex-wrap' : 'flex-nowrap'}`}>
        {/* Main Action Button: accent only where it is the page's main decision (emphasis) */}
        {!isTerminal && nextStatus && (
          <button
            onClick={handleNextStage}
            disabled={loading}
            className={`workspace-action-button ${emphasis ? 'workspace-action-button--primary' : 'workspace-action-button--secondary'} group relative text-sm disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="font-medium whitespace-nowrap">{getButtonLabel()}</span>
          </button>
        )}

        {/* Handled-by: visible wherever recruiters record status input */}
        {showHandledBy && (
          <HandledBySelect
            applicationId={applicationId}
            value={handledBy}
            onChanged={setHandledBy}
            showLabel
          />
        )}

        {/* More Options Menu (Three Dots) */}
        {!isTerminal && (
          <>
            <button
              ref={buttonRef}
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-card p-2 text-fg-muted transition-colors hover:bg-raised hover:text-fg-secondary"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && createPortal(
              <>
                <div 
                  className="fixed inset-0 z-[9997]" 
                  onClick={() => setShowMenu(false)} 
                />
                <div 
                  className="fixed z-[9998] w-56 rounded-card border border-line bg-surface py-2 shadow-overlay"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`
                  }}
                >
                  {/* Withdraw Button (for offered, offer_accepted, documents_pending) */}
                  {canWithdraw() && (
                    <button
                      onClick={handleWithdraw}
                      className="w-full px-3 py-2 text-left text-sm text-warning hover:bg-warning-soft flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Withdraw Application
                    </button>
                  )}

                  {/* Reject Button (for earlier stages) */}
                  {!canWithdraw() && (
                    <button
                      onClick={handleReject}
                      className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject Application
                    </button>
                  )}
                </div>
              </>,
              document.body
            )}
          </>
        )}
      </div>

      {/* Generic Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[9998]" onClick={() => !loading && setShowModal(false)} />
          
          <div className="relative z-[9999] w-full max-w-md rounded-card bg-surface p-6">
            <h3 className="text-lg font-semibold text-fg mb-2">
              Advance to{' '}
              {applicationStatusLabel(selectedStatus)}
            </h3>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                }}
                disabled={loading}
                className="flex-1 rounded-control border border-line-input px-4 py-2 text-fg-secondary transition-colors hover:bg-raised"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-control bg-accent-fill px-4 py-2 text-on-accent transition-colors hover:bg-accent-fill-hover disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TestSchedulingModal or other scheduling modals */}
      {showSchedulingModal && (
        currentStatus === 'test_scheduled' ? (
<TestResultModal
  application={application}
  onCancel={() => setShowSchedulingModal(false)}         // ✅ Correct
  onResultUpdated={(newStatus) => {                       // ✅ Correct
    setShowSchedulingModal(false)
    onStatusChange(newStatus)
  }}
/>
        ) : currentStatus === 'interview_scheduled' ? (
<InterviewResultModal
  application={application}
  onCancel={() => setShowSchedulingModal(false)}         // ✅ Changed
  onResultUpdated={(newStatus) => {                       // ✅ Changed
    setShowSchedulingModal(false)
    onStatusChange(newStatus)
  }}
/>
        ) : nextStatus === 'test_scheduled' ? (
          <TestSchedulingModal
            application={application}
  onCancel={() => setShowSchedulingModal(false)}
            onScheduled={() => {
              setShowSchedulingModal(false)
              onStatusChange(nextStatus)
            }}
          />
        ) : nextStatus === 'interview_scheduled' ? (
          <InterviewSchedulingModal
            application={application}
  onCancel={() => setShowSchedulingModal(false)}
            onScheduled={() => {
              setShowSchedulingModal(false)
              onStatusChange(nextStatus)
            }}
          />
        ) : null
      )}

      {showRejectionModal && (
        <RejectionModal
          isOpen={showRejectionModal}
          onClose={() => setShowRejectionModal(false)}
          applicationId={applicationId}
          candidate={{
            name: application?.candidateName || application?.full_name || '',
            email: application?.candidateEmail || application?.email || '',
            position: application?.desiredRank || application?.desired_rank || application?.applied_rank || '',
            referenceNumber: application?.reference_number || '',
          }}
          actorId={profile?.id || user?.id || null}
          currentHandlerId={handledBy}
          onRejected={({ handlerId }) => {
            if (handlerId) setHandledBy(handlerId)
            onStatusChange('rejected')
          }}
        />
      )}

      {showWithdrawalModal && (
        <WithdrawalModal
          application={application}
          onClose={() => setShowWithdrawalModal(false)}
          onConfirm={() => {
            setShowWithdrawalModal(false)
            onStatusChange('withdrawn')
          }}
        />
      )}
    </>
  )
}
