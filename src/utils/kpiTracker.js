// Shared derivation logic for the crew recruitment KPI tracker pages
// (Requirements, Candidates, KPI Dashboard). Mirrors the "calculates
// automatically" rules from the Crew Recruitment KPI Tracker workbook:
// - a requirement is only closed when all required positions have joined
// - only joined candidates count as success
// - days open / days to close / on-time status derive from dates + target days

const MS_PER_DAY = 1000 * 60 * 60 * 24

export const FUNNEL_STAGES = [
  'Contacted',
  'Screened',
  'Shortlisted',
  'Interviewed',
  'Approved',
  'Joined',
  'Rejected',
  'Withdrawn',
]

const POSITIVE_STAGE_RANK = {
  Contacted: 1,
  Screened: 2,
  Shortlisted: 3,
  Interviewed: 4,
  Approved: 5,
  Joined: 6,
}

export const STAGE_BADGE_CLASSES = {
  Contacted: 'bg-accent-soft text-accent-text',
  Screened: 'bg-accent-soft text-accent-text',
  Shortlisted: 'bg-accent-soft text-accent-text',
  Interviewed: 'bg-progress-soft text-progress',
  Approved: 'bg-success-soft text-success',
  Joined: 'bg-success-soft text-success',
  Rejected: 'bg-danger-soft text-danger',
  Withdrawn: 'bg-line text-fg-secondary',
}

