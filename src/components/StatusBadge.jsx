import { badgeClassesForStatus } from '../constants/statusTones'
import { applicationStatusLabel } from '../constants/applicationStatus'

export default function StatusBadge({ status }) {
  const label = applicationStatusLabel(status)
  return (
    <span className={`inline-flex items-center rounded-control border px-2 py-0.5 text-xs font-medium ${badgeClassesForStatus(status)}`}>
      {label}
    </span>
  )
}
