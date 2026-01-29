export default function StatusBadge({ status }) {
  const statusConfig = {
    new: {
      label: 'New',
      color: 'bg-blue-100 text-blue-800'
    },
    draft: {
      label: 'Draft',
      color: 'bg-gray-100 text-gray-800'
    },
    submitted: {
      label: 'Submitted',
      color: 'bg-blue-100 text-blue-800'
    },
    under_review: {
      label: 'Under Review',
      color: 'bg-yellow-100 text-yellow-800'
    },
    test_scheduled: {
      label: 'Test Scheduled',
      color: 'bg-purple-100 text-purple-800'
    },
    test_completed: {
      label: 'Test Completed',
      color: 'bg-purple-100 text-purple-800'
    },
    test_passed: {
      label: 'Test Passed',
      color: 'bg-green-100 text-green-800'
    },
    test_failed: {
      label: 'Test Failed',
      color: 'bg-red-100 text-red-800'
    },
    interview_scheduled: {
      label: 'Interview Scheduled',
      color: 'bg-indigo-100 text-indigo-800'
    },
    interview_completed: {
      label: 'Interview Completed',
      color: 'bg-indigo-100 text-indigo-800'
    },
    interview_passed: {
      label: 'Interview Passed',
      color: 'bg-green-100 text-green-800'
    },
    second_interview_scheduled: {
      label: '2nd Interview Scheduled',
      color: 'bg-indigo-100 text-indigo-800'
    },
    second_interview_completed: {
      label: '2nd Interview Completed',
      color: 'bg-indigo-100 text-indigo-800'
    },
    offered: {
      label: 'Offered',
      color: 'bg-orange-100 text-orange-800'
    },
    offer_accepted: {
      label: 'Offer Accepted',
      color: 'bg-green-100 text-green-800'
    },
    documents_pending: {
      label: 'Documents Pending',
      color: 'bg-yellow-100 text-yellow-800'
    },
    hired: {
      label: 'Hired',
      color: 'bg-green-100 text-green-800'
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-100 text-red-800'
    },
    withdrawn: {
      label: 'Withdrawn',
      color: 'bg-gray-100 text-gray-800'
    }
  }

  const config = statusConfig[status] || {
    label: status,
    color: 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}