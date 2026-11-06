import { CASE_STATUS_META, isCaseTerminal } from './recruitmentCase.js'

export const CASE_STAGES = Object.keys(CASE_STATUS_META)

const ASSESSMENT_OUTCOMES = [
  'test_scheduled', 'test_passed', 'test_failed', 'test_no_show', 'test_waived',
  'interview_scheduled', 'interview_passed', 'interview_failed', 'interview_no_show',
]

export function buildRecruitmentCaseKpi({ cases = [], events = [], requirementIds = null, periodStart = null } = {}) {
  const allowed = requirementIds ? new Set(requirementIds) : null
  const scopedCases = cases.filter((row) => !allowed || allowed.has(row.requirement_id))
  const caseIds = new Set(scopedCases.map((row) => row.id))
  const statusCounts = {}
  scopedCases.forEach((row) => { statusCounts[row.status] = (statusCounts[row.status] || 0) + 1 })
  const outcomes = Object.fromEntries(ASSESSMENT_OUTCOMES.map((status) => [status, 0]))
  const start = periodStart ? new Date(periodStart).getTime() : null
  events.forEach((event) => {
    if (!caseIds.has(event.case_id) || event.event_type !== 'transition' || !(event.to_status in outcomes)) return
    const recordedAt = new Date(event.created_at).getTime()
    if (start !== null && (!Number.isFinite(recordedAt) || recordedAt < start)) return
    outcomes[event.to_status] += 1
  })
  const testDecisions = outcomes.test_passed + outcomes.test_failed + outcomes.test_no_show
  const interviewDecisions = outcomes.interview_passed + outcomes.interview_failed + outcomes.interview_no_show
  return {
    total: scopedCases.length,
    active: scopedCases.filter((row) => !isCaseTerminal(row.status)).length,
    closed: scopedCases.filter((row) => isCaseTerminal(row.status)).length,
    statusCounts,
    outcomes,
    testPassRate: testDecisions ? outcomes.test_passed / testDecisions : null,
    interviewPassRate: interviewDecisions ? outcomes.interview_passed / interviewDecisions : null,
  }
}
