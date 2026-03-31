/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { ChevronRight, Loader2, MoreVertical, X, SkipForward, Check, XCircle } from 'lucide-react'
import TestSchedulingModal from './TestSchedulingModal'
import TestResultModal from './TestResultModal'
import InterviewSchedulingModal from './InterviewSchedulingModal'
import InterviewResultModal from './InterviewResultModal'
import DocumentsChecklistModal from './recruiter/DocumentsChecklistModal'
import WithdrawalModal from './recruiter/WithdrawalModal'

export default function SequentialStatusControl({ applicationId, currentStatus, onStatusChange, application, autoOpenInterview = false, onAutoOpenComplete }) {
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSchedulingModal, setShowSchedulingModal] = useState(false)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [modalType, setModalType] = useState(null) // 'next', 'skip', 'reject', 'withdrawn'
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
    setModalType('reject')
    setSelectedStatus('rejected')
    setShowModal(true)
    setShowMenu(false)
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

      const { error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('id', applicationId)

      if (error) throw error

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
            className="workspace-action-button workspace-action-button--primary group relative rounded-xl text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            title="Decline Offer"
          >
            <XCircle className="w-4 h-4" />
            <span className="font-medium">Decline</span>
          </button>
        )}

        {/* More Options Menu (Three Dots) */}
        {!isTerminal && (
          <>
            <button
              ref={buttonRef}
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
                  className="fixed z-[9998] w-56 rounded-2xl border border-gray-200 bg-white py-2 shadow-lg"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`
                  }}
                >
                  {/* Skip Options */}
                  {getSkippableStatuses().length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Skip to
                      </div>
                      {getSkippableStatuses().map(status => (
                        <button
                          key={status}
                          onClick={() => handleSkipTo(status)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <SkipForward className="w-4 h-4 text-gray-400" />
                          {statusLabels[status]}
                        </button>
                      ))}
                      <div className="my-1 border-t border-gray-200" />
                    </>
                  )}

                  {/* Withdraw Button (for offered, offer_accepted, documents_pending) */}
                  {canWithdraw() && (
                    <button
                      onClick={handleWithdraw}
                      className="w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Withdraw Application
                    </button>
                  )}

                  {/* Reject Button (for earlier stages) */}
                  {!canWithdraw() && (
                    <button
                      onClick={handleReject}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
          
          <div className="relative z-[9999] w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {modalType === 'skip' ? 'Skip to ' : 'Advance to '}
              {statusLabels[selectedStatus]}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Mark the current stage as complete and move to the next stage.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                }}
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
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
