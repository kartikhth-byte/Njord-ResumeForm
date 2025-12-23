import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, Loader2 } from 'lucide-react'

export default function StatusDropdown({ applicationId, currentStatus, onStatusChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [showNotesModal, setShowNotesModal] = useState(false)

  const statuses = [
    { value: 'submitted', label: 'Submitted', color: 'text-blue-600' },
    { value: 'under_review', label: 'Under Review', color: 'text-yellow-600' },
    { value: 'interview_scheduled', label: 'Interview Scheduled', color: 'text-purple-600' },
    { value: 'test_scheduled', label: 'Test Scheduled', color: 'text-orange-600' },
    { value: 'offer_made', label: 'Offer Made', color: 'text-indigo-600' },
    { value: 'hired', label: 'Hired', color: 'text-green-600' },
    { value: 'rejected', label: 'Rejected', color: 'text-red-600' },
    { value: 'withdrawn', label: 'Withdrawn', color: 'text-gray-600' }
  ]

  const handleStatusClick = (newStatus) => {
    setSelectedStatus(newStatus)
    setIsOpen(false)
    setShowNotesModal(true)
  }

  const handleConfirmChange = async () => {
    if (!selectedStatus || selectedStatus === currentStatus) {
      setShowNotesModal(false)
      return
    }

    setLoading(true)

    try {
      // Update application status
      const { error: updateError } = await supabase
        .from('applications')
        .update({ status: selectedStatus })
        .eq('id', applicationId)

      if (updateError) throw updateError

      // If notes provided, update the latest history entry
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

      // Call callback
      if (onStatusChange) {
        onStatusChange(selectedStatus)
      }

      setShowNotesModal(false)
      setNotes('')
      setSelectedStatus(null)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const currentStatusLabel = statuses.find(s => s.value === currentStatus)?.label || currentStatus

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          Change Status
          <ChevronDown className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusClick(status.value)}
                  disabled={status.value === currentStatus}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    status.value === currentStatus 
                      ? 'bg-gray-100 cursor-not-allowed opacity-50' 
                      : ''
                  } ${status.color}`}
                >
                  {status.label}
                  {status.value === currentStatus && ' (Current)'}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !loading && setShowNotesModal(false)} />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Change Status to: {statuses.find(s => s.value === selectedStatus)?.label}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why are you changing this status? (e.g., Interview feedback, test results, reason for rejection)"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNotesModal(false)
                    setNotes('')
                    setSelectedStatus(null)
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmChange}
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
