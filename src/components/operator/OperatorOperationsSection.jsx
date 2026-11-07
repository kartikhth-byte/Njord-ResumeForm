import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { needleIntegration } from '../../services/needleIntegrationService'

const stamp = value => value ? new Date(value).toLocaleString() : 'Not observed'
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
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{section === 'users' ? 'Organizations & users' : section === 'audit' ? 'Audit' : 'Operations'}</h2><button className="underline" disabled={state.loading} onClick={load}>Refresh</button></div>
    {state.loading && <p role="status">Loading operational evidence…</p>}
    {state.error && <p role="alert" className="text-sm text-warning">{state.error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {section === 'health' && <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="font-medium">Intake worker</dt><dd className="text-sm text-fg-secondary">{!worker ? 'Not observed' : !workerFresh ? 'Stale heartbeat' : worker.status} · Last observed {stamp(worker?.observed_at)}</dd><dd className="text-sm">{worker ? worker.intake_enabled ? 'Automatic Drive intake enabled' : 'Automatic Drive intake paused' : 'Intake switch not observed'}{worker?.probe_failures?.length ? ` · Failed probes: ${worker.probe_failures.join(', ')}` : ''}</dd></div>
        <div><dt className="font-medium">Corpus / conversion</dt><dd className="text-sm text-fg-secondary">{health ? `${health.pool_documents} documents · ${health.conversion_review} blocking conversion reviews` : 'Not observed'}</dd>{health?.facts?.map(row => <dd key={`${row.review_status}:${row.extraction_status}`} className="text-xs text-fg-muted">{row.count} facts: {row.review_status} / {row.extraction_status}</dd>)}</div>
        <div><dt className="font-medium">Email delivery, last 30 days</dt><dd className="text-sm text-fg-secondary">{state.data?.email_events?.length ? state.data.email_events.map(row => `${row.event_type}: ${row.count} (${stamp(row.latest)})`).join(' · ') : 'No delivery webhook evidence observed'}</dd><dd className="text-xs text-fg-muted">Delivery webhooks are evidence; accepted send requests alone do not prove inbox delivery.</dd></div>
        <div><dt className="font-medium">Last expiry-warning run</dt><dd className="text-sm text-fg-secondary">{expiry ? `${expiry.status} · ${stamp(expiry.created_at)}` : 'Not observed since instrumentation was enabled'}</dd></div>
      </dl>
      <p className="text-sm">Recorded function/job failures: {events.filter(row => row.status === 'failed').length} in the latest 100 operations. {logsUrl ? <a className="underline" href={logsUrl} target="_blank" rel="noreferrer">Open full Supabase function logs</a> : 'Open the configured project’s Supabase function logs for the complete history.'}</p>
    </>}
    {section === 'users' && <>
      {(state.data?.organizations || []).map(row => <div key={row.id} className="rounded-lg border border-line p-4"><h3 className="font-semibold">{row.name}</h3><p className="text-xs text-fg-muted">{row.id}</p><p className="text-sm">Résumé folder: {health ? health.resume_folder_configured ? 'Configured in Railway' : 'Not configured' : 'Not observed'} · Original uploads and identity review: Holmes platform Resume Intake (independent of Needle indexing)</p><p className="text-xs text-fg-muted">Mailbox delivery is managed in Platform settings and the existing mail automation. Additional customer onboarding remains a separate rollout.</p></div>)}
      {(state.data?.users || []).map(row => <div key={row.id} className="flex flex-wrap justify-between gap-3 rounded-lg border border-line p-4"><div><p className="font-medium">{row.name || row.email}</p><p className="text-sm text-fg-secondary">{row.email} · {row.roles.join(', ') || 'No recruiter role'}{row.operator ? ' · Operator' : ''}</p></div><div className="flex gap-3"><button className="underline" disabled={busy} onClick={() => changeAccount(row, 'reset')}>Send reset</button>{!row.operator && !row.roles.includes('Master Recruiter') && <button className="underline" disabled={busy} onClick={() => changeAccount(row, row.banned_until && new Date(row.banned_until).getTime() > Date.now() ? 'enable' : 'disable')}>{row.banned_until && new Date(row.banned_until).getTime() > Date.now() ? 'Enable account' : 'Disable account'}</button>}</div></div>)}
      <p className="text-xs text-fg-muted">Master Recruiter and operator access changes require KT’s reviewed handover.</p>
    </>}
    {section === 'audit' && <>
      <p className="text-sm text-fg-secondary">Secret values and résumé contents are excluded. Operations show actor, target, time and outcome.</p>
      <ol className="space-y-2">{events.map((row,i) => <li key={i} className="rounded border border-line p-3 text-sm">{stamp(row.created_at)} · {row.category} / {row.action} · {row.status}<div className="break-all text-xs text-fg-muted">Actor: {row.actor_id || 'Scheduler'}{row.target_id ? ` · Target: ${row.target_id}` : ''}{row.details?.key ? ` · Setting: ${row.details.key}` : ''}{row.details?.code ? ` · Outcome: ${row.details.code}` : ''}</div></li>)}</ol>
      <h3 className="font-semibold">Needle administrative access</h3><ol>{state.needle?.audit?.map((row,i) => <li key={i} className="break-all text-xs">{stamp(row.created_at)} · {row.action} · Actor {row.actor_id} · Target {row.target_id}</li>)}</ol>
      <h3 className="font-semibold">Needle runtime changes</h3><ol>{health?.settings_audit?.map((row,i) => <li key={i} className="text-xs">{stamp(row.changed_at)} · {row.key} · {row.changed_by}</li>)}</ol>
      <h3 className="font-semibold">Recruitment audit</h3><ol>{state.data?.legacy_audit?.map((row,i) => <li key={i} className="text-xs">{stamp(row.created_at)} · {row.entity_type} / {row.event_type} · {row.actor_user_id || 'System'}</li>)}</ol>
    </>}
  </div>
}
