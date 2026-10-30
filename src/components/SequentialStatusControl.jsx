/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth/AuthContext'
import HandledBySelect from './recruiter/HandledBySelect'
import { ChevronRight, Loader2, MoreVertical, X, SkipForward, Check, XCircle } from 'lucide-react'
import TestSchedulingModal from './TestSchedulingModal'
import TestResultModal from './TestResultModal'
import InterviewSchedulingModal from './InterviewSchedulingModal'
import InterviewResultModal from './InterviewResultModal'
import DocumentsChecklistModal from './recruiter/DocumentsChecklistModal'
import WithdrawalModal from './recruiter/WithdrawalModal'
import RejectionModal from './recruiter/RejectionModal'

export default function SequentialStatusControl({ applicationId, currentStatus, onStatusChange, application, autoOpenInterview = false, onAutoOpenComplete, showHandledBy = true }) {
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
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [modalType, setModalType] = useState(null) // 'next', 'skip', 'reject', 'withdrawn'
  const [showRejectionModal, setShowRejectionModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const buttonRef = useRef(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const modalOpen = showModal || showSchedulingModal || showDocumentsModal || showWithdrawalModal
    if (!modalOpen) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [showModal, showSchedulingModal, showDocumentsModal, showWithdrawalModal])

  // Auto-open interview modal after Teams OAuth
useEffect(() => {
  if (autoOpenInterview) {
    console.log('🔵 Auto-open triggered for:', application.id)
    console.log('🔍 Next status would be:', getNextStatus())
    
    // ONLY open if the next action is to schedule an interview
    if (getNextStatus() === 'interview_scheduled') {
      console.log('✅ Opening interview scheduling modal')
      setShowSchedulingModal(true)
      
      // Clear the flag
      if (onAutoOpenComplete) {
        onAutoOpenComplete()
      }
    } else {
      console.log('⏭️ Skipping auto-open - next status is not interview_scheduled')
      // Clear the flag anyway since we're not opening
      if (onAutoOpenComplete) {
        onAutoOpenComplete()
      }
    }
  }
}, [autoOpenInterview, application.id, onAutoOpenComplete])

  // DEBUG: Log component props
  console.log('🟣 SequentialStatusControl initialized', {
    applicationId,
    currentStatus,
    applicationObjectStatus: application?.status
  })

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

  const statusLabels = {
    submitted: 'Submitted',
    new: 'New',
    under_review: 'Under Review',
    test_scheduled: 'Test Scheduled',
    test_passed: 'Test Passed',
    interview_scheduled: 'Interview Scheduled',
    interview_passed: 'Interview Passed',
    offered: 'Offered',
    offer_accepted: 'Offer Accepted',
    documents_pending: 'Documents Pending',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  }

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
    
    return actionLabels[nextStatus] || statusLabels[nextStatus]
  }

  const getNextStatus = () => {
    const normalizedStatus = currentStatus === 'submitted' ? 'submitted' : currentStatus
    const currentIndex = statusFlow.indexOf(normalizedStatus)
    console.log('🟣 getNextStatus called', {
      currentStatus,
      normalizedStatus,
      currentIndex,
      statusFlow,
      nextStatus: statusFlow[currentIndex + 1]
    })
    if (currentIndex === -1 || currentIndex === statusFlow.length - 1) {
      return null
    }
    return statusFlow[currentIndex + 1]
  }

  const getSkippableStatuses = () => {
    const normalizedStatus = currentStatus === 'submitted' ? 'submitted' : currentStatus
    const currentIndex = statusFlow.indexOf(normalizedStatus)
    if (currentIndex === -1) return []
    return statusFlow.slice(currentIndex + 2)
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
    
    console.log('🔵 SequentialStatusControl - handleNextStage called')
    console.log('  Current Status:', currentStatus)
    console.log('  Next Status:', nextStatus)
    console.log('  Application ID:', applicationId)
    
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
    
    // Handle "offered" status - call parent handler which will open OfferModal
    if (nextStatus === 'offered') {
      setShowMenu(false)
      onStatusChange(nextStatus)
      return
    }

    // Handle "offer_accepted" - direct status update, no modal needed
    if (nextStatus === 'offer_accepted') {
      setShowMenu(false)
      onStatusChange(nextStatus)
      return
    }

    // Handle "documents_pending" - show documents checklist modal
    if (nextStatus === 'documents_pending') {
      setShowDocumentsModal(true)
      setShowMenu(false)
      return
    }

    // Handle "hired" - direct status update, no modal needed
    if (nextStatus === 'hired') {
      setShowMenu(false)
      onStatusChange(nextStatus)
      return
    }
    
    // Show generic modal for other statuses
    setModalType('next')
    setSelectedStatus(nextStatus)
    setShowModal(true)
    setShowMenu(false)
  }

  const handleSkipTo = (status) => {
    setModalType('skip')
    setSelectedStatus(status)
    setShowModal(true)
    setShowMenu(false)
  }

  const handleReject = () => {
    // Structured rejection: category, tags, keep-warm flag, notes + email.
    setShowRejectionModal(true)
    setShowMenu(false)
  }

  const handleStructuredRejection = async (rejection) => {
    const actorId = profile?.id || user?.id || null
    const updateData = {
      status: 'rejected',
      rejection_category: rejection.rejectionCategory || null,
      rejection_tags: [...(rejection.predefinedTags || []), ...(rejection.customTags || [])],
      rejection_notes: rejection.rejectionNotes || null,
      contact_for_future_roles: Boolean(rejection.contactForFutureRoles),
      updated_at: new Date().toISOString(),
    }
    if (!handledBy && actorId) {
      updateData.handling_recruiter_id = actorId
    }
    const { error } = await supabase
      .from('applications')
      .update(updateData)
      .eq('id', applicationId)
    if (error) throw error
    if (updateData.handling_recruiter_id) setHandledBy(updateData.handling_recruiter_id)
    onStatusChange('rejected')
  }

  const handleWithdraw = () => {
    setShowWithdrawalModal(true)
    setShowMenu(false)
  }

  const handleDeclineOffer = async () => {
    // Direct decline from offered status
    if (window.confirm('Mark this offer as declined? The application will be moved to Withdrawn status.')) {
      try {
        setLoading(true)
        
        const { error } = await supabase
          .from('applications')
          .update({ 
            status: 'withdrawn',
            withdrawal_reason: 'Offer declined by candidate',
            updated_at: new Date().toISOString() 
          })
          .eq('id', applicationId)

        if (error) throw error
        
        onStatusChange('withdrawn')
      } catch (error) {
        console.error('Error declining offer:', error)
        alert('Failed to update status')
      } finally {
        setLoading(false)
      }
    }
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
      <div className="flex items-center gap-1">
        {/* Main Action Button */}
        {!isTerminal && nextStatus && (
          <button
            onClick={handleNextStage}
            disabled={loading}
            className="workspace-action-button workspace-action-button--primary group relative rounded-card text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="font-medium whitespace-nowrap">{getButtonLabel()}</span>
          </button>
        )}

        {/* Decline Offer Button (only for "offered" status) */}
        {currentStatus === 'offered' && (
          <button
            onClick={handleDeclineOffer}
            disabled={loading}
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-control bg-danger px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-danger disabled:opacity-50"
            title="Decline Offer"
          >
            <XCircle className="w-4 h-4" />
            <span className="font-medium">Decline</span>
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
                  {/* Skip Options */}
                  {getSkippableStatuses().length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-fg-muted">
                        Skip to
                      </div>
                      {getSkippableStatuses().map(status => (
                        <button
                          key={status}
                          onClick={() => handleSkipTo(status)}
                          className="w-full px-3 py-2 text-left text-sm text-fg-secondary hover:bg-raised flex items-center gap-2"
                        >
                          <SkipForward className="w-4 h-4 text-fg-muted" />
                          {statusLabels[status]}
                        </button>
                      ))}
                      <div className="my-1 border-t border-line" />
                    </>
                  )}

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
              {modalType === 'skip' ? 'Skip to ' : 'Advance to '}
              {statusLabels[selectedStatus]}
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
  onCancel={() => setShowSchedulingModal(false)}        // ✅ CORRECT
            onScheduled={() => {
              setShowSchedulingModal(false)
              onStatusChange(nextStatus)
            }}
          />
        ) : null
      )}

      {/* Documents Checklist Modal */}
      {showDocumentsModal && (
        <DocumentsChecklistModal
          application={application}
          onClose={() => setShowDocumentsModal(false)}
          onComplete={() => {
            setShowDocumentsModal(false)
            onStatusChange('documents_pending')
          }}
        />
      )}

      {/* Withdrawal Modal */}
      {showRejectionModal && (
        <RejectionModal
          isOpen={showRejectionModal}
          onClose={() => setShowRejectionModal(false)}
          applicant={{
            id: applicationId,
            name: application?.candidateName || application?.full_name || '',
            email: application?.candidateEmail || application?.email || '',
            position: application?.desiredRank || application?.desired_rank || '',
          }}
          onConfirm={handleStructuredRejection}
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
