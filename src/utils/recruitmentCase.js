// Recruitment case v1 — client mirror of the transition rules in
// supabase/migrations/2026110221_recruitment_case_v1.sql. The database is the
// authority (recruitment_case_transition enforces every rule); this mirror only
// decides which buttons to show. tests/recruitmentCase.test.mjs checks that the
// two stay in sync.

export const CASE_STATUS_META = {
  legacy: { label: 'Needs triage', tone: 'bg-warning-soft text-warning' },
  sourced: { label: 'Sourced', tone: 'bg-raised text-fg-secondary' },
  interested: { label: 'Interested', tone: 'bg-accent-soft text-accent-text' },
  contacted: { label: 'Contacted', tone: 'bg-accent-soft text-accent-text' },
  confirmed: { label: 'Confirmed', tone: 'bg-accent-soft text-accent-text' },
  test_scheduled: { label: 'Test scheduled', tone: 'bg-progress-soft text-progress' },
  test_passed: { label: 'Test passed', tone: 'bg-success-soft text-success' },
  test_waived: { label: 'Test waived', tone: 'bg-success-soft text-success' },
  test_failed: { label: 'Test failed', tone: 'bg-danger-soft text-danger' },
  test_no_show: { label: 'Test no-show', tone: 'bg-warning-soft text-warning' },
  interview_scheduled: { label: 'Interview scheduled', tone: 'bg-progress-soft text-progress' },
  interview_passed: { label: 'Interview passed', tone: 'bg-success-soft text-success' },
  interview_failed: { label: 'Interview failed', tone: 'bg-danger-soft text-danger' },
  interview_no_show: { label: 'Interview no-show', tone: 'bg-warning-soft text-warning' },
  selected: { label: 'Selected', tone: 'bg-success-soft text-success' },
  offered: { label: 'Offered', tone: 'bg-progress-soft text-progress' },
  offer_accepted: { label: 'Offer accepted', tone: 'bg-success-soft text-success' },
  offer_declined: { label: 'Offer declined', tone: 'bg-danger-soft text-danger' },
  documents_pending: { label: 'Documents pending', tone: 'bg-progress-soft text-progress' },
  documents_verified: { label: 'Documents verified', tone: 'bg-success-soft text-success' },
  sent_to_principal: { label: 'Sent to principal', tone: 'bg-progress-soft text-progress' },
  hired: { label: 'Hired', tone: 'bg-success-soft text-success' },
  withdrawn: { label: 'Withdrawn', tone: 'bg-raised text-fg-secondary' },
  rejected: { label: 'Rejected', tone: 'bg-danger-soft text-danger' },
  closed: { label: 'Closed', tone: 'bg-raised text-fg-secondary' },
}

export const CASE_FORM_INVITE_STAGES = [
  'interview_passed', 'selected', 'offered', 'offer_accepted',
  'documents_pending', 'documents_verified', 'sent_to_principal',
]

export const CASE_ALLOWED_NEXT = {
  sourced: ['contacted'],
  interested: ['contacted'],
  contacted: ['confirmed'],
  confirmed: ['test_scheduled', 'test_waived'],
  test_scheduled: ['test_passed', 'test_failed', 'test_no_show'],
  test_failed: ['test_scheduled'],
  test_no_show: ['test_scheduled'],
  test_passed: ['interview_scheduled'],
  test_waived: ['interview_scheduled'],
  interview_scheduled: ['interview_passed', 'interview_failed', 'interview_no_show'],
  interview_no_show: ['interview_scheduled'],
  interview_passed: ['selected'],
  selected: ['offered'],
  offered: ['offer_accepted', 'offer_declined'],
  offer_accepted: ['documents_pending'],
  documents_pending: ['documents_verified'],
  sent_to_principal: ['hired'],
}

export const CASE_TERMINAL_STATUSES = ['hired', 'withdrawn', 'rejected', 'closed']
export const CASE_EXIT_STATUSES = ['withdrawn', 'rejected', 'closed']
// Moves that need a written reason (the database rejects them without one).
export const CASE_REASON_REQUIRED = ['test_waived', ...CASE_EXIT_STATUSES]
export const CASE_SCHEDULE_STATUSES = ['test_scheduled', 'interview_scheduled']
export const CASE_RESULT_STATUSES = ['test_passed', 'test_failed', 'test_no_show', 'interview_passed', 'interview_failed', 'interview_no_show']
export const CASE_RESULT_REASON_REQUIRED = ['test_failed', 'test_no_show', 'interview_failed', 'interview_no_show']

