import { supabase } from '../lib/supabase'

export { normalizeResumePhone, resumeCandidateFields, withRequirementDefaults } from '../utils/candidateResumeFields'
export async function needleIntegration(body) {
  const { data, error } = await supabase.functions.invoke('needle-integration', { body })
  if (error || data?.error) {
    const detail = error?.context instanceof Response ? await error.context.clone().json().catch(() => null) : null
    throw new Error(data?.error || detail?.error || error?.message || 'Needle integration unavailable')
  }
  return data
}
export async function prepareResumes(resumeIds, stageId) {
  return (await needleIntegration({ action: 'prepare', resume_ids: resumeIds, stage_id: stageId || null })).resumes
}
export async function uploadResume(file) {
  if (!file || file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF, 10 MB or smaller.')
  const body = new FormData(); body.set('file', file)
  return (await needleIntegration(body)).resumes[0]
}
export async function candidateMatches(resumeId, fields) {
  const { data, error } = await supabase.rpc('find_resume_candidate_matches', { p_resume_id: resumeId,
    p_email: fields.email || null, p_telephone: fields.telephone || null, p_name: fields.name || null, p_dob: fields.dob || null })
  if (error) throw error
  return data || []
}
export async function saveResumeCandidate(resume, fields, { requirementId, requirementVersion, linkTo, confirmNew = false } = {}) {
  if (!resume?.evidence_id) throw new Error('Choose a verified résumé first.')
  const { data, error } = await supabase.rpc('save_resume_candidate', { p_evidence_id: resume.evidence_id,
    p_fields: fields, p_requirement_id: requirementId || null, p_expected_requirement_version: requirementVersion ?? null,
    p_link_to: linkTo || null, p_confirm_new: confirmNew })
  if (error) throw error
  return data
}
export async function openCandidateResume(prospectId, resumeId) {
  // Open synchronously to avoid a blocked popup after the authenticated fetch.
  const tab = window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  try {
    const { data, error } = await supabase.functions.invoke('needle-integration', { body: { action: 'view', prospect_id: prospectId, resume_id: resumeId } })
    if (error || !(data instanceof Blob) || data.type !== 'application/pdf') throw new Error('Original résumé unavailable')
    const url = URL.createObjectURL(data)
    if (tab) tab.location.replace(url)
    else { const link = document.createElement('a'); link.href = url; link.download = 'resume.pdf'; link.click() }
    // The browser has loaded its own blob copy by this time; avoid retaining PII.
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) { tab?.close(); throw error }
}
