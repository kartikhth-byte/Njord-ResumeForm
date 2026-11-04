import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronUp, GitBranch, Loader2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import EmptyState from '../ui/EmptyState'
import {
  CASE_EXIT_STATUSES,
  CASE_LEGACY_TARGETS,
  CASE_REASON_REQUIRED,
  CASE_RESULT_REASON_REQUIRED,
  CASE_RESULT_STATUSES,
  CASE_SCHEDULE_STATUSES,
  caseActionLabel,
  caseErrorMessage,
  caseNextActions,
  caseStatusMeta,
  isCaseTerminal,
} from '../../utils/recruitmentCase'
import {
  loadRequirementCases,
  openRecruitmentCase,
  transitionRecruitmentCase,
} from '../../services/recruitmentCaseService'
import { formatDateTime, formatRelativeTime } from '../../pages/recruiterDashboardUtils'

function CaseStatusPill({ status }) {
  const meta = caseStatusMeta(status)
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}>{meta.label}</span>
}

function describeEvent(event) {
  if (event.event_type === 'opened') return `Case opened (${event.payload?.source || 'recruiter'})${event.payload?.legacy_status ? `, earlier status ${String(event.payload.legacy_status).replaceAll('_', ' ')}` : ''}`
  if (event.event_type === 'source_added') return `Also added via ${event.payload?.source || 'recruiter'}`
  if (event.event_type === 'form_invited') return 'Long form invited'
  if (event.event_type === 'principal_send_attested') return `Worksheet sent to principal (${event.payload?.recipient || '—'}, ${event.payload?.channel || '—'})`
  return `${caseStatusMeta(event.from_status).label} → ${caseStatusMeta(event.to_status).label}`
}

function assessmentDetails(event) {
  const payload = event.payload || {}
  if (!payload.assessment) return ''
  const parts = [payload.scheduled_at ? `Scheduled ${formatDateTime(payload.scheduled_at)}` : null,
    payload.occurred_at ? `Occurred ${formatDateTime(payload.occurred_at)}` : null,
    payload.location ? `Location: ${payload.location}` : null,
    payload.note ? `Note: ${payload.note}` : null]
  return parts.filter(Boolean).join(' · ')
}

