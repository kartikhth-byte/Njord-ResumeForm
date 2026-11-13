import { supabase } from './supabase'

export const REPORT_BUCKET = 'problem-screenshots'
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
export const REPORT_STATUSES = ['new', 'in_progress', 'resolved']

// Never persist login tokens, query strings, public application links or arbitrary text.
export function reportPage(pathname) {
  return ('/' + pathname.split('/').filter(Boolean).map(part => /^[a-z-]{1,40}$/.test(part) ? part : ':id').join('/')).slice(0, 240)
}

export async function submitProblem({ id, blob, description, page, appVersion }) {
  if (!blob || blob.type !== 'image/png' || blob.size > MAX_SCREENSHOT_BYTES) throw new Error('Use a screenshot under 5 MB.')
  const { data: report, error: reserveError } = await supabase.rpc('begin_problem_report', {
    p_id: id, p_page: page, p_app_version: appVersion, p_description: description,
  })
  if (reserveError) throw new Error('Could not send the report. Try again shortly.')
  if (report.submitted_at) return report
  const { error: uploadError } = await supabase.storage.from(REPORT_BUCKET).upload(report.screenshot_path, blob, { contentType: 'image/png', upsert: false })
  // The provider may report a lost-success retry as 400 or 409. Finalize even
  // after an upload error: the server verifies our exact reserved PNG exists.
  const { data, error } = await supabase.rpc('submit_problem_report', { p_id: id })
  if (error) throw new Error(uploadError
    ? 'Screenshot upload failed. Your preview is kept; try Send again.'
    : 'Could not finish sending. Your preview is kept; try Send again.')
  return data
}

export async function listProblems({ operator = false, userId }) {
  let query = supabase.from('problem_reports').select('id,report_number,reporter_id,page,app_version,description,status,created_at,submitted_at,screenshot_path,screenshot_expires_at,screenshot_deleted_at').not('submitted_at', 'is', null)
  if (!operator) query = query.eq('reporter_id', userId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error('Could not load reports.')
  return data
}

export async function reportScreenshot(report) {
  if (report.screenshot_deleted_at || Date.parse(report.screenshot_expires_at) <= Date.now()) throw new Error('Screenshot expired. Report details are still available.')
  // Authenticated download checks RLS on every request; no shareable public URL.
  const { data, error } = await supabase.storage.from(REPORT_BUCKET).download(report.screenshot_path)
  if (error) throw new Error('Screenshot is unavailable or has expired.')
  return data
}

export async function setProblemStatus(id, status) {
  const { error } = await supabase.rpc('set_problem_report_status', { p_id: id, p_status: status })
  if (error) throw new Error('Could not update the report.')
}
