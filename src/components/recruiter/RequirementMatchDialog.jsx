import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, ArrowLeft, FileText } from 'lucide-react'
import { needleIntegration } from '../../services/needleIntegrationService'
import { useAuth } from '../auth/AuthContext'
import { attachedCase, criterionLabel, matchAssessment, matchLabels } from '../../utils/requirementMatch'
import AddToHolmesDialog from './AddToHolmesDialog'

function Criteria({ row }) {
  return <ul className="space-y-2 text-sm">{(row.verdicts || []).map((v, i) => <li key={`${v.family}-${i}`} className="rounded-control border border-line p-3">
    <p className="font-medium capitalize">{criterionLabel(v.family)} <span className={v.verdict === 'PASS' ? 'text-success' : v.verdict === 'FAIL' ? 'text-danger' : 'text-warning'}>· {v.verdict === 'PASS' ? 'Confirmed' : v.verdict === 'FAIL' ? 'Does not match' : 'Needs verification'}</span></p>
    <p className="mt-1 text-xs text-fg-muted">{v.required ? 'Mandatory criterion' : 'Optional criterion'}</p>
    {v.evidence && <p className="mt-1 whitespace-pre-wrap break-words text-fg-secondary">{v.evidence}</p>}
  </li>)}</ul>
}

export default function RequirementMatchDialog({ requirement, onClose, onChanged }) {
  const { permissions = [] } = useAuth()
  const dialog = useRef(null)
  const reviewPanel = useRef(null)
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [selected, setSelected] = useState(null)
  const [attaching, setAttaching] = useState(false)
  const [savingAttachment, setSavingAttachment] = useState(false)
  const [saved, setSaved] = useState({})
  const [pdf, setPdf] = useState({ loading: false, error: '', image: '', page_count: 0 })
  const [pdfPage, setPdfPage] = useState(1)
  const [zoom, setZoom] = useState(false)
  const [pdfRetry, setPdfRetry] = useState(0)
  const selectedIds = useMemo(() => selected ? [selected.resume_id] : [], [selected])
  const scope = useMemo(() => ({ requirement_id: requirement.id, expected_version: requirement.version }), [requirement.id, requirement.version])

  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement
    element.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = overflow; trigger?.focus() }
  }, [])

  const load = useCallback(async (offset = 0, stage = null) => {
    setSelected(null); setAttaching(false)
    setState(prev => ({ ...prev, loading: true, error: '' }))
    try {
      const data = await needleIntegration({ ...scope, action: stage ? 'match_results' : 'match', ...(stage ? { stage_id: stage } : {}), offset })
      setState({ loading: false, error: '', data })
    } catch (error) { setState(prev => ({ ...prev, loading: false, error: error.message })) }
  }, [scope])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (selected) { reviewPanel.current?.focus({ preventScroll: true }); reviewPanel.current?.scrollIntoView({ block: 'nearest' }) }
  }, [selected])

  useEffect(() => {
    if (!selected) return
    let active = true
    setPdf(prev => ({ ...prev, loading: true, error: '', image: '' }))
    needleIntegration({ ...scope, action: 'match_preview', stage_id: state.data.stage_id, resume_id: selected.resume_id, page: pdfPage }).then(data => {
      if (active) setPdf({ loading: false, error: '', ...data })
    }).catch(error => { if (active) setPdf(prev => ({ ...prev, loading: false, error: error.message, image: '' })) })
    return () => { active = false }
  }, [selected, scope, state.data?.stage_id, pdfRetry, pdfPage])

  const review = (row, attach) => { setPdfPage(1); setZoom(false); setSelected(row); setAttaching(attach) }

  const data = state.data
  const attached = selected && (saved[selected.resume_id] || attachedCase(selected, requirement.id))
  const canAttach = permissions.includes('edit_junction_status')
  return <dialog ref={dialog} aria-labelledby="requirement-match-title" className="m-auto h-[94dvh] max-h-[94dvh] w-[96vw] max-w-7xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/70" onCancel={event => { event.preventDefault(); if (!savingAttachment) onClose() }}>
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4 sm:px-6">
        <div className="min-w-0"><h2 id="requirement-match-title" className="text-xl font-semibold">Match résumés</h2><p className="mt-1 text-sm text-fg-secondary">{requirement.req_id_display} · Review and attach to this requirement</p>{savingAttachment && <p role="status" className="mt-1 text-sm text-warning">Saving attachment. Please wait…</p>}</div>
        <button disabled={savingAttachment} aria-label="Close match results" className="rounded-control p-2 hover:bg-raised focus-visible:outline focus-visible:outline-2" onClick={onClose}><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <p className="mb-4 text-sm text-fg-secondary">Only résumés with confirmed present rank and vessel-type experience matches are shown. Other criteria are optional: missing or different nationality does not remove a résumé. Ratings show confirmed criteria, not a probability of suitability.</p>
        {state.loading && <p role="status" className="py-12 text-center">Matching résumés…</p>}
        {state.error && <div role="alert" className="mb-4 rounded-control border border-danger-line p-4"><p>{state.error}</p><button className="mt-2 underline" onClick={() => load(data?.offset || 0, data?.stage_id)}>Retry matching</button></div>}
        {!state.loading && !state.error && data && <>
          {data.warnings?.length > 0 && <div role="alert" className="mb-4 rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-warning"><p className="font-semibold">Some requirement criteria were not applied</p>{data.warnings.map(w => <p key={w}>{w}</p>)}</div>}
          <div className={`grid min-w-0 gap-5 ${selected ? 'xl:grid-cols-2' : ''}`}>
            <section className="min-w-0" aria-label="Matched résumé rows">
              <p role="status" className="mb-3 text-sm text-fg-secondary">{data.total === 0 ? 'No résumés have confirmed matches on both present rank and vessel type.' : `Showing ${data.offset + 1}–${data.offset + data.rows.length} of ${data.total} résumés`}</p>
              <div className="overflow-x-auto rounded-control border border-line">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup><col style={{width:'32%'}}/><col style={{width:'40%'}}/><col style={{width:'28%'}}/></colgroup>
                  <thead className="bg-raised text-xs uppercase text-fg-muted"><tr><th className="break-words p-1 sm:p-3">Candidate</th><th className="break-words p-2 sm:p-3">Match assessment</th><th className="break-words p-1 sm:p-3">Actions</th></tr></thead>
                  <tbody>{data.rows.map(row => {
                    const exists = saved[row.resume_id] || attachedCase(row, requirement.id)
                    return <tr key={row.resume_id} className={`border-t border-line ${selected?.resume_id === row.resume_id ? 'bg-accent-soft' : ''}`}>
                      <td className="break-words p-1 align-top sm:p-3"><p className="font-semibold">{row.full_name || 'Unnamed résumé'}</p><p className="mt-1 capitalize text-fg-secondary">{row.present_rank?.replaceAll('_', ' ') || 'Rank unverified'}</p><p className="mt-1 text-xs text-fg-muted">{row.nationality || 'Nationality not stated'}</p>{row.existing_candidate && <p className="mt-1 text-xs text-fg-muted">Already in Holmes</p>}</td>
                      <td className="break-words p-2 align-top sm:p-3"><p className={`font-medium ${row.public_bucket === 'confirmed_match' ? 'text-success' : row.public_bucket === 'not_a_fit' ? 'text-danger' : 'text-warning'}`}>{matchLabels[row.public_bucket] || 'Needs more evidence'}</p><p className="mt-1 text-xs">{matchAssessment(row)}</p>{row.verdicts?.filter(v => v.verdict !== 'PASS').map(v => <p key={v.family} className="mt-1 text-xs capitalize text-fg-secondary">{criterionLabel(v.family)}: {v.verdict === 'FAIL' ? 'does not match' : 'verify'}</p>)}</td>
                      <td className="p-1 align-top sm:p-3"><div className="flex flex-col items-start gap-2"><button disabled={savingAttachment} className="underline" aria-label={`Review ${row.full_name || 'résumé'}`} onClick={() => review(row, false)}>Review</button><button className="max-w-full break-words rounded-control border border-line px-1 py-1.5 text-left text-xs disabled:opacity-60 sm:px-3 sm:text-sm" disabled={Boolean(exists) || !canAttach || savingAttachment} aria-label={exists ? `Already attached ${row.full_name || 'résumé'}` : `Attach ${row.full_name || 'résumé'}`} onClick={() => review(row, true)}>{exists ? 'Already attached' : 'Attach'}</button></div></td>
                    </tr>
                  })}</tbody>
                </table>
              </div>
              <nav aria-label="Match result pages" className="mt-4 flex items-center justify-between gap-3"><button className="workspace-action-button workspace-action-button--secondary" disabled={!data.offset || savingAttachment} onClick={() => load(Math.max(0, data.offset - 25), data.stage_id)}>Previous</button><button className="workspace-action-button workspace-action-button--secondary" disabled={data.next_offset == null || savingAttachment} onClick={() => load(data.next_offset, data.stage_id)}>Next</button></nav>
            </section>
            {selected && <section ref={reviewPanel} tabIndex={-1} aria-label="Résumé review" className="min-w-0 space-y-4 rounded-xl border border-line p-3 sm:p-4">
              <button disabled={savingAttachment} className="flex items-center gap-2 text-sm underline" onClick={() => { setSelected(null); setAttaching(false) }}><ArrowLeft className="h-4 w-4" />Back to results</button>
              <h3 className="break-words text-lg font-semibold">{selected.full_name || 'Unnamed résumé'}</h3>
              <Criteria row={selected} />
              {selected.cases?.length > 0 && <div className="rounded-control border border-warning-line p-3 text-sm"><p className="font-semibold">Existing recruitment cases</p>{selected.cases.map(c => <p key={c.id}>{c.requirements?.req_id_display || 'Requirement'} · {c.status.replaceAll('_', ' ')}</p>)}{selected.cases.some(c => c.requirement_id !== requirement.id && !['closed','rejected','withdrawn','hired'].includes(c.status)) && <p className="mt-2 text-warning">Review the other active case or offer before attaching. Cases remain separate.</p>}</div>}
              <div className="rounded-control border border-line p-3"><p className="mb-2 flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />Original résumé</p>
                <nav aria-label="Original résumé pages" className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <button className="underline disabled:opacity-50" disabled={pdf.loading || pdfPage <= 1} onClick={() => setPdfPage(n => n - 1)}>Previous page</button>
                  <span role="status">Page {pdfPage}{pdf.page_count ? ` of ${pdf.page_count}` : ''}</span>
                  <button className="underline disabled:opacity-50" disabled={pdf.loading || !pdf.page_count || pdfPage >= pdf.page_count} onClick={() => setPdfPage(n => n + 1)}>Next page</button>
                  <button className="underline" aria-pressed={zoom} onClick={() => setZoom(v => !v)}>{zoom ? 'Fit width' : 'Zoom in'}</button>
                </nav>
                {pdf.loading && <p role="status">Loading original…</p>}{pdf.error && <p role="alert">{pdf.error} <button className="underline" onClick={() => setPdfRetry(n => n + 1)}>Retry original</button></p>}
                {!pdf.loading && !pdf.error && pdf.image && <div className="max-h-[500px] overflow-auto rounded border border-line bg-white"><img alt={`Original résumé page ${pdfPage} of ${pdf.page_count}`} src={`data:image/png;base64,${pdf.image}`} style={{ width: zoom ? '150%' : '100%', maxWidth: 'none' }} /></div>}
              </div>
              {attached ? <p role="status" className="rounded-control border border-success-line p-3 text-sm text-success">Already attached to {requirement.req_id_display}. No duplicate case was created.</p> : attaching ? <AddToHolmesDialog inline busy={savingAttachment} onBusyChange={setSavingAttachment} resumeIds={selectedIds} stageId={data.stage_id} requirementId={requirement.id} requirementVersion={requirement.version} onClose={() => setAttaching(false)} onSaved={(rid, id) => { setSaved(prev => ({ ...prev, [rid]: id })); setAttaching(false); onChanged() }} /> : <button disabled={!canAttach} className="workspace-action-button workspace-action-button--primary" onClick={() => setAttaching(true)}>Review identity and attach</button>}
            </section>}
          </div>
        </>}
      </div>
    </div>
  </dialog>
}
