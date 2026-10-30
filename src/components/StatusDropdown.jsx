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
    { value: 'submitted', label: 'Submitted', color: 'text-accent-text' },
    { value: 'under_review', label: 'Under Review', color: 'text-warning' },
    { value: 'interview_scheduled', label: 'Interview Scheduled', color: 'text-progress' },
    { value: 'test_scheduled', label: 'Test Scheduled', color: 'text-warning' },
    { value: 'offer_made', label: 'Offer Made', color: 'text-accent-text' },
    { value: 'hired', label: 'Hired', color: 'text-success' },
    { value: 'rejected', label: 'Rejected', color: 'text-danger' },
    { value: 'withdrawn', label: 'Withdrawn', color: 'text-fg-secondary' }
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

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-surface border border-line-input rounded-lg hover:bg-raised transition-colors text-sm font-medium text-fg-secondary"
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
            <div className="absolute right-0 mt-2 w-56 bg-surface rounded-lg shadow-overlay border border-line py-1 z-20">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusClick(status.value)}
                  disabled={status.value === currentStatus}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-raised transition-colors ${
 status.value === currentStatus 
 ? 'bg-raised cursor-not-allowed opacity-50' 
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
            <div className="relative bg-surface rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-fg mb-4">
                Change Status to: {statuses.find(s => s.value === selectedStatus)?.label}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-fg-secondary mb-2">
                  Add Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why are you changing this status? (e.g., Interview feedback, test results, reason for rejection)"
                  rows={4}
                  className="w-full px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
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
                  className="flex-1 px-4 py-2 bg-raised text-fg-secondary rounded-lg hover:bg-line transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmChange}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-accent-fill text-on-accent rounded-lg hover:bg-accent-fill-hover transition-colors font-medium disabled:bg-fg-muted flex items-center justify-center gap-2"
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
