import { badgeClassesForStatus } from '../constants/statusTones'

const STATUS_LABELS = {
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

export default function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || String(status || '').replaceAll('_', ' ')
  return (
    <span className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-medium ${badgeClassesForStatus(status)}`}>
      {label}
    </span>
  )
}
