export default function StatusBadge({ status }) {
  const getStatusConfig = (status) => {
    const configs = {
      new: {
        label: 'New',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '✨'
      },
      interview_scheduled: {
        label: 'Interview Scheduled',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '📅'
      },
      interview_cleared: {
        label: 'Interview Cleared',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        icon: '✓'
      },
      test_scheduled: {
        label: 'Test Scheduled',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: '📋'
      },
      test_cleared: {
        label: 'Test Cleared',
        color: 'bg-teal-100 text-teal-800 border-teal-200',
        icon: '✓'
      },
      hired: {
        label: 'Hired',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '🎉'
      },
      rejected: {
        label: 'Rejected',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '❌'
      },
      withdrawn: {
        label: 'Withdrawn',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: '⊗'
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