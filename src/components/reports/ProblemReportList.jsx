import { useEffect, useState } from 'react'
import { listProblems, reportScreenshot, setProblemStatus } from '../../lib/problemReports'

export default function ProblemReportList({ userId, operator = false }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [image, setImage] = useState(null)
  const [saving, setSaving] = useState(null)
  useEffect(() => {
    let active = true
    listProblems({ operator, userId }).then(data => { if (active) setRows(data) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [operator, userId])
  useEffect(() => () => { if (image) URL.revokeObjectURL(image) }, [image])
  async function view(row) {
    setError('')
    try { setImage(URL.createObjectURL(await reportScreenshot(row))) } catch (e) { setError(e.message) }
  }
  async function change(row, status) {
    setSaving(row.id); setError('')
    try { await setProblemStatus(row.id, status); setRows(items => items.map(item => item.id === row.id ? { ...item, status } : item)) }
    catch (e) { setError(e.message) } finally { setSaving(null) }
  }
  return <div className="space-y-4">
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {loading ? <p role="status">Loading reports…</p> : !rows.length ? <p>No reports yet.</p> : <>
      <p className="text-sm text-fg-muted">Latest {rows.length} reports. Screenshots expire after seven days; report details remain.</p>
      <ul className="space-y-3">{rows.map(row => <li key={row.id} className="rounded-lg border border-line p-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><strong>Report #{row.report_number}</strong><span>{new Date(row.created_at).toLocaleString()}</span></div>
        <p className="text-sm break-all">{row.page} · Version {row.app_version}</p>
        <p className="whitespace-pre-wrap break-words">{row.description || 'Screenshot report'}</p>
        <div className="flex flex-wrap items-center gap-3">
          {operator ? <label>Status <select aria-label={`Status for report ${row.report_number}`} className="rounded border border-line bg-surface p-1" value={row.status} disabled={saving === row.id} onChange={e => change(row, e.target.value)}><option value="new">New</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label> : <span>{({new:'New',in_progress:'In progress',resolved:'Resolved'})[row.status]}</span>}
          {row.screenshot_deleted_at || Date.parse(row.screenshot_expires_at) <= Date.now() ? <span className="text-sm text-fg-muted">Screenshot expired</span> : <button className="underline" onClick={() => view(row)}>View screenshot</button>}
        </div>
      </li>)}</ul>
    </>}
    {image && <div className="space-y-2"><button className="underline" onClick={() => setImage(null)}>Close screenshot</button><img src={image} alt="Reported problem screenshot" className="max-w-full border border-line rounded" /></div>}
  </div>
}
