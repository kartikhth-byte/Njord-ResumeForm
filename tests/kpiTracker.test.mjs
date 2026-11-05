// KPI tracker derivations: requirement pipeline, risk order, period scorecard.
// Run: node --test tests/kpiTracker.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRequirementTrackerRows, buildCandidateFunnelRows, computeDashboardMetrics, periodStart, lastActivityLabel, timingLabel, workingRecruiters } from '../src/utils/kpiTracker.js'
const now = new Date(2026, 10, 4, 12)   // Wed 4 Nov 2026
const d = (days) => new Date(now.getTime() - days * 864e5).toISOString()
const day = (days) => d(days).slice(0, 10)
const A = 'rec-a', B = 'rec-b'
const recruiters = [{ id: A, full_name: 'Asha' }, { id: B, full_name: 'Ben' }]
const requirements = [
  { id: 'r1', req_id_display: 'R1', status: 'open', positions_required: 3, target_days: 30, date_opened: day(40), owner_recruiter_id: A, updated_at: d(20) },
  { id: 'r2', req_id_display: 'R2', status: 'open', positions_required: 2, target_days: 30, date_opened: day(26), owner_recruiter_id: B, updated_at: d(1) },
  { id: 'r3', req_id_display: 'R3', status: 'open', positions_required: 1, target_days: 30, date_opened: day(5), created_by_recruiter_id: A, updated_at: d(5) },
  { id: 'r4', req_id_display: 'R4', status: 'closed', positions_required: 1, target_days: 30, date_opened: day(25), date_closed: day(2), owner_recruiter_id: A },
  { id: 'r5', req_id_display: 'R5', status: 'closed', positions_required: 1, target_days: 10, date_opened: day(60), date_closed: day(45), owner_recruiter_id: A },
]
const junctions = [
  { id: 'j1', prospect_id: 'p1', requirement_id: 'r1', status: 'shortlisted', updated_at: d(3) },
  { id: 'j2', prospect_id: 'p2', requirement_id: 'r1', status: 'submitted_to_customer', updated_at: d(9) },
  { id: 'j3', prospect_id: 'p3', requirement_id: 'r1', status: 'joined', joined_at: d(1), updated_at: d(1) },
  { id: 'j4', prospect_id: 'p4', requirement_id: 'r1', status: 'customer_rejected', updated_at: d(8) },
  { id: 'j5', prospect_id: 'p5', requirement_id: 'r4', status: 'joined', joined_at: d(2), updated_at: d(2) },
]
const prospects = [
  { id: 'p1', status: 'contacted', first_contacted_at: d(1), created_by_recruiter_id: A },
  { id: 'p2', status: 'contacted', first_contacted_at: d(10), created_by_recruiter_id: A },
  { id: 'p3', status: 'approved', first_contacted_at: d(2), created_by_recruiter_id: A },
  { id: 'p4', status: 'contacted', first_contacted_at: d(40), created_by_recruiter_id: B },
  { id: 'p5', status: 'approved', first_contacted_at: d(20), created_by_recruiter_id: B },
]
const requirementRows = buildRequirementTrackerRows({ requirements, junctions, recruiters, now })
const candidateRows = buildCandidateFunnelRows({ prospects, junctions, requirements, recruiters, now })
const eq = (name, got, want) => test(name, () => assert.deepEqual(got, want))
const r1 = requirementRows.find((r) => r.id === 'r1')
eq('r1 pipeline (rejected excluded)', r1.pipeline, { shortlisted: 1, withCustomer: 1, accepted: 0, joined: 1 })
eq('r1 linked candidates include rejected links', r1.linkedCandidateCount, 4)
eq('r3 has no linked candidates', requirementRows.find((r) => r.id === 'r3').linkedCandidateCount, 0)
eq('r1 last activity = latest junction', r1.lastActivityAt, d(1))
eq('r3 owner falls back to creator', requirementRows.find((r) => r.id === 'r3').ownerId, A)
for (const [period, expect] of [['week', { a: [2, 1, 1, 0.5] }], ['month', { a: [2, 1, 1, 0.5] }], ['all', { a: [3, 1, 2, 1 / 3] }]]) {
  const m = computeDashboardMetrics({ requirementRows, candidateRows, recruiters, period, now })
  const a = m.scorecard.find((s) => s.id === A)
  eq(`${period}: A contacted/joined/closed`, [a.contactedInPeriod, a.joinedInPeriod, a.closedInPeriod, a.periodConversionRate], expect.a)
  if (period === 'all') {
    eq('progress order: overdue r1, near r2, then r3', m.requirementProgress.map((r) => r.id), ['r1', 'r2', 'r3'])
    eq('A open/overdue reqs', [a.openRequirements, a.overdueRequirements], [2, 1])
    eq('A on-time closure all time (r4 on time, r5 delayed)', a.onTimeClosureRate, 0.5)
    const b = m.scorecard.find((s) => s.id === B)
    eq('B joined all time, avg days', [b.joinedInPeriod, b.avgDaysToJoin], [1, 18])
  }
  if (period === 'week') eq('week: A on-time closure (r4 only)', a.onTimeClosureRate, 1)
}
eq('week starts Monday 2 Nov', periodStart('week', now).toDateString(), new Date(2026, 10, 2).toDateString())

{
  const week = computeDashboardMetrics({ requirementRows, candidateRows, recruiters, period: 'week', now })
  eq('team week: contacted, joined, closed', [week.contactedInPeriodCount, week.joinedInPeriodCount, week.closedInPeriodCount], [2, 2, 1])
  eq('team week: cohort conversion', week.periodConversionRate, 0.5)
  const all = computeDashboardMetrics({ requirementRows, candidateRows, recruiters, period: 'all', now })
  eq('team all: contacted, joined, closed', [all.contactedInPeriodCount, all.joinedInPeriodCount, all.closedInPeriodCount], [5, 2, 2])
  eq('team all: avg days to join', all.periodAvgDaysToJoin, 9.5)
}
eq('activity label: today / stale', [lastActivityLabel(d(0), now).text, lastActivityLabel(d(1), now).text, lastActivityLabel(d(8), now).stale, lastActivityLabel(d(7), now).stale], ['Today', '1 day ago', true, false])
eq('timing label: near target only when on track', [timingLabel({ riskRank: 1, onTimeStatus: 'On Track' }), timingLabel({ riskRank: 0, onTimeStatus: 'Overdue' }), timingLabel({ riskRank: 2, onTimeStatus: 'On Track' })], ['Near target', 'Overdue', 'On Track'])
eq('coordinators left out of working recruiters; unknown roles kept', workingRecruiters([{ id: 1, role_name: 'Recruiter' }, { id: 2, role_name: 'Coordinator' }, { id: 3, role_name: '' }]).map((r) => r.id), [1, 3])
