import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import CandidateResumePanel from '../components/recruiter/CandidateResumePanel'
import StatusBadge from '../components/StatusBadge'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import CandidateAttachmentDialog from '../components/recruiter/CandidateAttachmentDialog'
import useClientFleet from '../hooks/useClientFleet'
import { displayRankName } from '../utils/directoryDisplay'
import {
  archiveCandidate,
  canDeleteRecord,
  deleteCandidate,
} from '../services/recruiterRecordService'
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  MoreVertical,
  Phone,
  Users,
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { CASE_FORM_INVITE_STAGES, caseStatusMeta, isCaseTerminal } from '../utils/recruitmentCase'
import SegmentedControl from '../components/ui/SegmentedControl'
import { resumeIntakeEnabled } from '../lib/resumeIntake'
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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [attachRequirements, setAttachRequirements] = useState(null) // null = dialog closed
  const [noteBody, setNoteBody] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  const fleet = useClientFleet({ includeArchived: true, includeVesselTypes: false, enabled: !permLoading })
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
            .select('needle_resume_id, resume_source, id, display_id, name, dob, nationality_id, rank_applied_for_id, vessel_type_id, exp_in_rank_months, previous_employer, is_first_time_at_sea, telephone, email, lead_source, status, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, archive_reason, deleted_at, invited_at, claimed_at, applicant_user_id, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at, version')
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
                ? 'id, public_token, display_id, reference_number, status, submitted_at, created_at, updated_at, prospect_id'
                : 'id, display_id, reference_number, status, submitted_at, created_at, updated_at, prospect_id'
            )
            .eq('prospect_id', prospectId)
            .order('created_at', { ascending: false }),
          supabase
            .from('recruitment_cases')
            .select('id, requirement_id, status, cycle, created_by, created_at, updated_at')
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
        if (casesResult.error) throw casesResult.error
        const caseRows = casesResult.data || []
        const caseRequirementIds = new Set(caseRows.map(row => row.requirement_id))
        const relationshipRows = [
          ...caseRows.map(row => ({ ...row, isCase: true })),
          ...junctionRows.filter(row => !caseRequirementIds.has(row.requirement_id)),
        ]

        const requirementIds = [...new Set([...junctionRows, ...(casesResult.data || [])].map((row) => row.requirement_id).filter(Boolean))]
        let requirementRows = []
        if (requirementIds.length > 0) {
          const { data: fetchedRequirements, error: requirementError } = await supabase
            .from('requirements')
            .select('id, display_id, req_id_display, status, customer_name, vessel_name, company_id, ship_id, rank_id, vessel_type_id, positions_required, target_days, owner_recruiter_id, created_by_recruiter_id, archived_at, deleted_at, updated_at, created_at')
            .in('id', requirementIds)
          if (requirementError) throw requirementError
          requirementRows = fetchedRequirements || []
        }

        const authorIds = [...new Set([
          ...noteRows.map((row) => row.author_recruiter_id),
          ...junctionRows.map((row) => row.assigned_by_recruiter_id),
          ...junctionRows.map((row) => row.last_transition_by_recruiter_id),
          ...caseRows.map((row) => row.created_by),
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
        setJunctions(relationshipRows)
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

  const nationalityName = getLookupName(lookupMaps.countries, prospect.nationality_id, 'Not provided')
  const rankName = displayRankName(getLookupName(lookupMaps.ranks, prospect.rank_applied_for_id, 'Not provided'))
  const vesselName = getLookupName(lookupMaps.vessel_types, prospect.vessel_type_id, 'Not provided')

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

  // Open requirements for the attach dialog (it filters and ranks them).
  const openAttachDialog = async () => {
    setActionError('')
    const { data, error: loadError } = await supabase
      .from('requirements')
      .select('company_id, ship_id, location_reviewed_at, id, display_id, req_id_display, version, date_opened, vessel_name, vessel_type_id, rank_id, positions_required, customer_name, status, archived_at, deleted_at')
      .eq('status', 'open')
      .order('date_opened', { ascending: false })
    if (loadError) {
      setActionError(loadError.message)
      return
    }
    setAttachRequirements(data || [])
  }

  const saveNote = async (event) => {
    event.preventDefault()
    const body = noteBody.trim()
    if (!body || noteBusy) return
    setNoteBusy(true)
    setActionError('')
    const { error: noteError } = await supabase.rpc('add_prospect_note', { p_prospect_id: prospect.id, p_body: body })
    if (noteError) setActionError(noteError.message)
    else { setNoteBody(''); setReloadToken((token) => token + 1) }
    setNoteBusy(false)
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
        .select('needle_resume_id, resume_source, id, display_id, name, dob, nationality_id, rank_applied_for_id, vessel_type_id, exp_in_rank_months, previous_employer, is_first_time_at_sea, telephone, email, lead_source, status, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, archive_reason, deleted_at, invited_at, claimed_at, applicant_user_id, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at, version')
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
      requirement.display_id || requirement.req_id_display,
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

  const canAddNotes = permissions.includes('edit_prospect_notes') && !prospect.archived_at && !prospect.deleted_at
  const phoneDigits = (prospect.telephone || '').replace(/[^\d]/g, '')
  const offerStatuses = ['offered', 'offer_accepted', 'documents_pending', 'documents_verified', 'sent_to_principal']
  const lockedStatuses = ['offer_accepted', 'documents_pending', 'documents_verified', 'sent_to_principal']
  const competingOffers = junctions.filter((row) => offerStatuses.includes(row.status)).length > 1
  const requirementTitle = (requirement) => {
    if (!requirement) return 'Requirement'
    const rank = displayRankName(getLookupName(lookupMaps.ranks, requirement.rank_id, '')) || 'Rank not set'
    const ship = requirement.vessel_name || 'Ship not set'
    return requirement.customer_name ? `${rank} – ${ship} (${requirement.customer_name})` : `${rank} – ${ship}`
  }
  const statusLabel = (junction) => (junction.isCase ? caseStatusMeta(junction.status).label : (JUNCTION_STATUS_META[junction.status]?.label || junction.status))
  const isActive = (junction) => (junction.isCase ? !isCaseTerminal(junction.status) : !['rejected', 'withdrawn', 'closed', 'joined'].includes(junction.status))
  const activeJunctions = junctions.filter(isActive)
  const pastJunctions = junctions.filter((junction) => !isActive(junction))
  const lockedBy = junctions.find((junction) => lockedStatuses.includes(junction.status))
  const joinedCase = junctions.find((junction) => junction.status === 'hired' || junction.status === 'joined')
  const facts = [
    prospect.nationality_id ? nationalityName : '',
    prospect.exp_in_rank_months ? `${prospect.exp_in_rank_months} month${prospect.exp_in_rank_months === 1 ? '' : 's'} in rank` : '',
    prospect.lead_source ? `Found via ${prospect.lead_source}` : '',
    prospect.display_id || '',
  ].filter(Boolean)
  const inviteOptions = inviteCases.map((row) => ({ value: row.id, label: `${requirementTitle(linkedRequirementMap[row.requirement_id])} · ${caseStatusMeta(row.status).label}` }))
  const showMenu = canExportPdf || (canManageCandidate && !prospect.archived_at && !prospect.deleted_at) || canDeleteThis
  const menuItem = 'block w-full rounded px-3 py-2 text-left text-sm hover:bg-raised disabled:opacity-50'
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'cv', label: 'CV & contact' },
    { value: 'notes', label: 'Notes', count: notes.length },
    { value: 'forms', label: 'Application forms', count: applications.length },
  ]
  const activeTab = tabs.some((tab) => tab.value === searchParams.get('tab')) ? searchParams.get('tab') : 'overview'
  const setTab = (value) => setSearchParams((previous) => { const next = new URLSearchParams(previous); if (value === 'overview') next.delete('tab'); else next.set('tab', value); return next }, { replace: true, state: location.state })

  const requirementLine = (junction) => {
    const requirement = linkedRequirementMap[junction.requirement_id]
    const when = junction.joined_at ? `joined ${formatDateTime(junction.joined_at)}` : junction.updated_at ? `updated ${formatRelativeTime(junction.updated_at)}` : ''
    return (
      <li key={junction.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line py-3 last:border-b-0">
        <p className="min-w-0 text-sm text-fg">
          <span className="font-semibold">{requirementTitle(requirement)}</span>
          {' — '}{statusLabel(junction)}{when ? <span className="text-fg-muted"> · {when}</span> : null}
        </p>
        {junction.isCase ? (
          <Link className="whitespace-nowrap text-sm text-accent-text underline" to={`/recruiter/recruitment?case=${junction.id}`} aria-label={`Open in Recruitment: ${requirement?.display_id || requirement?.req_id_display || 'requirement'}`}>Open in Recruitment</Link>
        ) : requirement ? (
          <Link className="whitespace-nowrap text-sm text-accent-text underline" to={`/recruiter/workspace/requirements/${requirement.id}`} state={{ from: `${location.pathname}${location.search}` }}>Open requirement</Link>
        ) : null}
      </li>
    )
  }

  return (
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg hover:underline">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />{backTo.startsWith('/recruiter/candidates') ? 'Candidates' : 'Back'}
          </Link>
          <PageHeader
            title={prospect.name}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                {canAttach && !lockedBy ? (
                  <button type="button" disabled={acting} onClick={openAttachDialog} className={`workspace-action-button ${activeJunctions.length ? 'workspace-action-button--secondary' : 'workspace-action-button--primary'}`}>
                    {activeJunctions.length ? 'Attach to another requirement' : 'Attach to requirement'}
                  </button>
                ) : null}
                {showMenu ? (
                  <details className="relative">
                    <summary className="directory-actions__summary" aria-label="More actions" title="More actions"><MoreVertical aria-hidden="true" className="h-4 w-4" /></summary>
                    <div className="absolute right-0 z-20 mt-2 w-48 rounded-control border border-line bg-surface p-1 shadow-lg">
                      {canExportPdf ? <button type="button" className={menuItem} onClick={exportProspectPdf}>Download PDF</button> : null}
                      {canManageCandidate && !prospect.archived_at && !prospect.deleted_at ? (
                        <button type="button" className={menuItem} disabled={acting} onClick={() => runAction(() => archiveCandidate(prospect), 'Candidate archived.')}>Archive</button>
                      ) : null}
                      {canDeleteThis ? <button type="button" className={`${menuItem} text-danger`} disabled={acting} onClick={onDelete}>Delete</button> : null}
                    </div>
                  </details>
                ) : null}
              </div>
            }
          >
            <p className="mt-1 text-base text-fg-secondary">
              {rankName !== 'Not provided' ? rankName : 'Rank not set'}{prospect.vessel_type_id ? ` · ${formatDisplayValue(vesselName)}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {prospect.telephone ? <a className="workspace-action-button workspace-action-button--secondary" href={`tel:${prospect.telephone}`}><Phone aria-hidden="true" className="h-4 w-4" />{prospect.telephone}</a> : null}
              {phoneDigits ? <a className="workspace-action-button workspace-action-button--secondary" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" className="h-4 w-4" />WhatsApp</a> : null}
              {prospect.email ? <a className="workspace-action-button workspace-action-button--secondary max-w-full" href={`mailto:${prospect.email}`} title={prospect.email}><Mail aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">Email</span></a> : null}
              {prospect.archived_at ? <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold text-fg-secondary">Archived</span> : null}
              {prospect.deleted_at ? <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">Deleted</span> : null}
            </div>
          </PageHeader>

          {notice ? <div role="status" className="rounded-control border border-success-line bg-success-soft px-4 py-3 text-sm text-success">{notice}</div> : null}
          {actionError ? <div role="alert" className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{actionError}</div> : null}

          <SegmentedControl label="Candidate sections" options={tabs} value={activeTab} onChange={setTab} />

          {activeTab === 'overview' ? (
            <section className="recruiter-panel space-y-5 p-6" aria-label="Overview">
              {facts.length ? <p className="text-sm text-fg-secondary">{facts.join(' · ')}</p> : null}
              {lockedBy ? <p role="status" className="text-sm text-warning">Has an accepted offer on {requirementTitle(linkedRequirementMap[lockedBy.requirement_id])}.</p> : null}
              {!lockedBy && joinedCase ? <p className="text-sm text-fg-secondary">Joined {requirementTitle(linkedRequirementMap[joinedCase.requirement_id])}.</p> : null}
              {competingOffers ? <p role="status" className="text-sm text-warning">Offers on more than one requirement. Check with the candidate before moving forward.</p> : null}
              <div>
                <h2 className="text-base font-semibold text-fg">Requirements</h2>
                {activeJunctions.length ? <ul className="mt-1">{activeJunctions.map(requirementLine)}</ul> : <p className="mt-2 text-sm text-fg-secondary">Not in any open requirement.</p>}
                {pastJunctions.length ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-fg-secondary">Past requirements ({pastJunctions.length})</summary>
                    <ul className="mt-1">{pastJunctions.map(requirementLine)}</ul>
                  </details>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
                <span className="font-semibold text-fg">CV</span>
                <span className="text-fg-secondary">{prospect.needle_resume_id ? 'CV on file.' : 'No CV yet.'}</span>
                <button type="button" className="text-accent-text underline" onClick={() => setTab('cv')}>{prospect.needle_resume_id ? 'View CV' : 'Go to CV'}</button>
              </div>
            </section>
          ) : null}

          {activeTab === 'cv' ? (
            <CandidateResumePanel candidate={prospect} countries={lookupMaps.countries} permissions={permissions} onChanged={() => setReloadToken(value => value + 1)} />
          ) : null}

          {activeTab === 'notes' ? (
            <section className="recruiter-panel p-6" aria-label="Notes">
              {canAddNotes ? (
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={saveNote}>
                  <label className="sr-only" htmlFor="candidate-note">Write a note</label>
                  <input id="candidate-note" value={noteBody} maxLength={2000} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write a note…" className="h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3" />
                  <button type="submit" disabled={noteBusy || !noteBody.trim()} className="workspace-action-button workspace-action-button--primary">Save</button>
                </form>
              ) : null}
              {notes.length === 0 ? (
                <p className="mt-3 text-sm text-fg-muted">No notes yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {notes.map((note) => {
                    const authorName = authorMap[note.author_recruiter_id]?.full_name || authorMap[note.author_recruiter_id]?.email || 'Recruiter'
                    return (
                      <li key={note.id} className="rounded-control border border-line p-3">
                        <p className="whitespace-pre-wrap break-words text-sm text-fg">{note.body}</p>
                        <p className="mt-2 text-xs text-fg-muted">
                          {authorName} · {formatDateTime(note.edited_at || note.created_at)}
                          {note.visibility === 'master_only' ? ' · Master only' : ''}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ) : null}

          {activeTab === 'forms' ? (
            <section className="recruiter-panel space-y-5 p-6" aria-label="Application forms">
              {applications.length === 0 ? <p className="text-sm text-fg-muted">No application forms yet.</p> : (
                <ul className="space-y-3">
                  {applications.map((application) => {
                    const body = (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-fg">{application.display_id || application.reference_number}</p>
                          <p className="mt-1 text-sm text-fg-secondary">{formatDateTime(application.created_at)}</p>
                        </div>
                        <StatusBadge status={application.status} />
                      </div>
                    )
                    return (
                      <li key={application.id}>
                        {canViewApplicationTokens && application.public_token ? (
                          <button type="button" onClick={() => navigate(`/application/view/${application.public_token}`, { state: { from: location.pathname + location.search } })} className="w-full rounded-control border border-line bg-raised px-4 py-4 text-left transition hover:border-accent hover:bg-surface">{body}</button>
                        ) : (
                          <div className="w-full rounded-control border border-line bg-raised px-4 py-4">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {canSendInvite ? (
                <div className="space-y-3 border-t border-line pt-5">
                  <h2 className="text-base font-semibold text-fg">Send full application form</h2>
                  {inviteOptions.length === 0 ? (
                    <p className="text-sm text-fg-secondary">Available after the candidate passes the interview.</p>
                  ) : (
                    <>
                      {inviteOptions.length > 1 ? (
                        <label className="block text-sm"><span className="font-medium text-fg-secondary">Requirement</span>
                          <select className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-3" value={inviteCaseId} onChange={(event) => setInviteCaseId(event.target.value)}>
                            {inviteOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                      ) : <p className="text-sm text-fg-secondary">For {inviteOptions[0].label}</p>}
                      <label className="block">
                        <span className="text-sm font-medium text-fg-secondary">Email</span>
                        <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} disabled={!canEditProspect} className="mt-1 w-full rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-fg-secondary">Message (optional)</span>
                        <textarea value={inviteMessage} onChange={(event) => setInviteMessage(event.target.value)} rows={3} className="mt-1 w-full rounded-control border border-line bg-surface px-4 py-3 text-sm text-fg" />
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={handleSendInvite} disabled={inviteLoading || !inviteEmail.trim() || !inviteCaseId} className="workspace-action-button workspace-action-button--primary">{inviteLoading ? 'Sending…' : 'Send form'}</button>
                        {prospect.bounce_flag ? <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Last email bounced</span> : null}
                      </div>
                      {inviteStatus ? <p role="status" className="text-sm text-fg-secondary">{inviteStatus}</p> : null}
                    </>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>

      {attachRequirements !== null ? (
        <CandidateAttachmentDialog
          candidate={{ ...prospect, attachedRequirements: junctions.map((junction) => ({ requirementId: junction.requirement_id, requirement: linkedRequirementMap[junction.requirement_id], status: junction.status })) }}
          requirements={attachRequirements}
          fleet={fleet}
          ranks={Object.values(lookupMaps.ranks)}
          vesselTypes={Object.values(lookupMaps.vessel_types)}
          requireCv={resumeIntakeEnabled()}
          onSaved={(message) => { setAttachRequirements(null); setNotice(message); setReloadToken((token) => token + 1) }}
          onClose={() => setAttachRequirements(null)}
        />
      ) : null}
    </div>
  )
}
