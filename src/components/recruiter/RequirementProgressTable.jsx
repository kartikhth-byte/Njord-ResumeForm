import { Link, useLocation } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import EmptyState from '../ui/EmptyState'
import {
  lastActivityLabel,
  ON_TIME_BADGE_CLASSES,
  timingLabel,
} from '../../utils/kpiTracker'

// Open requirements, most at risk first (rows come sorted
// from computeDashboardMetrics().requirementProgress).
export default function RequirementProgressTable({
  rows = [],
  limit = 12,
  showOwner = true,
  emptyTitle = 'No open requirements',
  emptyDescription = '',
}) {
  const location = useLocation()
  if (rows.length === 0) {
    return <EmptyState icon={ClipboardList} title={emptyTitle} description={emptyDescription || undefined} />
  }
  const visible = rows.slice(0, limit)
  return (
    <>
      <div className="tracker-table-wrap">
        <table className="tracker-table" style={{ minWidth: showOwner ? '960px' : '840px' }}>
          <thead>
            <tr>
              <th>Req ID</th>
              <th>Customer</th>
              <th>Vessel / rank</th>
              {showOwner ? <th>Owner</th> : null}
              <th className="tracker-cell--num">Filled</th>
              <th className="tracker-cell--num">Linked candidates</th>
              <th className="tracker-cell--num">Days open</th>
              <th>On-time</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const activity = lastActivityLabel(row.lastActivityAt)
              const timing = timingLabel(row)
              return (
                <tr key={row.id}>
                  <td className="tracker-cell--primary tracker-cell--nowrap">
                    <Link to={`/recruiter/workspace/requirements/${row.id}`} state={{ from: `${location.pathname}${location.search}` }} className="text-accent-text hover:underline">
                      {row.reqId}
                    </Link>
                  </td>
                  <td>{row.customer_name || '—'}</td>
                  <td>
                    <div>{row.vessel_name || row.vesselTypeName}</div>
                    <div className="mt-0.5 text-xs text-fg-muted">{row.rankName}</div>
                  </td>
                  {showOwner ? <td className="tracker-cell--nowrap">{row.recruiterName}</td> : null}
                  <td className="tracker-cell--num tracker-cell--nowrap">
                    <span className="font-semibold">{row.joinedCount}</span>
                    <span className="text-fg-muted"> / {Number(row.positions_required) || 0}</span>
                  </td>
                  <td className="tracker-cell--num tracker-cell--nowrap">{row.linkedCandidateCount}</td>
                  <td className="tracker-cell--num tracker-cell--nowrap">
                    <span className="font-semibold">{row.daysOpen ?? '—'}</span>
                    {row.targetDays ? <span className="text-fg-muted"> / {row.targetDays}</span> : null}
                  </td>
                  <td className="tracker-cell--nowrap">
                    <span className={`tracker-pill ${ON_TIME_BADGE_CLASSES[timing] || ON_TIME_BADGE_CLASSES['—']}`}>
                      {timing}
                    </span>
                  </td>
                  <td className={`tracker-cell--nowrap ${activity.stale ? 'font-medium text-warning' : 'text-fg-secondary'}`}>
                    {activity.text}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > visible.length ? (
        <p className="mt-3 text-xs text-fg-muted">
          Showing {visible.length} of {rows.length} open requirements.
        </p>
      ) : null}
    </>
  )
}
