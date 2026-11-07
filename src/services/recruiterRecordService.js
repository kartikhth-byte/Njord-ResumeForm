// Requirement and candidate (prospect) writes used by the Requirements and
// Candidates pages and their detail pages. Moved unchanged from the old
// Workspace page; each function throws the Supabase error on failure.
import { supabase } from '../lib/supabase'
import { resumeCandidateFields, saveResumeCandidate } from './needleIntegrationService'

export function isSameDay(a, b) {
  if (!a || !b) return false
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// Non-Master recruiters may delete only rows created today.
export function canDeleteRecord({ role, createdAt }) {
  return role === 'Master Recruiter' || isSameDay(createdAt, new Date())
}

export function emptyRequirementForm(currentRecruiterId = '') {
  return {
    id: '',
    dateOpened: new Date().toISOString().slice(0, 10),
    vesselName: '',
    vesselTypeId: '',
    rankId: '',
    positionsRequired: '1',
    targetDays: '30',
    status: 'draft',
    companyId: '', shipId: '', version: null, correctionReason: '',
    customerName: '',
    loggedByRecruiterId: currentRecruiterId,
    notes: '',
  }
}

export function requirementFormFromRow(requirement, currentRecruiterId = '') {
  return {
    id: requirement.id,
    companyId: requirement.company_id || '', shipId: requirement.ship_id || '', version: requirement.version, correctionReason: '',
    dateOpened: requirement.date_opened || new Date().toISOString().slice(0, 10),
    vesselName: requirement.vessel_name || '',
    vesselTypeId: requirement.vessel_type_id || '',
    rankId: requirement.rank_id || '',
    positionsRequired: String(requirement.positions_required ?? '1'),
    targetDays: String(requirement.target_days ?? '30'),
    status: requirement.status || 'open',
    customerName: requirement.customer_name || '',
    loggedByRecruiterId: requirement.created_by_recruiter_id || currentRecruiterId,
    notes: '',
  }
}

// Create or update a requirement. Returns { id, created }.
export async function saveRequirement(form) {
  const payload = {
    company_id: form.companyId || null, ship_id: form.shipId || null,
    vessel_name: form.vesselName || null, customer_name: form.customerName || null,
    vessel_type_id: form.vesselTypeId || null, rank_id: form.rankId || null,
    positions_required: form.positionsRequired || null, target_days: form.targetDays || null,
    status: form.status, notes: form.notes || '',
  }
  if (form.status !== 'draft' && (!form.companyId || !form.shipId || !form.rankId || !form.vesselTypeId || Number(form.positionsRequired)<1 || Number(form.targetDays)<1)) {
    throw new Error('Opening requires a reviewed company, ship, rank, vessel type, positions and target days.')
  }
  // Edits exclude ownership. New logged-by choices are Master-only on the server.
  const { data, error } = await supabase.rpc('save_platform_requirement_for_recruiter', {
    p_id: form.id || null, p_expected_version: form.version || null,
    p_logged_by: form.id ? null : form.loggedByRecruiterId || null,
    p_fields: payload, p_correction_reason: form.correctionReason || null,
  })
  if (error) throw error
  return { id: data?.id, created: !form.id }
}

// Cancelling needs a reason (the database rejects a cancel without one).
export async function setRequirementStatus(requirement, status, closureReason = '') {
  const update = { status }
  if (status === 'cancelled') {
    if (!closureReason.trim()) throw new Error('Give a reason for cancelling.')
    update.closure_reason = closureReason.trim()
  }
  const { error } = await supabase.from('requirements').update(update).eq('id', requirement.id)
  if (error) throw error
}

export async function archiveRequirement(requirement, currentRecruiterId) {
  const { error } = await supabase
    .from('requirements')
    .update({
      archived_at: requirement.archived_at || new Date().toISOString(),
      archived_by_recruiter_id: currentRecruiterId,
      archive_reason: requirement.archive_reason || 'Archived by recruiter',
    })
    .eq('id', requirement.id)
  if (error) throw error
}

export async function deleteRequirement(requirement, currentRecruiterId) {
  const { error } = await supabase
    .from('requirements')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_recruiter_id: currentRecruiterId,
      delete_reason: 'Deleted by recruiter',
    })
    .eq('id', requirement.id)
  if (error) throw error
}

export function emptyCandidateForm(currentRecruiterId = '') {
  return {
    name: '',
    dob: '',
    dateContacted: '',
    addedByRecruiterId: currentRecruiterId,
    rankId: '',
    vesselTypeId: '',
    nationalityId: '',
    expInRankMonths: '',
    previousEmployer: '',
    isFirstTimeAtSea: false,
    telephone: '',
    email: '',
    leadSource: '',
    requirementId: '',
    notes: '',
  }
}

// Create a prospect, with an optional note and requirement link. Returns its id.
export async function createCandidate(form, currentRecruiterId, { canAttach = false } = {}) {
  const existing = form.linkTo || form.resume?.matches?.some(row => row.reason === 'resume')
  const result = await saveResumeCandidate(form.resume, existing ? {} : resumeCandidateFields({ ...form, addedByRecruiterId: form.addedByRecruiterId || currentRecruiterId }), {
    requirementId: canAttach ? form.requirementId : null,
    requirementVersion: form.requirementVersion,
    leadId:form.leadId,leadVersion:form.leadVersion,
    linkTo: form.linkTo,
    confirmNew: form.confirmNew,
  })
  return result.prospect_id
}

export async function attachCandidateToRequirement(prospectId, requirementId) {
  const { error } = await supabase.rpc('recruitment_case_open', {
    p_prospect_id: prospectId,
    p_requirement_id: requirementId,
    p_source: 'recruiter', p_idempotency_key: `attach:${prospectId}:${requirementId}`,
  })
  if (error) throw error
}

export async function archiveCandidate(candidate) {
  const { error } = await supabase
    .from('prospects')
    .update({
      archived_at: candidate.archived_at || new Date().toISOString(),
      archive_reason: candidate.archive_reason || 'Archived by recruiter',
    })
    .eq('id', candidate.id)
  if (error) throw error
}

export async function deleteCandidate(candidate, currentRecruiterId) {
  const { error } = await supabase
    .from('prospects')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_recruiter_id: currentRecruiterId,
    })
    .eq('id', candidate.id)
  if (error) throw error
}
