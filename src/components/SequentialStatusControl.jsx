import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { ChevronRight, Loader2, MoreVertical, X, SkipForward } from 'lucide-react'

export default function SequentialStatusControl({ applicationId, currentStatus, onStatusChange }) {
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState(null) // 'next', 'skip', 'reject', 'withdrawn'
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [notes, setNotes] = useState('')
  const buttonRef = useRef(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Calculate and update dropdown position
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const updatePosition = () => {
        const rect = buttonRef.current.getBoundingClientRect()
        // Use viewport-relative position (no scrollY/scrollX needed)
        setDropdownPosition({
          top: rect.bottom + 8,  // 8px below button
          left: rect.right - 192  // Align right edge (192px = w-48)
        })
      }
      
      // Initial position
      updatePosition()
      
      // Update on scroll
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [showMenu])

  const statusFlow = [
    'new',
    'under_review',
    'test_scheduled',
    'test_completed',
    'test_passed',
    'interview_scheduled',
    'interview_completed',
    'offered',
    'hired'
  ]

  const statusLabels = {
    new: 'New',
    under_review: 'Under Review',
    test_scheduled: 'Test Scheduled',
    test_completed: 'Test Completed',
    test_passed: 'Test Passed',
    test_failed: 'Test Failed',
    interview_scheduled: 'Interview Scheduled',
    interview_completed: 'Interview Completed',
    offered: 'Offered',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  }

  const getNextStatus = () => {
    const currentIndex = statusFlow.indexOf(currentStatus)
    if (currentIndex === -1 || currentIndex === statusFlow.length - 1) {
      return null
    }
    return statusFlow[currentIndex + 1]
  }

  const getSkippableStatuses = () => {
    const currentIndex = statusFlow.indexOf(currentStatus)
    if (currentIndex === -1) return []
    // Return all statuses after the next one (skip at least one stage)
    return statusFlow.slice(currentIndex + 2)
  }

  const nextStatus = getNextStatus()
  const isTerminal = currentStatus === 'hired' || currentStatus === 'rejected' || currentStatus === 'withdrawn'

  const handleNextStage = () => {
    if (!nextStatus) return
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
    setModalType('withdrawn')
    setSelectedStatus('withdrawn')
    setShowModal(true)
    setShowMenu(false)
  }

  const handleConfirm = async () => {
    if (!selectedStatus) return

    setLoading(true)
    try {
      // Update status
      const { error: updateError } = await supabase
        .from('applications')
        .update({ status: selectedStatus })
        .eq('id', applicationId)

      if (updateError) throw updateError

      // Add notes if provided
      if (notes.trim()) {
        const { error: notesError } = await supabase
          .from('application_status_history')
          .update({ notes: notes.trim() })
          .eq('application_id', applicationId)
          .eq('new_status', selectedStatus)
          .order('created_at', { ascending: false })
          .limit(1)

        if (notesError) console.error('Error adding notes:', notesError)
      }

      // Callback
      if (onStatusChange) {
        onStatusChange(selectedStatus)
      }

      // Close modal
      setShowModal(false)
      setNotes('')
      setSelectedStatus(null)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getModalTitle = () => {
    switch (modalType) {
      case 'next':
        return `Advance to ${statusLabels[selectedStatus]}`
      case 'skip':
        return `Skip to ${statusLabels[selectedStatus]}`
      case 'reject':
        return 'Reject Application'
      case 'withdrawn':
        return 'Mark as Withdrawn'
      default:
        return 'Update Status'
    }
  }

  const getModalDescription = () => {
    switch (modalType) {
      case 'next':
        return 'Mark the current stage as complete and move to the next stage.'
      case 'skip':
        return 'Skip intermediate stages and jump directly to this stage.'
      case 'reject':
        return 'Mark this application as rejected by the company.'
      case 'withdrawn':
        return 'Mark this application as withdrawn by the applicant.'
      default:
        return ''
    }
  }

  if (isTerminal) {
    return (
      <div className="text-sm text-gray-500 italic">
        Final status reached
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 overflow-visible relative">
        {/* Primary Next Stage Button */}
        {nextStatus && (
          <button
            onClick={handleNextStage}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {statusLabels[nextStatus]}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Menu Button */}
        <div className="relative overflow-visible" style={{ zIndex: 50 }}>
          <button
            ref={buttonRef}
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && createPortal(
            <>
              <div 
                className="fixed inset-0" 
                style={{ zIndex: 9998 }}
                onClick={() => setShowMenu(false)} 
              />
              <div 
                className="fixed w-48 rounded-lg shadow-2xl border-2 border-gray-300 py-1 bg-white"
                style={{
                  zIndex: 9999,
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`
                }}
              >
                {/* Skip to Stage */}
                {getSkippableStatuses().length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                      Skip To
                    </div>
                    {getSkippableStatuses().map(status => (
                      <button
                        key={status}
                        onClick={() => handleSkipTo(status)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" />
                        {statusLabels[status]}
                      </button>
                    ))}
                    <div className="border-t my-1" />
                  </>
                )}

                {/* Reject */}
                <button
                  onClick={handleReject}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>

                {/* Withdrawn */}
                <button
                  onClick={handleWithdraw}
                  className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Mark Withdrawn
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !loading && setShowModal(false)} />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {getModalTitle()}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {getModalDescription()}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any relevant notes about this status change..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setNotes('')
                    setSelectedStatus(null)
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 flex items-center justify-center gap-2"
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
          </div>
        </div>
      )}
    </>
  )
}