import { Link, useLocation } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import EmptyState from '../ui/EmptyState'
import { chartColor, toneColor } from '../../constants/chartColors'
import {
  lastActivityLabel,
  ON_TIME_BADGE_CLASSES,
  REQUIREMENT_PIPELINE_STAGES,
  timingLabel,
} from '../../utils/kpiTracker'

const PIPELINE_SEGMENT_COLORS = {
  shortlisted: chartColor(2),
  withCustomer: chartColor(1),
  accepted: chartColor(5),
  joined: toneColor('success'),
}

// One bar per requirement: candidates attached to it, by stage, in funnel order.
function RequirementPipelineBar({ pipeline, required }) {
  const total = REQUIREMENT_PIPELINE_STAGES.reduce((sum, stage) => sum + (pipeline[stage.key] || 0), 0)
  const summary = REQUIREMENT_PIPELINE_STAGES.map((stage) => `${stage.label} ${pipeline[stage.key] || 0}`).join(', ')
  if (total === 0) {
    return <span className="text-xs text-fg-muted">No candidates attached</span>
  }
  const scale = Math.max(total, Number(required) || 0, 1)
  return (
    <div className="flex items-center gap-2" title={summary} aria-label={summary}>
      <div className="flex h-5 w-40 overflow-hidden rounded-full bg-line">
        {REQUIREMENT_PIPELINE_STAGES.map((stage) => {
          const count = pipeline[stage.key] || 0
          if (count === 0) return null
          return (
            <div
              key={stage.key}
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: `${(count / scale) * 100}%`, backgroundColor: PIPELINE_SEGMENT_COLORS[stage.key] }}
            >
              {count}
            </div>
          )
        })}
      </div>
      <span className="text-xs tabular-nums text-fg-secondary">{total}</span>
    </div>
  )
}

// Open requirements with their pipeline, most at risk first (rows come sorted
// from computeDashboardMetrics().requirementProgress).
export default function RequirementProgressTable({
  rows = [],
  limit = 12,
  showOwner = true,
  emptyTitle = 'No open requirements',
  emptyDescription = 'Every requirement in scope is closed or cancelled.',
}) {
  const location = useLocation()
  if (rows.length === 0) {
    return <EmptyState icon={ClipboardList} title={emptyTitle} description={emptyDescription} />
  }
  const visible = rows.slice(0, limit)
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-secondary">
        {REQUIREMENT_PIPELINE_STAGES.map((stage) => (
          <span key={stage.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIPELINE_SEGMENT_COLORS[stage.key] }} />
            {stage.label}
          </span>
        ))}
      </div>
      <div className="tracker-table-wrap">
        <table className="tracker-table" style={{ minWidth: showOwner ? '960px' : '840px' }}>
          <thead>
            <tr>
              <th>Req ID</th>
              <th>Customer</th>
              <th>Vessel / rank</th>
              {showOwner ? <th>Owner</th> : null}
              <th className="tracker-cell--num">Filled</th>
              <th>Candidates by stage</th>
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
                  <td><RequirementPipelineBar pipeline={row.pipeline} required={row.positions_required} /></td>
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