// Recruitment case v1 on the requirement page: one case per candidate, moved
// step by step through the agreed flow. All rules are enforced by the
// database functions; this panel only offers the moves they allow.
// Renders nothing where the case tables are not deployed yet.
export default function RecruitmentCasePanel({ requirementId, linkedProspects = [], permissions = [] }) {
  const location = useLocation()
  const canMove = permissions.includes('edit_junction_status')
  const canExit = canMove || permissions.includes('withdraw_junctions')
  // Opening a case is a workflow change: same gate as moving one, so the
  // "read only" label holds for Coordinators.
  const canOpen = canMove

  const [state, setState] = useState({ loading: true, available: false, cases: [], events: [], error: '' })
  const [names, setNames] = useState({})
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState({})
  const [openHistory, setOpenHistory] = useState({})
  const [showClosed, setShowClosed] = useState(false)

  const load = useCallback(async () => {
    try {
      const result = await loadRequirementCases(requirementId)
      const ids = new Set([
        ...result.cases.map((row) => row.prospect_id),
      ])
      const actorIds = new Set(result.events.map((event) => event.actor_id).filter(Boolean))
      const [prospectsResult, actorsResult] = await Promise.all([
        ids.size ? supabase.from('prospects').select('id, name').in('id', [...ids]) : Promise.resolve({ data: [] }),
        actorIds.size ? supabase.from('profiles').select('id, full_name, email').in('id', [...actorIds]) : Promise.resolve({ data: [] }),
      ])
      const nameMap = {}
      ;(prospectsResult.data || []).forEach((row) => { nameMap[row.id] = row.name })
      ;(actorsResult.data || []).forEach((row) => { nameMap[row.id] = row.full_name || row.email })
      setNames(nameMap)
      setState({ loading: false, ...result, error: '' })
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: caseErrorMessage(error) }))
    }
  }, [requirementId])

  useEffect(() => { load() }, [load])

  const eventsByCase = useMemo(() => state.events.reduce((acc, event) => {
    if (!acc[event.case_id]) acc[event.case_id] = []
    acc[event.case_id].push(event)
    return acc
  }, {}), [state.events])

  const activeCases = state.cases.filter((row) => !isCaseTerminal(row.status))
  const closedCases = state.cases.filter((row) => isCaseTerminal(row.status))
  const prospectsWithoutCase = linkedProspects.filter((prospect) => !activeCases.some((row) => row.prospect_id === prospect.id))

  if (state.loading) {
    return (
      <div className="recruiter-panel flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-accent-text" />
      </div>
    )
  }
  if (!state.available && !state.error) return null

  const run = async (key, fn, caseId) => {
    setBusy(key)
    setActionError((prev) => ({ ...prev, [caseId || key]: '' }))
    try {
      await fn()
      setForm(null)
      await load()
    } catch (error) {
      setActionError((prev) => ({ ...prev, [caseId || key]: caseErrorMessage(error) }))
    } finally {
      setBusy('')
    }
  }

  const move = (row, toStatus, reason = null, assessment = {}) => run(
    `${row.id}:${toStatus}`,
    () => transitionRecruitmentCase({ caseId: row.id, toStatus, reason, assessment, expectedVersion: row.version }),
    row.id,
  )

  const onAction = (row, toStatus) => {
    if (CASE_SCHEDULE_STATUSES.includes(toStatus) || CASE_RESULT_STATUSES.includes(toStatus)) {
      setForm({ caseId: row.id, mode: 'assessment', toStatus, reason: '', at: '', location: '', note: '' })
      return
    }
    if (CASE_REASON_REQUIRED.includes(toStatus)) {
      setForm({ caseId: row.id, mode: 'reason', toStatus, reason: '' })
      return
    }
    move(row, toStatus)
  }

  const renderForm = (row) => {
    if (!form || form.caseId !== row.id) return null
    const isTriage = form.mode === 'triage'
    const isExit = form.mode === 'exit'
    const isAssessment = form.mode === 'assessment'
    const isSchedule = CASE_SCHEDULE_STATUSES.includes(form.toStatus)
    const requiresReason = !isAssessment || CASE_RESULT_REASON_REQUIRED.includes(form.toStatus)
    const ready = form.toStatus && (!requiresReason || form.reason.trim())
      && (!isAssessment || (form.at && !Number.isNaN(new Date(form.at).getTime())))
    const save = () => {
      const assessment = isAssessment ? {
        [isSchedule ? 'scheduled_at' : 'occurred_at']: new Date(form.at).toISOString(),
        ...(isSchedule && form.location.trim() ? { location: form.location.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      } : {}
      move(row, form.toStatus, form.reason.trim() || null, assessment)
    }
    return (
      <div className="mt-4 rounded-control border border-line bg-raised p-4">
        {isTriage || isExit ? (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-fg-muted">{isTriage ? 'Current stage' : 'Outcome'}</span>
            <select
              value={form.toStatus}
              onChange={(event) => setForm({ ...form, toStatus: event.target.value })}
              className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm sm:w-64"
            >
              <option value="">Choose…</option>
              {(isTriage ? CASE_LEGACY_TARGETS : CASE_EXIT_STATUSES).map((status) => (
                <option key={status} value={status}>{isTriage ? caseStatusMeta(status).label : caseActionLabel(status)}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm font-medium text-fg">{caseActionLabel(form.toStatus)}</p>
        )}
        {isAssessment ? (
          <>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs font-medium text-fg-muted">{isSchedule ? 'Scheduled for' : 'Occurred at'} *</span>
              <input type="datetime-local" value={form.at} onChange={(event) => setForm({ ...form, at: event.target.value })} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm sm:w-64" />
            </label>
            {isSchedule ? (
              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-xs font-medium text-fg-muted">Location or link (optional)</span>
                <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm" />
              </label>
            ) : null}
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs font-medium text-fg-muted">Note (optional)</span>
              <textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm" />
            </label>
          </>
        ) : null}
        {requiresReason || isAssessment ? (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-medium text-fg-muted">Reason{requiresReason ? ' *' : ' (optional)'}</span>
            <textarea rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm" placeholder={isTriage ? 'Why this stage (from the earlier record)' : requiresReason ? 'Required' : ''} />
          </label>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!ready || Boolean(busy)}
            onClick={save}
            className="workspace-action-button workspace-action-button--primary disabled:opacity-50"
          >
            Save
          </button>
          <button type="button" onClick={() => setForm(null)} className="workspace-action-button workspace-action-button--secondary">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const renderCase = (row) => {
    const events = eventsByCase[row.id] || []
    const terminal = isCaseTerminal(row.status)
    const nextActions = caseNextActions(row.status)
    const historyOpen = Boolean(openHistory[row.id])
    return (
      <div key={row.id} className="p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/recruiter/workspace/prospects/${row.prospect_id}`}
                state={{ from: `${location.pathname}${location.search}` }}
                className="text-lg font-semibold text-fg hover:text-accent-text hover:underline"
              >
                {names[row.prospect_id] || 'Candidate'}
              </Link>
              <CaseStatusPill status={row.status} />
              {row.cycle > 1 ? <span className="text-xs text-fg-muted">Cycle {row.cycle}</span> : null}
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              Source: {row.source} · Updated {formatRelativeTime(row.updated_at)}
              {row.status === 'legacy' && row.legacy_status ? ` · Earlier status: ${row.legacy_status.replaceAll('_', ' ')}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenHistory((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-accent-text hover:underline"
          >
            History ({events.length})
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {!terminal && (canMove || canExit) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {row.status === 'legacy' && canMove ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setForm({ caseId: row.id, mode: 'triage', toStatus: '', reason: '' })}
                className="workspace-action-button workspace-action-button--primary"
              >
                Place on new flow
              </button>
            ) : null}
            {canMove ? nextActions.map((toStatus, index) => (
              <button
                key={toStatus}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => onAction(row, toStatus)}
                className={`workspace-action-button ${index === 0 ? 'workspace-action-button--primary' : 'workspace-action-button--secondary'}`}
              >
                {busy === `${row.id}:${toStatus}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {caseActionLabel(toStatus)}
              </button>
            )) : null}
            {canExit ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setForm({ caseId: row.id, mode: 'exit', toStatus: '', reason: '' })}
                className="workspace-action-button workspace-action-button--secondary"
              >
                Close case
              </button>
            ) : null}
          </div>
        ) : null}

        {renderForm(row)}
        {actionError[row.id] ? <p className="mt-3 text-sm text-danger">{actionError[row.id]}</p> : null}

        {historyOpen ? (
          <ol className="mt-4 space-y-2 border-l-2 border-line pl-4">
            {events.map((event) => (
              <li key={event.id} className="text-sm">
                <span className="text-fg">{describeEvent(event)}</span>
                {event.reason ? <span className="text-fg-secondary"> — {event.reason}</span> : null}
                {assessmentDetails(event) ? <div className="text-xs text-fg-secondary">{assessmentDetails(event)}</div> : null}
                <div className="text-xs text-fg-muted">
                  {formatDateTime(event.created_at)} · {names[event.actor_id] || (event.actor_id ? 'Recruiter' : 'System')}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    )
  }

  return (
    <div className="recruiter-panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">Recruitment cases</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            {activeCases.length} active{closedCases.length ? ` · ${closedCases.length} closed` : ''}
            {!canMove && !canExit ? ' · read only' : ''}
          </p>
        </div>
        {closedCases.length > 0 ? (
          <button type="button" onClick={() => setShowClosed((value) => !value)} className="text-sm font-medium text-accent-text hover:underline">
            {showClosed ? 'Hide closed' : 'Show closed'}
          </button>
        ) : null}
      </div>
      {state.error ? <p className="px-6 pt-4 text-sm text-danger">{state.error}</p> : null}
      <div className="divide-y divide-line">
        {activeCases.length === 0 && !showClosed ? (
          <div className="p-6">
            <EmptyState icon={GitBranch} title="No active cases" />
          </div>
        ) : null}
        {activeCases.map(renderCase)}
        {showClosed ? closedCases.map(renderCase) : null}
      </div>
      {canOpen && prospectsWithoutCase.length > 0 ? (
        <div className="border-t border-line px-6 py-4">
          <p className="mb-2 text-xs font-medium text-fg-muted">Start case</p>
          <div className="flex flex-wrap gap-2">
            {prospectsWithoutCase.map((prospect) => (
              <button
                key={prospect.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => run(`open:${prospect.id}`, () => openRecruitmentCase({ prospectId: prospect.id, requirementId }))}
                className="workspace-action-button workspace-action-button--secondary"
              >
                {busy === `open:${prospect.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {prospect.name}
              </button>
            ))}
          </div>
          {Object.entries(actionError).filter(([key, value]) => key.startsWith('open:') && value).map(([key, value]) => (
            <p key={key} className="mt-2 text-sm text-danger">{value}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
