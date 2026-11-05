import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import StatusBadge from '../components/StatusBadge'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { SelectField } from '../components/recruiter/RecordFormFields'
import {
  archiveCandidate,
  attachCandidateToRequirement,
  canDeleteRecord,
  deleteCandidate,
} from '../services/recruiterRecordService'
import {
  ArrowLeft,
  FileText,
  Layers3,
  Users,
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { CASE_FORM_INVITE_STAGES, caseStatusMeta } from '../utils/recruitmentCase'
import { downloadPdfReport, logRecruiterExport } from '../services/recruiterReportExportService'
import {
  buildLookupMap,
  formatDateTime,
  formatRelativeTime,
  getLookupName,
  getStatusMeta,
  JUNCTION_STATUS_META,
  PROSPECT_STATUS_META,
} from './recruiterDashboardUtils'

function StatusPill({ status, metaMap }) {
  const meta = getStatusMeta(metaMap, status)
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function RecruiterProspectDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { prospectId } = useParams()
  // Return to wherever this page was opened from (workspace, tracker, detail…).
  const backTo = location.state?.from || '/recruiter/candidates'
  const { user, profile, signOut } = useAuth()
  const { permissions = [], role = null, loading: permLoading } = usePermissions()
  const canExportPdf = permissions.includes('export_data') || permissions.includes('export_pdf')
  const canViewApplicationTokens = permissions.includes('view_applications')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [prospect, setProspect] = useState(null)
  const [notes, setNotes] = useState([])
  const [junctions, setJunctions] = useState([])
  const [applications, setApplications] = useState([])
  const [linkedRequirements, setLinkedRequirements] = useState([])
  const [authorMap, setAuthorMap] = useState({})
  const [lookupMaps, setLookupMaps] = useState({
    countries: {},
    ranks: {},
    vessel_types: {},
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteCases, setInviteCases] = useState([])
  const [inviteCaseId, setInviteCaseId] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [attachOptions, setAttachOptions] = useState(null) // null = picker closed
  const [attachValue, setAttachValue] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadDetail = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          prospectResult,
          notesResult,
          junctionsResult,
          applicationsResult,
          casesResult,
          countriesResult,
          ranksResult,
          vesselTypesResult,
        ] = await Promise.all([
          supabase
            .from('prospects')
            .select('id, name, dob, nationality_id, rank_applied_for_id, vessel_type_id, exp_in_rank_months, previous_employer, is_first_time_at_sea, telephone, email, lead_source, status, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, archive_reason, deleted_at, invited_at, claimed_at, applicant_user_id, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at, version')
            .eq('id', prospectId)
            .maybeSingle(),
          supabase
            .from('prospect_notes')
            .select('id, prospect_id, body, author_recruiter_id, created_at, edited_at, edit_locked_at, is_transition_note, visibility')
            .eq('prospect_id', prospectId)
            .order('created_at', { ascending: false }),
          supabase
            .from('prospect_requirements')
            .select('id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at, version')
            .eq('prospect_id', prospectId)
            .order('updated_at', { ascending: false }),
          supabase
            .from('applications')
            .select(
              canViewApplicationTokens
                ? 'id, public_token, reference_number, status, submitted_at, created_at, updated_at, prospect_id'
                : 'id, reference_number, status, submitted_at, created_at, updated_at, prospect_id'
            )
            .eq('prospect_id', prospectId)
            .order('created_at', { ascending: false }),
          supabase
            .from('recruitment_cases')
            .select('id, requirement_id, status')
            .eq('prospect_id', prospectId),
          supabase.from('countries').select('id, code, name').order('name'),
          supabase.from('ranks').select('id, code, name').order('name'),
          supabase.from('vessel_types').select('id, code, name').order('name'),
        ])

        if (cancelled) return

        if (prospectResult.error) throw prospectResult.error
        if (!prospectResult.data) {
          setProspect(null)
          setLoading(false)
          return
        }

        const prospectRow = prospectResult.data
        const noteRows = notesResult.error ? [] : notesResult.data || []
        const junctionRows = junctionsResult.error ? [] : junctionsResult.data || []
        const applicationRows = applicationsResult.error ? [] : applicationsResult.data || []

        const requirementIds = [...new Set(junctionRows.map((row) => row.requirement_id).filter(Boolean))]
        let requirementRows = []
        if (requirementIds.length > 0) {
          const { data: fetchedRequirements, error: requirementError } = await supabase
            .from('requirements')
            .select('id, req_id_display, status, customer_name, rank_id, vessel_type_id, positions_required, target_days, owner_recruiter_id, created_by_recruiter_id, updated_at, created_at')
            .in('id', requirementIds)
          if (requirementError) throw requirementError
          requirementRows = fetchedRequirements || []
        }

        const authorIds = [...new Set([
          ...noteRows.map((row) => row.author_recruiter_id),
          ...junctionRows.map((row) => row.assigned_by_recruiter_id),
          ...junctionRows.map((row) => row.last_transition_by_recruiter_id),
        ].filter(Boolean))]

        let authors = []
        if (authorIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', authorIds)
          if (profileError) throw profileError
          authors = profileRows || []
        }

        setProspect(prospectRow)
        setNotes(noteRows)
        setJunctions(junctionRows)
        setApplications(applicationRows)
        setLinkedRequirements(requirementRows)
        const eligibleCases = (casesResult.error ? [] : casesResult.data || [])
          .filter((row) => CASE_FORM_INVITE_STAGES.includes(row.status))
        setInviteCases(eligibleCases)
        setInviteCaseId((current) => eligibleCases.some((row) => row.id === current)
          ? current : eligibleCases.length === 1 ? eligibleCases[0].id : '')
        setAuthorMap(buildLookupMap(authors))
        setInviteEmail(prospectRow.email || '')
        setInviteStatus('')
        setLookupMaps({
          countries: buildLookupMap(countriesResult.error ? [] : countriesResult.data || []),
          ranks: buildLookupMap(ranksResult.error ? [] : ranksResult.data || []),
          vessel_types: buildLookupMap(vesselTypesResult.error ? [] : vesselTypesResult.data || []),
        })
      } catch (loadError) {
        if (cancelled) return
        console.error('Error loading prospect detail:', loadError)
        setError(loadError?.message || 'Failed to load prospect detail')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (user && !permLoading) {
      loadDetail()
    }

    return () => {
      cancelled = true
    }
  }, [user, permLoading, prospectId, canViewApplicationTokens, reloadToken])

  const linkedRequirementMap = useMemo(() => buildLookupMap(linkedRequirements), [linkedRequirements])


  if (!permissions.includes('view_prospects')) {
    return <Navigate to="/unauthorized" replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-raised">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={Users}
            title="Could not load candidate"
            description={error}
            action={
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="workspace-action-button workspace-action-button--primary"
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    )
  }

  if (!prospect) {
    return (
      <div className="min-h-screen bg-raised">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={Users}
            title="Candidate not found"
            action={
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="workspace-action-button workspace-action-button--primary"
              >
                Back
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const nationalityName = getLookupName(lookupMaps.countries, prospect.nationality_id, 'Unknown nationality')
  const rankName = getLookupName(lookupMaps.ranks, prospect.rank_applied_for_id, 'Unknown rank')
  const vesselName = getLookupName(lookupMaps.vessel_types, prospect.vessel_type_id, 'Unknown vessel')

  const statusMeta = getStatusMeta(PROSPECT_STATUS_META, prospect.status)
  const canAttach = permissions.includes('edit_junction_status') && !prospect.archived_at && !prospect.deleted_at
  const canManageCandidate = permissions.includes('archive_prospects') || permissions.includes('delete_prospects') || permissions.includes('edit_prospects')
  const canDeleteThis = canManageCandidate && !prospect.deleted_at && canDeleteRecord({ role, createdAt: prospect.created_at })
  const currentRecruiterId = profile?.id || user?.id || ''

  const runAction = async (fn, message, after) => {
    setActing(true)
    setActionError('')
    setNotice('')
    try {
      await fn()
      setNotice(message)
      if (after) after()
      else setReloadToken((token) => token + 1)
    } catch (actionErr) {
      setActionError(actionErr?.message || 'The candidate could not be updated.')
    } finally {
      setActing(false)
    }
  }

  // Open requirements this candidate is not linked to yet.
  const openAttachPicker = async () => {
    setActionError('')
    const linked = new Set(junctions.map((junction) => junction.requirement_id))
    const { data, error: loadError } = await supabase
      .from('requirements')
      .select('id, req_id_display, customer_name, status, archived_at, deleted_at')
      .eq('status', 'open')
      .order('date_opened', { ascending: false })
    if (loadError) {
      setActionError(loadError.message)
      return
    }
    setAttachValue('')
    setAttachOptions((data || [])
      .filter((row) => !row.archived_at && !row.deleted_at && !linked.has(row.id))
      .map((row) => ({ value: row.id, label: `${row.req_id_display} · ${row.customer_name || 'No customer'}` })))
  }

  const onDelete = () => {
    if (!window.confirm(`Delete candidate ${prospect.name}? This is a restricted action.`)) return
    runAction(() => deleteCandidate(prospect, currentRecruiterId), 'Candidate deleted.', () => navigate('/recruiter/candidates'))
  }
  const canEditProspect = permissions.includes('edit_prospects')
  const canSendInvite = permissions.includes('send_prospect_invites')

  const handleSendInvite = async () => {
    setInviteLoading(true)
    setInviteStatus('')

    try {
      if (!inviteEmail.trim()) {
        throw new Error('Email is required to send an invite.')
      }
      if (!inviteCaseId) {
        throw new Error('Choose a case with a passed interview before inviting the long form.')
      }

      const canUpdateEmail = canEditProspect
      const finalEmail = canUpdateEmail ? inviteEmail.trim() : (prospect.email || '').trim()
      if (!finalEmail) {
        throw new Error('Prospect email is missing.')
      }

      const needsEmailUpdate = canUpdateEmail && finalEmail.toLowerCase() !== (prospect.email || '').trim().toLowerCase()
      if (needsEmailUpdate) {
        const { error: emailUpdateError } = await supabase.rpc('update_prospect_email_and_clear_bounce', {
          p_prospect_id: prospect.id,
          p_email: finalEmail,
          p_actor_role_at_event: role || null,
        })
        if (emailUpdateError) throw emailUpdateError
      }

      const { error } = await supabase.functions.invoke('send-prospect-invite', {
          body: {
            prospectId: prospect.id,
            caseId: inviteCaseId,
            personalMessage: inviteMessage || undefined,
          },
        })

      if (error) {
        const detail = typeof error.context?.json === 'function'
          ? await error.context.json().catch(() => null) : null
        throw new Error(detail?.error || error.message)
      }

      setInviteStatus('Invite sent successfully.')
      const { data: refreshed, error: refreshError } = await supabase
        .from('prospects')
        .select('id, name, dob, nationality_id, rank_applied_for_id, vessel_type_id, exp_in_rank_months, previous_employer, is_first_time_at_sea, telephone, email, lead_source, status, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, archive_reason, deleted_at, invited_at, claimed_at, applicant_user_id, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at, version')
        .eq('id', prospect.id)
        .maybeSingle()

      if (!refreshError && refreshed) {
        setProspect(refreshed)
      }
    } catch (sendError) {
      console.error('Failed to send invite:', sendError)
      setInviteStatus(sendError?.message || 'Failed to send invite')
    } finally {
      setInviteLoading(false)
    }
  }

  const exportProspectPdf = async () => {
    const summaryRows = [
      { label: 'Status', value: prospect.status },
      { label: 'Email', value: prospect.email || 'Not provided' },
      { label: 'Phone', value: prospect.telephone || 'Not provided' },
      { label: 'Lead source', value: prospect.lead_source || 'Not provided' },
      { label: 'Nationality', value: nationalityName },
      { label: 'Rank', value: rankName },
      { label: 'Vessel type', value: vesselName },
    ]

    const linkedRequirementsTable = linkedRequirements.map((requirement) => [
      requirement.req_id_display,
      formatDisplayValue(requirement.customer_name || 'Customer not set'),
      requirement.status,
      formatDateTime(requirement.updated_at),
    ])

    try {
      await logRecruiterExport({
        reportType: 'prospect_snapshot',
        exportFormat: 'pdf',
        rowIds: [prospect.id],
        rowCount: 1,
        prospectId: prospect.id,
        filters: { prospect_id: prospect.id },
        sort: { field: 'created_at', direction: 'desc' },
      })
      await downloadPdfReport({
        filename: `prospect-${prospect.name}`,
        title: 'Candidate snapshot',
        subtitle: prospect.name,
        summaryItems: summaryRows,
        tables: [
          {
            title: 'Linked requirements',
            headers: ['Requirement', 'Customer', 'Status', 'Updated'],
            rows: linkedRequirementsTable,
          },
        ],
      })
    } catch (exportError) {
      console.error('Failed to log prospect PDF export:', exportError)
      window.alert('Unable to export prospect PDF right now.')
    }
  }

  return (
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            title={prospect.name}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                {canExportPdf ? (
                  <button
                    type="button"
                    onClick={exportProspectPdf}
                    className="workspace-action-button workspace-action-button--secondary"
                  >
                    Export PDF
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate(backTo)}
                  className="workspace-action-button workspace-action-button--secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                {canAttach && attachOptions === null ? (
                  <button type="button" disabled={acting} onClick={openAttachPicker} className="workspace-action-button workspace-action-button--primary">
                    Attach to requirement
                  </button>
                ) : null}
                {canManageCandidate && !prospect.archived_at && !prospect.deleted_at ? (
                  <button type="button" disabled={acting} onClick={() => runAction(() => archiveCandidate(prospect), 'Candidate archived.')} className="workspace-action-button workspace-action-button--secondary">
                    Archive
                  </button>
                ) : null}
                {canDeleteThis ? (
                  <button type="button" disabled={acting} onClick={onDelete} className="workspace-action-button workspace-action-button--secondary">
                    Delete
                  </button>
                ) : null}
              </div>
            }
          >
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
              {prospect.archived_at ? <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold text-fg-secondary">Archived</span> : null}
              {prospect.deleted_at ? <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">Deleted</span> : null}
            </div>
          </PageHeader>

          {notice ? <div className="mt-4 rounded-control border border-success-line bg-success-soft px-4 py-3 text-sm text-success">{notice}</div> : null}
          {actionError ? <div className="mt-4 rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{actionError}</div> : null}
          {attachOptions !== null ? (
            <form
              className="recruiter-panel mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                runAction(() => attachCandidateToRequirement(prospect.id, attachValue), 'Candidate attached to requirement.', () => {
                  setAttachOptions(null)
                  setReloadToken((token) => token + 1)
                })
              }}
            >
              <div className="min-w-0 flex-1">
                {attachOptions.length === 0 ? (
                  <p className="text-sm text-fg-secondary">No open requirements left to attach {prospect.name} to.</p>
                ) : (
                  <SelectField
                    label={`Attach ${prospect.name} to`}
                    value={attachValue}
                    onChange={setAttachValue}
                    options={attachOptions}
                    placeholder="Choose an open requirement"
                    required
                  />
                )}
              </div>
              <div className="flex gap-2">
                {attachOptions.length > 0 ? (
                  <button type="submit" disabled={!attachValue || acting} className="workspace-action-button workspace-action-button--primary">
                    Attach
                  </button>
                ) : null}
                <button type="button" onClick={() => setAttachOptions(null)} className="workspace-action-button workspace-action-button--secondary">
                  Cancel
                </button>
              </div>
            </form>
          ) : null}


          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Rank applied for</p>
                    <p className="mt-1 text-base font-semibold text-fg">{formatDisplayValue(rankName)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Vessel type</p>
                    <p className="mt-1 text-base font-semibold text-fg">{formatDisplayValue(vesselName)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Nationality</p>
                    <p className="mt-1 text-base font-semibold text-fg">{nationalityName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Experience in rank</p>
                    <p className="mt-1 text-base font-semibold text-fg">{prospect.exp_in_rank_months} month{prospect.exp_in_rank_months === 1 ? '' : 's'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Phone</p>
                    <p className="mt-1 text-base font-semibold text-fg">{prospect.telephone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Email</p>
                    <p className="mt-1 text-base font-semibold text-fg break-words">{prospect.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Lead source</p>
                    <p className="mt-1 text-base font-semibold text-fg">{prospect.lead_source || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">First contacted</p>
                    <p className="mt-1 text-base font-semibold text-fg">{formatDateTime(prospect.first_contacted_at)}</p>
                  </div>
                </div>
              </div>

              <div className="recruiter-panel overflow-hidden">
                <div className="border-b border-line px-6 py-4">
                  <h2 className="mt-1 text-lg font-semibold text-fg">Requirements</h2>
                </div>
                <div className="divide-y">
                  {junctions.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon={Layers3}
                        title="No linked requirements"
                        action={
                          canAttach ? (
                            <button
                              type="button"
                              onClick={openAttachPicker}
                              className="workspace-action-button workspace-action-button--primary"
                            >
                              Attach to requirement
                            </button>
                          ) : null
                        }
                      />
                    </div>
                  ) : (
                    junctions.map((junction) => {
                      const requirement = linkedRequirementMap[junction.requirement_id]
                      const authorName = authorMap[junction.last_transition_by_recruiter_id]?.full_name || authorMap[junction.assigned_by_recruiter_id]?.full_name || 'Recruiter'

                      return (
                        <div key={junction.id} className="p-6 transition-colors hover:bg-raised/70">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold text-fg">
                                  {requirement ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/recruiter/workspace/requirements/${requirement.id}`, { state: { from: `${location.pathname}${location.search}` } })}
                                      className="text-left hover:text-accent-text hover:underline"
                                    >
                                      {requirement.req_id_display}
                                    </button>
                                  ) : junction.requirement_id}
                                </h3>
                                <StatusPill status={junction.status} metaMap={JUNCTION_STATUS_META} />
                              </div>
                              <div className="grid gap-2 text-sm text-fg-secondary md:grid-cols-2">
                                <div>
                                  <span className="font-medium text-fg-secondary">Customer:</span>{' '}
                                  {requirement ? formatDisplayValue(requirement.customer_name || 'Customer not set') : 'Not loaded'}
                                </div>
                                <div>
                                  <span className="font-medium text-fg-secondary">Updated:</span> {formatRelativeTime(junction.updated_at)}
                                </div>
                                <div>
                                  <span className="font-medium text-fg-secondary">By:</span> {authorName}
                                </div>
                                {junction.joined_at ? (
                                  <div>
                                    <span className="font-medium text-fg-secondary">Joined:</span> {formatDateTime(junction.joined_at)}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="recruiter-panel overflow-hidden">
                <div className="border-b border-line px-6 py-4">
                  <h2 className="mt-1 text-lg font-semibold text-fg">Notes</h2>
                </div>
                <div className="divide-y">
                  {notes.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon={FileText}
                        title="No notes yet"
                      />
                    </div>
                  ) : (
                    notes.map((note) => {
                      const authorName = authorMap[note.author_recruiter_id]?.full_name || authorMap[note.author_recruiter_id]?.email || 'Recruiter'
                      return (
                        <div key={note.id} className="p-6">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-semibold text-fg">{authorName}</p>
                            {note.is_transition_note ? (
                              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">Transition note</span>
                            ) : null}
                            {note.visibility === 'master_only' ? (
                              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Master only</span>
                            ) : null}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fg-secondary">{note.body}</p>
                          <p className="mt-3 text-xs text-fg-muted">
                            {formatDateTime(note.edited_at || note.created_at)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {canSendInvite ? (
              <div className="recruiter-panel p-6">
                <h2 className="mt-2 text-lg font-semibold text-fg">Invite to long application</h2>
                <p className="mt-2 text-sm text-fg-secondary">
                  The interview must be passed first. Completing the form does not mean the candidate has been selected.
                </p>

                <label className="mt-4 block">
                  <span className="text-sm font-medium text-fg-secondary">Recruitment case</span>
                  <select
                    value={inviteCaseId}
                    onChange={(event) => setInviteCaseId(event.target.value)}
                    className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg"
                  >
                    <option value="">Choose an eligible case</option>
                    {inviteCases.map((row) => (
                      <option key={row.id} value={row.id}>
                        {linkedRequirementMap[row.requirement_id]?.req_id_display || 'Requirement'} · {caseStatusMeta(row.status).label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-fg-secondary">Invite email</span>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      disabled={!canEditProspect}
                      className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-fg-secondary">Personal message</span>
                    <textarea
                      value={inviteMessage}
                      onChange={(event) => setInviteMessage(event.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                      placeholder="Optional note to the candidate"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendInvite}
                    disabled={inviteLoading || !canSendInvite || !inviteEmail.trim() || !inviteCaseId}
                    className="workspace-action-button workspace-action-button--primary"
                  >
                    {inviteLoading ? 'Sending...' : 'Send form invite'}
                  </button>
                  {inviteCases.length === 0 ? (
                    <span className="text-sm text-fg-muted">No case has a passed interview yet.</span>
                  ) : null}
                  {prospect.bounce_flag ? (
                    <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
                      Email bounced
                    </span>
                  ) : null}
                </div>

                {inviteStatus ? (
                  <p className="mt-3 text-sm text-fg-secondary">{inviteStatus}</p>
                ) : null}
              </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <p className="text-sm font-medium text-fg">Applications</p>
                <div className="mt-4 space-y-3">
                  {applications.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No linked applications"
                    />
                  ) : (
                    applications.map((application) =>
                      canViewApplicationTokens && application.public_token ? (
                        <button
                          key={application.id}
                          type="button"
                          onClick={() => navigate(`/application/view/${application.public_token}`)}
                          className="w-full rounded-control border border-line bg-raised px-4 py-4 text-left transition hover:border-accent hover:bg-surface"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-fg">{application.reference_number}</p>
                              <p className="mt-1 text-sm text-fg-secondary">{formatDateTime(application.created_at)}</p>
                            </div>
                            <StatusBadge status={application.status} />
                          </div>
                        </button>
                      ) : (
                        <div
                          key={application.id}
                          className="w-full rounded-control border border-line bg-raised px-4 py-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-fg">{application.reference_number}</p>
                              <p className="mt-1 text-sm text-fg-secondary">{formatDateTime(application.created_at)}</p>
                            </div>
                            <StatusBadge status={application.status} />
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
