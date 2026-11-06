export function normalizeResumePhone(raw) {
  const text = String(raw || '').trim().replace(/^00/, '+').replace(/[\s().-]/g, '')
  return /^\+[1-9][0-9]{1,14}$/.test(text) ? text : ''
}

// Requirement defaults are editable recruiting choices, not extracted facts.
// Retain a recruiter's edits when the destination requirement changes.
export function withRequirementDefaults(form, requirement) {
  const defaultRank = !form.rankId || form.rankFromRequirement
  const defaultVessel = !form.vesselTypeId || form.vesselFromRequirement
  return { ...form, requirementId: requirement?.value || '', requirementVersion: requirement?.version,
    ...(defaultRank ? { rankId: requirement?.rankId || '', rankFromRequirement: Boolean(requirement?.rankId) } : {}),
    ...(defaultVessel ? { vesselTypeId: requirement?.vesselTypeId || '', vesselFromRequirement: Boolean(requirement?.vesselTypeId) } : {}) }
}
export function resumeCandidateFields(form) {
  const phone = normalizeResumePhone(form.telephone)
  if (form.telephone?.trim() && !phone) throw new Error('Enter the telephone with its country code, for example +919000000001. No country code is assumed.')
  if (!form.name?.trim() || (!phone && !form.email?.trim())) throw new Error('Enter the candidate name and a phone number or email.')
  if (form.expInRankMonths !== '' && (!Number.isInteger(Number(form.expInRankMonths)) || Number(form.expInRankMonths) < 0)) throw new Error('Experience must be a whole number of months, zero or greater.')
  return { name: form.name.trim(), email: form.email?.trim() || null, telephone: phone || null,
    dob: form.dob || null, nationality_id: form.nationalityId || null, rank_id: form.rankId || null,
    vessel_type_id: form.vesselTypeId || null, exp_in_rank_months: form.expInRankMonths === '' ? null : Number(form.expInRankMonths),
    lead_source: form.leadSource || null, previous_employer: form.previousEmployer || null, first_time_at_sea: Boolean(form.isFirstTimeAtSea),
    contacted_at: form.dateContacted ? new Date(`${form.dateContacted}T00:00:00`).toISOString() : null,
    added_by: form.addedByRecruiterId || null, notes: form.notes || null }
}
