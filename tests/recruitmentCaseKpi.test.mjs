import assert from 'node:assert/strict'
import { buildRecruitmentCaseKpi } from '../src/utils/recruitmentCaseKpi.js'

const cases = [
  { id: 'a', requirement_id: 'one', status: 'interview_scheduled' },
  { id: 'b', requirement_id: 'one', status: 'hired' },
  { id: 'c', requirement_id: 'two', status: 'test_failed' },
]
const events = [
  { case_id: 'a', event_type: 'transition', to_status: 'test_scheduled', created_at: '2026-11-03T10:00:00Z' },
  { case_id: 'a', event_type: 'transition', to_status: 'test_no_show', created_at: '2026-11-03T11:00:00Z' },
  { case_id: 'a', event_type: 'transition', to_status: 'test_scheduled', created_at: '2026-11-03T12:00:00Z' },
  { case_id: 'a', event_type: 'transition', to_status: 'test_passed', created_at: '2026-11-03T13:00:00Z' },
  { case_id: 'a', event_type: 'transition', to_status: 'interview_scheduled', created_at: '2026-11-04T10:00:00Z' },
  { case_id: 'b', event_type: 'transition', to_status: 'interview_passed', created_at: '2026-11-02T10:00:00Z' },
  { case_id: 'c', event_type: 'transition', to_status: 'test_failed', created_at: '2026-11-04T10:00:00Z' },
  { case_id: 'a', event_type: 'opened', to_status: 'test_passed', created_at: '2026-11-04T10:00:00Z' },
]
const all = buildRecruitmentCaseKpi({ cases, events })
assert.deepEqual([all.total, all.active, all.closed], [3, 2, 1])
assert.equal(all.statusCounts.interview_scheduled, 1)
assert.equal(all.outcomes.test_scheduled, 2)
assert.equal(all.outcomes.test_no_show, 1)
assert.equal(all.testPassRate, 1 / 3)
assert.equal(all.interviewPassRate, 1)
const scoped = buildRecruitmentCaseKpi({ cases, events, requirementIds: ['one'], periodStart: '2026-11-04T00:00:00Z' })
assert.deepEqual([scoped.total, scoped.active, scoped.closed], [2, 1, 1])
assert.equal(scoped.outcomes.test_failed, 0)
assert.equal(scoped.outcomes.test_scheduled, 0)
assert.equal(scoped.outcomes.interview_scheduled, 1)
assert.equal(scoped.testPassRate, null)
console.log('Recruitment case KPI checks passed')
