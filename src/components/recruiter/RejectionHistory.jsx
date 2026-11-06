import { rejectionSummary } from '../../constants/rejection'

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '')

// One line on the application page: why it was rejected, and when.
export default function RejectionHistory({ application }) {
  const isRejected = application.status === 'rejected'
  const previous = application.previous_rejection
  if (!isRejected && !previous) return null

  const { reason, notes } = isRejected
    ? rejectionSummary(application)
    : { reason: previous.rejection_reason, notes: previous.rejection_notes || previous.rejection_feedback }
  const when = isRejected ? application.updated_at : previous.rejected_at

  return (
    <div className={`mb-6 rounded-card border px-4 py-3 text-sm ${
      isRejected ? 'border-danger-line bg-danger-soft text-danger' : 'border-warning-line bg-warning-soft text-warning'
    }`}>
      <p>
        <span className="font-semibold">{isRejected ? 'Rejected' : 'Previously rejected'}</span>
        {reason ? `: ${reason}` : ''}
        {when ? ` · ${formatDate(when)}` : ''}
        {!isRejected && application.reopened_at ? ` · reopened ${formatDate(application.reopened_at)}` : ''}
      </p>
      {notes ? <p className="mt-1 text-fg-secondary">{notes}</p> : null}
    </div>
  )
}
