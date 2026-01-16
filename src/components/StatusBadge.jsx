export default function StatusBadge({ status }) {
  const getStatusConfig = (status) => {
    const configs = {
      // Initial Statuses
      new: {
        label: 'New',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '✨'
      },
      draft: {
        label: 'Draft',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: '📝'
      },
      submitted: {
        label: 'Submitted',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '📤'
      },
      under_review: {
        label: 'Under Review',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '🔍'
      },
      
      // Test Statuses
      test_scheduled: {
        label: 'Test Scheduled',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '📋'
      },
      test_completed: {
        label: 'Test Completed',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '✓'
      },
      test_passed: {
        label: 'Test Passed',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '✓'
      },
      test_failed: {
        label: 'Test Failed',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '✗'
      },
      
      // Interview Statuses
      interview_scheduled: {
        label: 'Interview Scheduled',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: '📅'
      },
      interview_completed: {
        label: 'Interview Completed',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: '✓'
      },
      second_interview_scheduled: {
        label: '2nd Interview Scheduled',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: '📅'
      },
      second_interview_completed: {
        label: '2nd Interview Completed',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: '✓'
      },
      
      // Final Statuses
      offered: {
        label: 'Offered',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: '🎁'
      },
      hired: {
        label: 'Hired',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '🎉'
      },
      rejected: {
        label: 'Rejected',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: '❌'
      },
      withdrawn: {
        label: 'Withdrawn',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: '⊗'
      },

      // LEGACY SUPPORT (backwards compatibility with old status names)
      // These map old names to new configs
      interview_cleared: {
        label: 'Interview Completed',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: '✓'
      },
      test_cleared: {
        label: 'Test Passed',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '✓'
      }
    }

    return configs[status] || configs.new
  }

  const config = getStatusConfig(status)

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}