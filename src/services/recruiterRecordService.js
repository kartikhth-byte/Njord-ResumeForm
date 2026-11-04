// Requirement and candidate (prospect) writes used by the Requirements and
// Candidates pages and their detail pages. Moved unchanged from the old
// Workspace page; each function throws the Supabase error on failure.
import { supabase } from '../lib/supabase'

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
    status: 'open',
    customerName: '',
    loggedByRecruiterId: currentRecruiterId,
    notes: '',
  }
}

export function requirementFormFromRow(requirement, currentRecruiterId = '') {
  return {
    id: requirement.id,
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
export async function saveRequirement(form, currentRecruiterId) {
  const payload = {
    date_opened: form.dateOpened,
    vessel_name: form.vesselName || null,
    vessel_type_id: form.vesselTypeId,
    rank_id: form.rankId,
    positions_required: Number(form.positionsRequired),
    target_days: Number(form.targetDays),
    status: form.status,
    customer_name: form.customerName || null,
    ...(form.status === 'cancelled'
      ? { closure_reason: form.notes?.trim() || 'Cancelled by recruiter' }
      : {}),
  }

  if (!payload.vessel_type_id || !payload.rank_id || !payload.positions_required || !payload.target_days) {
    throw new Error('Please complete the required requirement fields.')
  }

  if (form.id) {
    // Ownership fields are intentionally excluded on update: rewriting
    // owner_recruiter_id from "Logged by" would undo an owner transfer.
    const { error } = await supabase.from('requirements').update(payload).eq('id', form.id)
    if (error) throw error
    if (form.notes?.trim() && form.status !== 'cancelled') {
      const { error: remarkError } = await supabase.rpc('add_requirement_remark', {
        p_requirement_id: form.id,
        p_body: form.notes.trim(),
        p_visibility: 'internal',
      })
      if (remarkError) throw remarkError
    }
    return { id: form.id, created: false }
  }

  const { data, error } = await supabase
    .from('requirements')
    .insert({
      ...payload,
      owner_recruiter_id: form.loggedByRecruiterId || currentRecruiterId,
      created_by_recruiter_id: form.loggedByRecruiterId || currentRecruiterId,
      status: 'open',
    })
    .select('id, req_id_display')
    .maybeSingle()
  if (error) throw error

  if (form.status && form.status !== 'open' && data?.id) {
    const { error: transitionError } = await supabase
      .from('requirements')
      .update({
        status: form.status,
        ...(form.status === 'cancelled'
          ? { closure_reason: form.notes?.trim() || 'Cancelled by recruiter' }
          : {}),
      })
      .eq('id', data.id)
    if (transitionError) throw transitionError
  }

  if (form.notes?.trim() && data?.id) {
    const { error: remarkError } = await supabase.rpc('add_requirement_remark', {
      p_requirement_id: data.id,
      p_body: form.notes.trim(),
      p_visibility: 'internal',
    })
    if (remarkError) throw remarkError
  }
  return { id: data?.id, created: true }
}

export async function setRequirementStatus(requirement, status) {
  const { error } = await supabase.from('requirements').update({ status }).eq('id', requirement.id)
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
    dateContacted: new Date().toISOString().slice(0, 10),
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
  if (!form.name.trim() || !form.dob || !form.dateContacted || !form.rankId || !form.vesselTypeId || !form.nationalityId || !form.expInRankMonths || !form.telephone || !form.email) {
    throw new Error('Please complete the required candidate fields.')
  }
  if (!form.isFirstTimeAtSea && !form.previousEmployer?.trim()) {
    throw new Error("Previous employer is required unless this is the candidate's first time at sea.")
  }
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      name: form.name,
      dob: form.dob,
      nationality_id: form.nationalityId,
      rank_applied_for_id: form.rankId,
      vessel_type_id: form.vesselTypeId,
      exp_in_rank_months: Number(form.expInRankMonths),
      previous_employer: form.previousEmployer?.trim() || null,
      is_first_time_at_sea: form.isFirstTimeAtSea,
      telephone: form.telephone,
      email: form.email,
      lead_source: form.leadSource || null,
      status: 'contacted',
      first_contacted_at: form.dateContacted ? new Date(`${form.dateContacted}T00:00:00`).toISOString() : new Date().toISOString(),
      created_by_recruiter_id: form.addedByRecruiterId || currentRecruiterId,
    })
    .select('id')
    .maybeSingle()
  if (error) throw error

  if (form.notes?.trim() && data?.id) {
    const { error: noteError } = await supabase.rpc('add_prospect_note', {
      p_prospect_id: data.id,
      p_body: form.notes.trim(),
      p_visibility: 'internal',
    })
    if (noteError) throw noteError
  }
  if (form.requirementId && data?.id && canAttach) {
    await attachCandidateToRequirement(data.id, form.requirementId)
  }
  return data?.id
}

export async function attachCandidateToRequirement(prospectId, requirementId) {
  const { error } = await supabase.rpc('attach_existing_prospect_to_requirement', {
    p_prospect_id: prospectId,
    p_requirement_id: requirementId,
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
