import { AlertTriangle, Calendar, FileText, XCircle } from 'lucide-react'

export default function RejectionHistory({ application }) {
  // Check if application has rejection history
  const hasRejectionHistory = application.previous_rejection || application.status === 'rejected'
  
  if (!hasRejectionHistory) {
    return null
  }

  // Get rejection details
  const rejectionData = application.previous_rejection || {
    rejected_at: application.updated_at,
    rejection_reason: application.interview_feedback?.rejection_reason || 
                     application.test_feedback?.rejection_reason ||
                     'Previously rejected',
    rejection_stage: application.interview_feedback ? 'interview' : 'test',
    rejection_feedback: application.interview_feedback?.rejection_feedback
  }

  const isCurrentlyRejected = application.status === 'rejected'
  const wasReopened = application.reopened_at && !isCurrentlyRejected

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div
      className={`mb-6 rounded-[24px] border p-5 ${
 isCurrentlyRejected
 ? 'border-danger-line bg-danger-soft/90'
 : 'border-warning-line bg-warning-soft/90'
 }`}
    >
      <div className="flex items-start gap-3">
        {isCurrentlyRejected ? (
          <XCircle className="w-6 h-6 text-danger flex-shrink-0 mt-1" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-1" />
        )}
        
        <div className="flex-1">
          <h3 className={`text-lg font-semibold mb-2 ${
 isCurrentlyRejected ? 'text-danger' : 'text-warning'
 }`}>
            {isCurrentlyRejected ? 'Application Rejected' : 'Previously Rejected Application'}
          </h3>

          {wasReopened && (
            <div className="mb-4 rounded-card border border-accent/40 bg-accent-soft p-4">
              <p className="text-sm text-accent-text font-medium">
                This application was reopened on {formatDate(application.reopened_at)}
              </p>
              {application.reopened_notes && (
                <p className="text-sm text-accent-text mt-1">
                  <strong>Reason:</strong> {application.reopened_notes}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm">
            {/* Rejection Date */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-fg-muted" />
              <span className="text-fg-secondary">
                <strong>Rejected on:</strong> {formatDate(rejectionData.rejected_at)}
              </span>
            </div>

            {/* Rejection Stage */}
            {rejectionData.rejection_stage && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-fg-muted" />
                <span className="text-fg-secondary">
                  <strong>Stage:</strong> {rejectionData.rejection_stage === 'interview' ? 'Interview' : 'Test'}
                </span>
              </div>
            )}

            {/* Rejection Reason */}
            <div className="mt-3 rounded-card border border-line/70 bg-surface/90 p-4">
              <p className="text-fg-secondary font-medium mb-1">Rejection Reason:</p>
              <p className="text-fg">{rejectionData.rejection_reason}</p>
            </div>

            {/* Additional Feedback */}
            {rejectionData.rejection_feedback && (
              <div className="mt-2 rounded-card border border-line/70 bg-surface/90 p-4">
                <p className="text-fg-secondary font-medium mb-1">Detailed Feedback:</p>
                <p className="text-fg">{rejectionData.rejection_feedback}</p>
              </div>
            )}

            {/* Interview Ratings if available */}
            {application.interview_feedback?.ratings && (
              <div className="mt-3 rounded-card border border-line/70 bg-surface/90 p-4">
                <p className="text-fg-secondary font-medium mb-2">Interview Ratings:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(application.interview_feedback.ratings).map(([key, value]) => {
                    if (!value) return null
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-fg-secondary">{label}:</span>
                        <span className="font-medium">{value}/5</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {!isCurrentlyRejected && (
            <div className="mt-4 rounded-card border border-warning-line bg-warning-soft p-4">
              <p className="text-sm text-warning">
                Previously rejected. Check the feedback above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
