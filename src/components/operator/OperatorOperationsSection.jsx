import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { needleIntegration } from '../../services/needleIntegrationService'
import { dateTimeCell } from '../../utils/directoryDisplay'

const stamp = value => value ? dateTimeCell(value) : 'Not observed'
const words = value => String(value || 'operation').replaceAll('_', ' ').replaceAll('/', ' / ')
export default function OperatorOperationsSection({ section = 'health' }) {
  const [state, setState] = useState({ loading: true, data: null, needle: null, error: '' })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: '' }))
    const [holmes, needle] = await Promise.allSettled([
      supabase.rpc('platform_operator_snapshot').then(result => { if (result.error) throw result.error; return result.data }),
      needleIntegration({ action: 'operator' }),
    ])
    setState({ loading: false, data: holmes.status === 'fulfilled' ? holmes.value : null, needle: needle.status === 'fulfilled' ? needle.value : null,
      error: [holmes.status === 'rejected' ? 'Holmes operational data unavailable.' : '', needle.status === 'rejected' ? 'Needle operational data unavailable.' : ''].filter(Boolean).join(' ') })
  }, [])
  useEffect(() => { load() }, [load])
  const changeAccount = async (row, action) => {
    const question = action === 'reset' ? `Send a password reset email to ${row.email}?` : `${action === 'disable' ? 'Disable' : 'Enable'} access for ${row.email}?`
    if (!window.confirm(question)) return
    setBusy(true);setNotice('')
    try {
      const { data, error } = await supabase.functions.invoke('operator-accounts', { body: { action, user_id: row.id } })
      if (error || data?.error) throw new Error(data?.error || error.message)
      setNotice(action === 'reset' ? 'Reset requested. The user sets their password privately.' : 'Account access updated.')
      await load()
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  const events = state.data?.events || []
  const health = state.needle?.health
  const worker = health?.worker
  const workerFresh = worker?.observed_at && Date.now() - new Date(worker.observed_at).getTime() < 7 * 60 * 1000
  const expiry = events.find(row => row.category === 'job' && row.action === 'expiry_warnings')
  const projectRef = /^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/.exec(import.meta.env.VITE_SUPABASE_URL || '')?.[1]
  const logsUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/logs/edge-logs` : null
  const failures = events.filter(row => row.status === 'failed').length
  const emailEvents = state.data?.email_events || []
  const healthRows = [
    { name:'Intake worker', state: !worker ? 'Not observed' : !workerFresh ? 'Stale' : worker.status || 'Observed', checked: worker?.observed_at, meaning: !worker ? 'Intake availability is unknown.' : !workerFresh ? 'Recent intake activity has not been confirmed.' : worker.intake_enabled ? 'Automatic intake is enabled.' : 'Automatic intake is paused.' },
    { name:'Email delivery', state: emailEvents.length ? 'Reports received' : 'No delivery reports', checked: emailEvents[0]?.latest, meaning: emailEvents.length ? 'Delivery evidence is available for review.' : 'Sending does not confirm inbox delivery.' },
    { name:'Expiry reminders', state: expiry?.status || 'Not run', checked: expiry?.created_at, meaning: expiry ? 'The latest reminder run was recorded.' : 'No reminder run has been observed.' },
    { name:'Background jobs', state: !events.length ? 'Not observed' : failures ? `${failures} failures` : 'No recorded failures', checked: events[0]?.created_at, meaning: events.length ? `${failures} failures in the latest ${events.length} recorded operations.` : 'No operation history is available.' },
  ]
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{section === 'users' ? 'Organizations & users' : section === 'audit' ? 'Audit' : 'Operations'}</h2><button className="workspace-action-button workspace-action-button--secondary" disabled={state.loading} onClick={load}><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</button></div>
    {state.loading && <p role="status">Checking operations…</p>}
    {state.error && <p role="alert" className="text-sm text-warning">{state.error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {section === 'health' && <>
      <div className="tracker-table-wrap" tabIndex={0} aria-label="Operational health"><table className="tracker-table" style={{ minWidth: 780 }}><thead><tr>{['Service','State','Last evidence','What this means','Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{healthRows.map(row => <tr key={row.name}><td className="font-medium">{row.name}</td><td>{row.state}</td><td>{stamp(row.checked)}</td><td>{row.meaning}</td><td>{logsUrl ? <a className="text-accent-text underline" href={logsUrl} target="_blank" rel="noreferrer">Open logs</a> : '—'}</td></tr>)}</tbody></table></div>
      <details className="text-sm text-fg-secondary"><summary className="cursor-pointer">Technical evidence</summary><div className="mt-3 space-y-2"><p>Intake probes: {worker?.probe_failures?.join(', ') || 'None reported'}</p><p>Corpus / conversion: {health ? `${health.pool_documents} documents · ${health.conversion_review} blocking conversion reviews` : 'Not observed'}</p>{health?.facts?.map(row => <p key={`${row.review_status}:${row.extraction_status}`}>{row.count} facts: {row.review_status} / {row.extraction_status}</p>)}<p>Email delivery, last 30 days: {emailEvents.length ? emailEvents.map(row => `${row.event_type}: ${row.count} (${stamp(row.latest)})`).join(' · ') : 'No delivery webhook evidence observed'}</p></div></details>
    </>}
    {section === 'users' && <>
      {(state.data?.organizations || []).map(row => <div key={row.id} className="rounded-lg border border-line p-4"><h3 className="font-semibold">{row.name}</h3><p className="text-xs text-fg-muted">{row.id}</p><p className="text-sm">Résumé folder: {health ? health.resume_folder_configured ? 'Configured in Railway' : 'Not configured' : 'Not observed'} · Original uploads and identity review: Holmes platform Resume Intake (independent of Needle indexing)</p><p className="text-xs text-fg-muted">Mailbox delivery is managed in Platform settings and the existing mail automation. Additional customer onboarding remains a separate rollout.</p></div>)}
      {(state.data?.users || []).map(row => <div key={row.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-line p-4"><div><p className="font-medium">{row.name || row.email}</p><p className="text-sm text-fg-secondary">{row.email} · {row.roles.join(', ') || 'No recruiter role'}{row.operator ? ' · Operator' : ''}</p></div><div className="flex gap-3"><button className="underline" disabled={busy} onClick={() => changeAccount(row, 'reset')}>Send reset</button>{!row.operator && !row.roles.includes('Master Recruiter') && <button className="underline" disabled={busy} onClick={() => changeAccount(row, row.banned_until && new Date(row.banned_until).getTime() > Date.now() ? 'enable' : 'disable')}>{row.banned_until && new Date(row.banned_until).getTime() > Date.now() ? 'Enable account' : 'Disable account'}</button>}</div></div>)}
      <p className="text-xs text-fg-muted">Master Recruiter and operator access changes require KT’s reviewed handover.</p>
    </>}
    {section === 'audit' && <>
      <p className="text-sm text-fg-secondary">Secret values and résumé contents are excluded. Operations show actor, target, time and outcome.</p>
      <ol className="divide-y divide-line">{events.map((row,i) => <li key={i} className="py-3 text-sm"><p>{row.actor_id ? 'A user' : 'The scheduler'} ran {words(row.action)} · {words(row.status)} <time className="text-fg-muted">{stamp(row.created_at)}</time></p><details className="mt-1 break-all text-xs text-fg-muted"><summary className="cursor-pointer">Details</summary>Category: {row.category} · Actor: {row.actor_id || 'Scheduler'}{row.target_id ? ` · Target: ${row.target_id}` : ''}{row.details?.key ? ` · Setting: ${row.details.key}` : ''}{row.details?.code ? ` · Outcome: ${row.details.code}` : ''}</details></li>)}</ol>
      <h3 className="font-semibold">Needle administrative access</h3><ol>{state.needle?.audit?.map((row,i) => <li key={i} className="break-all text-xs">{stamp(row.created_at)} · {row.action} · Actor {row.actor_id} · Target {row.target_id}</li>)}</ol>
      <h3 className="font-semibold">Needle runtime changes</h3><ol>{health?.settings_audit?.map((row,i) => <li key={i} className="text-xs">{stamp(row.changed_at)} · {row.key} · {row.changed_by}</li>)}</ol>
      <h3 className="font-semibold">Recruitment audit</h3><ol>{state.data?.legacy_audit?.map((row,i) => <li key={i} className="text-xs">{stamp(row.created_at)} · {row.entity_type} / {row.event_type} · {row.actor_user_id || 'System'}</li>)}</ol>
    </>}
  </div>
}
