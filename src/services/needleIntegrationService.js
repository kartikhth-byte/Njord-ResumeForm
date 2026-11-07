import { supabase } from '../lib/supabase'
import { requireResumeIntake } from '../lib/resumeIntake'

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
  return (await platformIntake({ action: 'prepare', resume_ids: resumeIds, stage_id: stageId || null })).resumes
}
export async function platformIntake(body) {
  if (!['view', 'status', 'review_original'].includes(body?.action)) requireResumeIntake()
  const {data,error}=await supabase.functions.invoke('resume-intake',{body})
  if(error||data?.error){const detail=error?.context instanceof Response?await error.context.clone().json().catch(()=>null):null;throw new Error(detail?.error||data?.error||'Platform Resume Intake unavailable')}
  return data
}
export async function uploadResume(file) {
  if (!file || file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF, 10 MB or smaller.')
  const body = new FormData(); body.set('file', file)
  return (await platformIntake(body)).resumes[0]
}
export async function candidateMatches(resumeId, fields) {
  const { data, error } = await supabase.rpc('find_resume_candidate_matches', { p_resume_id: resumeId,
    p_email: fields.email || null, p_telephone: fields.telephone || null, p_name: fields.name || null, p_dob: fields.dob || null })
  if (error) throw error
  return data || []
}
export async function saveResumeCandidate(resume, fields, { requirementId, requirementVersion, linkTo, confirmNew = false, hold = false, leadId, leadVersion } = {}) {
  requireResumeIntake()
  if (!resume?.evidence_id || !resume?.resume_version_id) throw new Error('Choose a platform-registered résumé first.')
  const existing=resume.matches?.find(row=>row.reason==='resume')?.id
  const link=linkTo||existing||null
  const { data, error } = await supabase.rpc(leadId?'review_resume_lead':'review_platform_resume', { ...(leadId?{p_lead:leadId,p_lead_version:leadVersion}:{}),p_version:resume.resume_version_id,p_evidence:resume.evidence_id,
    p_decision:hold?'hold':link?'link':'new',p_fields:fields,p_requirement:requirementId||null,p_requirement_version:requirementVersion??null,
    p_link:link,p_confirm_new:confirmNew })
  if (error) throw error
  return data
}
export async function openCandidateResume(prospectId, resumeId) {
  // Open synchronously to avoid a blocked popup after the authenticated fetch.
  const tab = window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  try {
    // Legacy source links use Needle until the platform registry backfill. New
    // versions use their canonical platform original, independently of indexing.
    const {data:version,error:lookupError}=await supabase.rpc('linked_platform_resume_version',{p_prospect:prospectId,p_hash:resumeId})
    if(lookupError)throw new Error('Platform original lookup unavailable')
    const { data, error } = await supabase.functions.invoke(version?'resume-intake':'needle-integration', { body: version?{action:'view',prospect_id:prospectId,resume_version_id:version}:{ action: 'view', prospect_id: prospectId, resume_id: resumeId } })
    if (error || !(data instanceof Blob) || data.type !== 'application/pdf') throw new Error('Original résumé unavailable')
    const url = URL.createObjectURL(data)
    if (tab) tab.location.replace(url)
    else { const link = document.createElement('a'); link.href = url; link.download = 'resume.pdf'; link.click() }
    // The browser has loaded its own blob copy by this time; avoid retaining PII.
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) { tab?.close(); throw error }
}

export async function openIntakeOriginal(version) {
  const tab=window.open('about:blank','_blank');if(tab)tab.opener=null
  try{
    const data=await platformIntake({action:'review_original',resume_version_id:version})
    if(!(data instanceof Blob)||data.type!=='application/pdf')throw Error('Original résumé unavailable')
    const url=URL.createObjectURL(data)
    if(tab)tab.location.replace(url)
    else{const a=document.createElement('a');a.href=url;a.download='resume.pdf';a.click()}
    setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(error){tab?.close();throw error}
}

export async function candidateResumeStatus(prospectId,resumeId) {
  const {data:version,error}=await supabase.rpc('linked_platform_resume_version',{p_prospect:prospectId,p_hash:resumeId})
  if(error)throw Error('Platform status lookup unavailable')
  return version?platformIntake({action:'status',prospect_id:prospectId,resume_version_id:version}):needleIntegration({action:'status',prospect_id:prospectId,resume_id:resumeId})
}
