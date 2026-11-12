import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { openCandidateResume } from '../../services/needleIntegrationService'

const action = 'workspace-action-button workspace-action-button--secondary'

// Keep original viewing on the existing authenticated CV path. Application
// tokens are fetched only for this candidate and only with view permission.
export default function RecruitmentResourceActions({ candidate, prospectId, applicationId, applicationPending = false, permissions }) {
  const location = useLocation()
  const canViewApplication = permissions.includes('view_applications')
  const canViewProfile = permissions.includes('view_prospects')
  const [forms, setForms] = useState({ loading: canViewApplication, rows: [], error: '' })
  const [selectedId, setSelectedId] = useState('')
  const [retry, setRetry] = useState(0)
  const [cvBusy, setCvBusy] = useState(false)
  const [cvError, setCvError] = useState('')

  useEffect(() => {
    if (!canViewApplication) return
    let cancelled = false
    async function load() {
      setForms({ loading: true, rows: [], error: '' })
      setSelectedId('')
      let query = supabase.from('applications')
        .select('id, public_token, reference_number, submitted_at')
        .eq('prospect_id', prospectId)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
      if (applicationId) query = query.eq('id', applicationId)
      try {
        const { data, error } = await query
        if (error) throw error
        if (!cancelled) {
          const rows = data || []
          setForms({ loading: false, rows, error: '' })
          if (rows.length === 1) setSelectedId(rows[0].id)
        }
      } catch {
        if (!cancelled) setForms({ loading: false, rows: [], error: 'Could not load applications.' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [prospectId, applicationId, canViewApplication, retry])

  const selected = forms.rows.find(row => row.id === selectedId)
  const from = `${location.pathname}${location.search}`
  async function viewCv() {
    setCvBusy(true)
    setCvError('')
    try { await openCandidateResume(prospectId, candidate.needle_resume_id) }
    catch { setCvError('Could not open the CV. Try again or check the candidate profile.') }
    finally { setCvBusy(false) }
  }

  return <section aria-label="Candidate documents" className="space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      {candidate?.needle_resume_id
        ? <button type="button" className={action} disabled={cvBusy} onClick={viewCv}>{cvBusy ? 'Opening CV…' : 'View CV'}</button>
        : <span className="text-sm text-fg-muted">No CV linked</span>}
      {canViewProfile
        ? <Link className={action} to={`/recruiter/workspace/prospects/${prospectId}`} state={{ from }}>Candidate profile</Link>
        : <span className="text-sm text-fg-muted">Candidate profile access unavailable</span>}
      {!canViewApplication ? <span className="text-sm text-fg-muted">Application access unavailable</span>
        : forms.loading ? <span role="status" className="text-sm text-fg-muted">Loading applications…</span>
          : forms.error ? <><span role="alert" className="text-sm text-danger">{forms.error}</span><button type="button" className={action} onClick={() => setRetry(value => value + 1)}>Retry applications</button></>
            : !forms.rows.length ? <span className="text-sm text-fg-muted">{applicationId ? (applicationPending ? 'Application not yet submitted' : 'Linked application unavailable') : 'No submitted application available'}</span>
              : <>
                {forms.rows.length > 1 && <label className="flex flex-col gap-1 text-sm">Submitted application
                  <select className="rounded-control border border-line bg-surface p-2" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
                    <option value="">Choose an application</option>
                    {forms.rows.map(row => <option key={row.id} value={row.id}>{row.reference_number || 'Application'} · {new Date(row.submitted_at).toLocaleDateString()}</option>)}
                  </select>
                </label>}
                {selected?.public_token
                  ? <Link className={action} to={`/application/view/${selected.public_token}`}>View application</Link>
                  : selected ? <span className="text-sm text-fg-muted">Application unavailable</span> : <button type="button" className={action} disabled>View application</button>}
              </>}
    </div>
    {canViewApplication && !forms.loading && !forms.error && !applicationId && forms.rows.length > 0 && <p className="text-xs text-fg-muted">Candidate’s submitted {forms.rows.length === 1 ? 'application' : 'applications'}; not linked to this recruitment.</p>}
    {cvError && <p role="alert" className="text-sm text-danger">{cvError}</p>}
  </section>
}
