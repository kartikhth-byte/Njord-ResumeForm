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
      className={`mb-6 rounded-[24px] border p-5 shadow-sm ${
        isCurrentlyRejected
          ? 'border-red-200 bg-red-50/90'
          : 'border-amber-200 bg-amber-50/90'
      }`}
    >
      <div className="flex items-start gap-3">
        {isCurrentlyRejected ? (
          <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
        )}
        
        <div className="flex-1">
          <h3 className={`text-lg font-semibold mb-2 ${
            isCurrentlyRejected ? 'text-red-900' : 'text-yellow-900'
          }`}>
            {isCurrentlyRejected ? 'Application Rejected' : 'Previously Rejected Application'}
          </h3>

          {wasReopened && (
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900 font-medium">
                This application was reopened on {formatDate(application.reopened_at)}
              </p>
              {application.reopened_notes && (
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Reason:</strong> {application.reopened_notes}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm">
            {/* Rejection Date */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">
                <strong>Rejected on:</strong> {formatDate(rejectionData.rejected_at)}
              </span>
            </div>

            {/* Rejection Stage */}
            {rejectionData.rejection_stage && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">
                  <strong>Stage:</strong> {rejectionData.rejection_stage === 'interview' ? 'Interview' : 'Test'}
                </span>
              </div>
            )}

            {/* Rejection Reason */}
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/90 p-4">
              <p className="text-gray-700 font-medium mb-1">Rejection Reason:</p>
              <p className="text-gray-800">{rejectionData.rejection_reason}</p>
            </div>

            {/* Additional Feedback */}
            {rejectionData.rejection_feedback && (
              <div className="mt-2 rounded-2xl border border-white/70 bg-white/90 p-4">
                <p className="text-gray-700 font-medium mb-1">Detailed Feedback:</p>
                <p className="text-gray-800">{rejectionData.rejection_feedback}</p>
              </div>
            )}

            {/* Interview Ratings if available */}
            {application.interview_feedback?.ratings && (
              <div className="mt-3 rounded-2xl border border-white/70 bg-white/90 p-4">
                <p className="text-gray-700 font-medium mb-2">Interview Ratings:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(application.interview_feedback.ratings).map(([key, value]) => {
                    if (!value) return null
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    return (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600">{label}:</span>
                        <span className="font-medium">{value}/5</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {!isCurrentlyRejected && (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-100 p-4">
              <p className="text-sm text-yellow-900">
                <strong>Recruiter Note:</strong> This candidate was previously rejected.
                Review the feedback above before proceeding. Consider if circumstances have changed 
                or if this role is a better fit than the previous one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