export const ON_TIME_BADGE_CLASSES = {
  'On Time': 'bg-success-soft text-success',
  'On Track': 'bg-accent-soft text-accent-text',
  Delayed: 'bg-danger-soft text-danger',
  Overdue: 'bg-warning-soft text-warning',
  '—': 'bg-raised text-fg-secondary',
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function toDateOnly(value) {
  if (!value) return null
  // Parse date-only strings (e.g. requirements.date_opened) as local dates,
  // not UTC midnight, so day math does not shift across timezones.
  if (typeof value === 'string') {
    const match = DATE_ONLY_PATTERN.exec(value.trim())
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function localDayString(value) {
  const date = toDateOnly(value)
  if (!date) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function dayDiff(from, to) {
  const start = toDateOnly(from)
  const end = toDateOnly(to)
  if (!start || !end) return null
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

export function isSameLocalDay(value, reference = new Date()) {
  const date = toDateOnly(value)
  const ref = toDateOnly(reference)
  if (!date || !ref) return false
  return date.getTime() === ref.getTime()
}

export function lookupName(rows = [], id, fallback = '—') {
  if (!id) return fallback
  const match = rows.find((row) => row.id === id)
  return match?.name || fallback
}

export function recruiterName(recruiters = [], id, fallback = 'Unassigned') {
  if (!id) return fallback
  const match = recruiters.find((row) => row.id === id)
  return match?.full_name || match?.email || fallback
}

function latestByEntity(rows = [], entityKey) {
  const map = {}
  rows.forEach((row) => {
    const key = row?.[entityKey]
    if (!key) return
    if (!map[key] || new Date(row.created_at) > new Date(map[key].created_at)) {
      map[key] = row
    }
  })
  return map
}

// ---------------------------------------------------------------------------
// Requirements tracker rows
// ---------------------------------------------------------------------------

export function buildRequirementTrackerRows({
  requirements = [],
  junctions = [],
  ranks = [],
  vesselTypes = [],
  recruiters = [],
  remarks = [],
  now = new Date(),
}) {
  const joinedByRequirement = junctions.reduce((acc, junction) => {
    if (junction.status === 'joined') {
      acc[junction.requirement_id] = (acc[junction.requirement_id] || 0) + 1
    }
    return acc
  }, {})
  const latestRemarkByRequirement = latestByEntity(remarks, 'requirement_id')

  return requirements.map((requirement) => {
    const joined = joinedByRequirement[requirement.id] || 0
    const required = Number(requirement.positions_required) || 0
    const isArchived = Boolean(requirement.archived_at || requirement.deleted_at)
    const isClosed = requirement.status === 'closed'
    const isCancelled = requirement.status === 'cancelled'
    const openPositions = isClosed || isCancelled || isArchived ? 0 : Math.max(required - joined, 0)

    const daysOpen = requirement.date_closed
      ? dayDiff(requirement.date_opened, requirement.date_closed)
      : dayDiff(requirement.date_opened, now)
    const daysToClose = requirement.date_closed
      ? dayDiff(requirement.date_opened, requirement.date_closed)
      : null
    const targetDays = Number(requirement.target_days) || null

    let onTimeStatus = '—'
    if (!isCancelled && targetDays != null) {
      if (isClosed && daysToClose != null) {
        onTimeStatus = daysToClose <= targetDays ? 'On Time' : 'Delayed'
      } else if (!isClosed && daysOpen != null) {
        onTimeStatus = daysOpen <= targetDays ? 'On Track' : 'Overdue'
      }
    }

    return {
      ...requirement,
      reqId: requirement.req_id_display,
      vesselTypeName: lookupName(vesselTypes, requirement.vessel_type_id),
      rankName: lookupName(ranks, requirement.rank_id),
      recruiterName: recruiterName(recruiters, requirement.owner_recruiter_id || requirement.created_by_recruiter_id),
      joinedCount: joined,
      openPositions,
      daysOpen,
      daysToClose,
      targetDays,
      onTimeStatus,
      isArchived,
      latestRemark: latestRemarkByRequirement[requirement.id]?.body || '',
    }
  })
}

// ---------------------------------------------------------------------------
// Candidate funnel rows
// ---------------------------------------------------------------------------

// Active (non-terminal) application statuses mapped to funnel stages.
// Drafts ('draft' / 'new' with no submitted_at) intentionally do not advance
// the stage — a claimed account is not a screened candidate.
const APPLICATION_ACTIVE_STAGE_MAP = {
  submitted: 'Screened',
  under_review: 'Screened',
  test_scheduled: 'Screened',
  test_completed: 'Screened',
  test_passed: 'Screened',
  interview_scheduled: 'Interviewed',
  interview_completed: 'Interviewed',
  interview_passed: 'Interviewed',
  second_interview_scheduled: 'Interviewed',
  second_interview_completed: 'Interviewed',
  offered: 'Approved',
  offer_accepted: 'Approved',
  documents_pending: 'Approved',
  // test_failed stays active: the product supports test retakes
  // (test_attempt_number / retake approval flow), so a failed test is not
  // a terminal outcome.
  test_failed: 'Screened',
}

const APPLICATION_TERMINAL_MAP = {
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const JUNCTION_ACTIVE_STAGE_MAP = {
  shortlisted: 'Shortlisted',
  submitted_to_customer: 'Shortlisted',
  customer_reviewing: 'Shortlisted',
  customer_accepted: 'Approved',
}

const JUNCTION_TERMINAL_MAP = {
  customer_rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

export function buildCandidateFunnelRows({
  prospects = [],
  junctions = [],
  applications = [],
  requirements = [],
  ranks = [],
  vesselTypes = [],
  recruiters = [],
  notes = [],
  now = new Date(),
}) {
  const junctionsByProspect = junctions.reduce((acc, junction) => {
    if (!acc[junction.prospect_id]) acc[junction.prospect_id] = []
    acc[junction.prospect_id].push(junction)
    return acc
  }, {})
  const applicationByProspect = applications.reduce((acc, application) => {
    if (application?.prospect_id) {
      const existing = acc[application.prospect_id]
      if (!existing || new Date(application.updated_at) > new Date(existing.updated_at)) {
        acc[application.prospect_id] = application
      }
    }
    return acc
  }, {})
  const requirementById = requirements.reduce((acc, requirement) => {
    acc[requirement.id] = requirement
    return acc
  }, {})
  const latestNoteByProspect = latestByEntity(notes, 'prospect_id')

  return prospects.map((prospect) => {
    const attached = (junctionsByProspect[prospect.id] || []).slice().sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    )
    const application = applicationByProspect[prospect.id] || null
    const joinedJunction = attached.find((junction) => junction.status === 'joined') || null
    const isArchived = Boolean(prospect.archived_at || prospect.deleted_at)

    // Stage resolution — the CURRENT state wins over historical progress:
    // 1. Joined is the terminal success state.
    // 2. Otherwise the furthest ACTIVE (non-terminal) signal from junctions
    //    or the application is the current stage.
    // 3. Otherwise, if any terminal outcome exists (customer rejection,
    //    application rejection/withdrawal, prospect rejected), the candidate
    //    is out of the funnel — even if they were approved earlier.
    // 4. Otherwise fall back to prospect vetting state.
    const activeSignals = []
    const terminalSignals = []

    attached.forEach((junction) => {
      if (JUNCTION_ACTIVE_STAGE_MAP[junction.status]) activeSignals.push(JUNCTION_ACTIVE_STAGE_MAP[junction.status])
      if (JUNCTION_TERMINAL_MAP[junction.status]) terminalSignals.push(JUNCTION_TERMINAL_MAP[junction.status])
    })
    if (application) {
      if (application.status === 'hired') {
        activeSignals.push('Joined')
      } else if (APPLICATION_ACTIVE_STAGE_MAP[application.status]) {
        activeSignals.push(APPLICATION_ACTIVE_STAGE_MAP[application.status])
      } else if (APPLICATION_TERMINAL_MAP[application.status]) {
        terminalSignals.push(APPLICATION_TERMINAL_MAP[application.status])
      } else if (application.submitted_at) {
        activeSignals.push('Screened')
      }
    }
    if (prospect.status === 'rejected') terminalSignals.push('Rejected')

    let stage
    if (joinedJunction || activeSignals.includes('Joined')) {
      stage = 'Joined'
    } else if (activeSignals.length > 0) {
      stage = activeSignals.reduce(
        (best, item) => (POSITIVE_STAGE_RANK[item] > POSITIVE_STAGE_RANK[best] ? item : best),
        'Contacted'
      )
    } else if (terminalSignals.length > 0) {
      stage = terminalSignals.includes('Rejected') ? 'Rejected' : 'Withdrawn'
    } else if (prospect.status === 'approved') {
      stage = 'Approved'
    } else {
      stage = 'Contacted'
    }

    // Only a real first contact counts as "touched" — a prospect row that was
    // merely created is not a contacted candidate.
    const contactedAt = prospect.first_contacted_at
      || (prospect.status !== 'open' ? prospect.created_at : null)
    const joinedAt = joinedJunction?.joined_at || null
    const hasJoined = stage === 'Joined'
    const rawDaysToJoin = hasJoined && joinedAt && contactedAt ? dayDiff(contactedAt, joinedAt) : null
    const daysToJoin = rawDaysToJoin != null && rawDaysToJoin >= 0 ? rawDaysToJoin : null
    const isTerminal = ['Joined', 'Rejected', 'Withdrawn'].includes(stage)
    const inActivePipeline = !isArchived && !isTerminal
    const cycleCompleted = hasJoined

    const primaryJunction = joinedJunction || attached[0] || null
    const primaryRequirement = primaryJunction ? requirementById[primaryJunction.requirement_id] : null

    return {
      ...prospect,
      stage,
      isArchived,
      hasJoined,
      inActivePipeline,
      cycleCompleted,
      contactedAt,
      joinedAt,
      daysToJoin,
      daysSinceContact: dayDiff(contactedAt, now),
      requirementCount: attached.length,
      primaryRequirement,
      requirementLabel: primaryRequirement
        ? `${primaryRequirement.req_id_display}${attached.length > 1 ? ` +${attached.length - 1}` : ''}`
        : 'Unassigned',
      rankName: lookupName(ranks, prospect.rank_applied_for_id),
      vesselTypeName: lookupName(vesselTypes, prospect.vessel_type_id),
      recruiterName: recruiterName(recruiters, prospect.created_by_recruiter_id),
      latestNote: latestNoteByProspect[prospect.id]?.body || '',
    }
  })
}

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

export function computeDashboardMetrics({
  requirementRows = [],
  candidateRows = [],
  recruiters = [],
  applications = [],
  now = new Date(),
}) {
  // Submitted, non-terminal applications keyed by their handling recruiter —
  // "who is actively working what" for the scorecard.
  const activeHandledApplications = applications.filter((application) => (
    Boolean(application.submitted_at)
    && !['hired', 'rejected', 'withdrawn'].includes(application.status)
  ))
  const liveRequirements = requirementRows.filter((row) => !row.isArchived && row.status !== 'cancelled')
  const openRequirements = liveRequirements.filter((row) => row.status === 'open')
  const closedRequirements = liveRequirements.filter((row) => row.status === 'closed')
  const positionsRequired = liveRequirements.reduce((sum, row) => sum + (Number(row.positions_required) || 0), 0)
  const joinedAgainstRequirements = liveRequirements.reduce((sum, row) => sum + (row.joinedCount || 0), 0)
  const openPositions = openRequirements.reduce((sum, row) => sum + (row.openPositions || 0), 0)
  const closureRate = liveRequirements.length === 0 ? 0 : closedRequirements.length / liveRequirements.length

  const liveCandidates = candidateRows.filter((row) => !row.isArchived)
  // "Touched" = candidates with a real first contact; merely-created rows do
  // not count toward the daily input metric or the conversion denominator.
  const touchedCandidates = liveCandidates.filter((row) => row.contactedAt)
  const contactedToday = touchedCandidates.filter((row) => isSameLocalDay(row.contactedAt, now))
  const joinedCandidates = liveCandidates.filter((row) => row.hasJoined)
  const joinedToday = joinedCandidates.filter((row) => isSameLocalDay(row.joinedAt, now))
  const conversionRate = touchedCandidates.length === 0 ? 0 : joinedCandidates.length / touchedCandidates.length
  const activePipeline = liveCandidates.filter((row) => row.inActivePipeline)

  const joinDurations = joinedCandidates
    .map((row) => row.daysToJoin)
    .filter((value) => Number.isFinite(value) && value >= 0)
  const avgDaysToJoin = joinDurations.length === 0
    ? null
    : joinDurations.reduce((sum, value) => sum + value, 0) / joinDurations.length

  const stageCounts = FUNNEL_STAGES.reduce((acc, stage) => {
    acc[stage] = 0
    return acc
  }, {})
  liveCandidates.forEach((row) => {
    if (stageCounts[row.stage] != null) stageCounts[row.stage] += 1
  })

  const requirementAgeing = openRequirements
    .slice()
    .sort((a, b) => (b.daysOpen ?? 0) - (a.daysOpen ?? 0))

  const scorecard = recruiters.map((recruiter) => {
    const owned = liveCandidates.filter((row) => row.created_by_recruiter_id === recruiter.id)
    const ownedTouched = owned.filter((row) => row.contactedAt)
    const ownedJoined = owned.filter((row) => row.hasJoined)
    return {
      id: recruiter.id,
      name: recruiter.full_name || recruiter.email || recruiter.id,
      roleName: recruiter.role_name || '',
      contactedToday: ownedTouched.filter((row) => isSameLocalDay(row.contactedAt, now)).length,
      totalTouched: ownedTouched.length,
      joined: ownedJoined.length,
      conversionRate: ownedTouched.length === 0 ? 0 : ownedJoined.length / ownedTouched.length,
      activePipeline: owned.filter((row) => row.inActivePipeline).length,
      handlingApplications: activeHandledApplications.filter((application) => application.handling_recruiter_id === recruiter.id).length,
    }
  })

  const unassignedHandledApplications = activeHandledApplications.filter((application) => !application.handling_recruiter_id).length

  return {
    openRequirementsCount: openRequirements.length,
    closedRequirementsCount: closedRequirements.length,
    openPositions,
    positionsRequired,
    joinedAgainstRequirements,
    closureRate,
    contactedTodayCount: contactedToday.length,
    joinedTodayCount: joinedToday.length,
    totalCandidates: liveCandidates.length,
    joinedCandidatesCount: joinedCandidates.length,
    conversionRate,
    activePipelineCount: activePipeline.length,
    avgDaysToJoin,
    stageCounts,
    requirementAgeing,
    scorecard,
    activeHandledApplicationsCount: activeHandledApplications.length,
    unassignedHandledApplications,
  }
}

export function formatDays(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  const display = Number.isInteger(rounded) ? rounded : rounded.toFixed(1)
  return `${display} ${Number(rounded) === 1 ? 'day' : 'days'}`
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value * 100)}%`
}
