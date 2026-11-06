// The one label per application status. Used by the badge, the status
// control, the Applications list chips and the applicant side.
export const APPLICATION_STATUS_LABELS = {
  new: 'New',
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  test_scheduled: 'Test scheduled',
  test_completed: 'Test completed',
  test_passed: 'Test passed',
  test_failed: 'Test failed',
  interview_scheduled: 'Interview scheduled',
  interview_completed: 'Interview completed',
  interview_passed: 'Interview passed',
  second_interview_scheduled: '2nd interview scheduled',
  second_interview_completed: '2nd interview completed',
  offered: 'Offered',
  offer_accepted: 'Offer accepted',
  documents_pending: 'Documents pending',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

// Statuses that end an application.
export const CLOSED_APPLICATION_STATUSES = ['hired', 'rejected', 'withdrawn']

export function applicationStatusLabel(status) {
  return APPLICATION_STATUS_LABELS[status] || String(status || '').replaceAll('_', ' ')
}
