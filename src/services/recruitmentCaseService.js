import { supabase } from '../lib/supabase'
import { isCaseTableMissing, newIdempotencyKey } from '../utils/recruitmentCase'

const CASE_COLUMNS = 'id, prospect_id, requirement_id, application_id, cycle, status, source, legacy_status, form_invited_at, created_by, created_at, updated_at, version'
const EVENT_COLUMNS = 'id, case_id, event_type, from_status, to_status, reason, payload, actor_id, created_at'

// Cases (all cycles) and their events for one requirement.
// Returns { available: false } where the case tables do not exist yet.
export async function loadRequirementCases(requirementId) {
  const { data: cases, error } = await supabase
    .from('recruitment_cases')
    .select(CASE_COLUMNS)
    .eq('requirement_id', requirementId)
    .order('updated_at', { ascending: false })
  if (error) {
    if (isCaseTableMissing(error)) return { available: false, cases: [], events: [] }
    throw error
  }
  const caseIds = (cases || []).map((row) => row.id)
  let events = []
  if (caseIds.length > 0) {
    const { data: eventRows, error: eventError } = await supabase
      .from('recruitment_case_events')
      .select(EVENT_COLUMNS)
      .in('case_id', caseIds)
      .order('created_at', { ascending: false })
    if (eventError) throw eventError
    events = eventRows || []
  }
  return { available: true, cases: cases || [], events }
}

export async function openRecruitmentCase({ prospectId, requirementId, source = 'recruiter' }) {
  const { data, error } = await supabase.rpc('recruitment_case_open', {
    p_prospect_id: prospectId,
    p_requirement_id: requirementId,
    p_source: source,
    p_idempotency_key: newIdempotencyKey('open'),
  })
  if (error) throw error
  return data
}

export async function transitionRecruitmentCase({ caseId, toStatus, reason = null, expectedVersion = null, assessment = {} }) {
  const { data, error } = await supabase.rpc('recruitment_case_transition', {
    p_case_id: caseId,
    p_to_status: toStatus,
    p_reason: reason,
    p_idempotency_key: newIdempotencyKey('move'),
    p_expected_version: expectedVersion,
    ...(Object.keys(assessment).length ? { p_assessment: assessment } : {}),
  })
  if (error) throw error
  return data
}