// A backfilled `legacy` case is placed on the new flow once, with a reason.
// Any non-terminal stage except `sent_to_principal` (which needs the attestation).
export const CASE_LEGACY_TARGETS = Object.keys(CASE_STATUS_META).filter((status) => (
  !['legacy', 'hired', 'sent_to_principal', ...CASE_EXIT_STATUSES].includes(status)
))

export function isCaseTerminal(status) {
  return CASE_TERMINAL_STATUSES.includes(status)
}

export function caseStatusMeta(status) {
  return CASE_STATUS_META[status] || { label: status || 'Unknown', tone: 'bg-raised text-fg-secondary' }
}

// Forward actions offered for a case. `sent_to_principal` is reached only by
// the principal-send attestation, so it is never a plain button.
export function caseNextActions(status) {
  return (CASE_ALLOWED_NEXT[status] || []).filter((next) => next !== 'sent_to_principal')
}

export function caseActionLabel(toStatus) {
  const labels = {
    contacted: 'Mark contacted',
    confirmed: 'Confirm interest',
    test_scheduled: 'Schedule test',
    test_waived: 'Waive test',
    test_passed: 'Record test passed',
    test_failed: 'Record test failed',
    test_no_show: 'Record test no-show',
    interview_scheduled: 'Schedule interview',
    interview_passed: 'Record interview passed',
    interview_failed: 'Record interview failed',
    interview_no_show: 'Record interview no-show',
    selected: 'Select',
    offered: 'Offer made',
    offer_accepted: 'Offer accepted',
    offer_declined: 'Offer declined',
    documents_pending: 'Documents requested',
    documents_verified: 'Documents verified',
    hired: 'Hired',
    withdrawn: 'Withdraw',
    rejected: 'Reject',
    closed: 'Close',
  }
  return labels[toStatus] || caseStatusMeta(toStatus).label
}

const CASE_ERROR_MESSAGES = {
  auth_required: 'Your session has expired. Sign in again.',
  permission_denied: 'Your role cannot change recruitment cases.',
  complete_phone_email_dob_nationality_before_progressing: 'Complete the candidate’s phone, email, date of birth and nationality before progressing past contacted.',
  valid_send_time_required: 'Enter when the worksheet was sent; it cannot be in the future.',
  application_already_linked: 'A form is already linked to this case. Ask the operator to review any correction.',
  submitted_form_required: 'Choose a submitted form before linking it.',
  application_prospect_mismatch: 'This form belongs to another candidate.',
  form_link_requires_active_post_interview_case: 'Forms can be linked only to an active case after interview.',
  attestation_requires_submitted_form: 'Link the candidate’s submitted form before recording the worksheet handoff.',
  version_conflict: 'Someone else updated this case. Refresh and try again.',
  case_closed: 'This case is already closed.',
  assessment_reason_required: 'Add a reason for this result.',
  reason_required: 'Add a reason.',
  waiver_reason_required: 'Add a reason for waiving the test.',
  legacy_triage_requires_reason: 'Add a reason when placing an older record on the new flow.',
  case_not_found: 'This case no longer exists. Refresh the page.',
  assessment_time_required: 'Enter the assessment date and time.',
  invalid_assessment_time: 'Enter a valid assessment date and time.',
  assessment_not_allowed: 'Assessment details are not allowed for this step.',
  invalid_assessment_details: 'Assessment details are invalid.',
}

export function caseErrorMessage(error) {
  const text = String(error?.message || error || '')
  const key = Object.keys(CASE_ERROR_MESSAGES).find((code) => text.includes(code))
  if (key) return CASE_ERROR_MESSAGES[key]
  if (text.startsWith('invalid_transition')) return 'That step is not allowed from the current stage. Refresh and try again.'
  return text || 'The case could not be updated.'
}

// Table missing (migration not applied in this environment) → hide case UI.
export function isCaseTableMissing(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`
  return error?.code === '42P01' || error?.code === 'PGRST205' || (/recruitment_cases/.test(text) && /does not exist|schema cache/.test(text))
}

export function newIdempotencyKey(prefix = 'case') {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${random}`
}

// Coarse KPI grouping only; UI and per-case filters retain the exact case stage.
export function caseFunnelStage(status) {
  if(['legacy','needs_triage','sourced','interested'].includes(status))return caseStatusMeta(status).label
  if(status==='contacted')return 'Contacted'
  if(status==='confirmed')return 'Screened'
  if(status.startsWith('test_'))return 'Shortlisted'
  if(status.startsWith('interview_'))return 'Interviewed'
  if(['selected','offered','offer_accepted','offer_declined','documents_pending','documents_verified','sent_to_principal'].includes(status))return 'Approved'
  if(status==='hired')return 'Joined'
  if(status==='rejected')return 'Rejected'
  if(['withdrawn','closed'].includes(status))return 'Withdrawn'
  return 'Needs triage'
}
