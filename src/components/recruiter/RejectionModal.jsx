import { useState } from 'react'
import { X, UserX } from 'lucide-react'
import { REJECTION_CATEGORIES } from '../../constants/rejection'
import { rejectApplication } from '../../services/rejectionService'

// The one reject dialog: reason, keep-warm flag, internal notes.
// Saves through rejectionService, which also emails the candidate.
export default function RejectionModal({
  isOpen,
  onClose,
  applicationId,
  candidate = {},
  actorId = null,
  currentHandlerId = null,
  onRejected,
}) {
  const [category, setCategory] = useState('')
  const [contactForFutureRoles, setContactForFutureRoles] = useState(false)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!category) return
    setIsSubmitting(true)
    try {
      const { emailSent, handlerId } = await rejectApplication({
        applicationId,
        candidate,
        category,
        notes,
        contactForFutureRoles,
        actorId,
        currentHandlerId,
      })
      if (candidate.email && !emailSent) {
        alert('The application was rejected, but the email to the candidate could not be sent.')
      }
      onRejected?.({ handlerId })
      onClose()
    } catch (error) {
      console.error('Error rejecting application:', error)
      alert(`Could not reject the application: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="recruiter-modal-backdrop overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="recruiter-modal recruiter-modal--narrow relative my-auto flex flex-col">
        <div className="recruiter-modal__header">
          <div className="recruiter-modal__header-main">
            <div className="recruiter-modal__icon">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <h2 className="recruiter-modal__title">Reject application</h2>
              {candidate.name ? <p className="recruiter-modal__subtitle">{candidate.name}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="recruiter-modal__close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="recruiter-modal__body space-y-5">
          <div className="recruiter-form-field">
            <label className="recruiter-form-label" htmlFor="rejection-category">Reason *</label>
            <select
              id="rejection-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="recruiter-form-select"
            >
              <option value="">Select a reason</option>
              {REJECTION_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {candidate.email ? (
              <p className="recruiter-form-hint">The candidate gets an email with a short, neutral version of this reason.</p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={contactForFutureRoles}
              onChange={(e) => setContactForFutureRoles(e.target.checked)}
              className="h-4 w-4 rounded border-line-input"
            />
            Contact for future roles
          </label>

          <div className="recruiter-form-field">
            <label className="recruiter-form-label" htmlFor="rejection-notes">Notes</label>
            <textarea
              id="rejection-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="recruiter-form-input resize-none"
            />
            <p className="recruiter-form-hint">Internal only. Not sent to the candidate.</p>
          </div>
        </div>

        <div className="recruiter-modal__footer">
          <button type="button" onClick={onClose} className="workspace-action-button workspace-action-button--secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!category || isSubmitting}
            className="workspace-action-button border border-danger-line bg-danger-soft text-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
