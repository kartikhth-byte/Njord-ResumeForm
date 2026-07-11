import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import StatusBadge from '../components/StatusBadge'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  FileText,
  Layers3,
  ListChecks,
  Users,
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { downloadCsvReport, downloadPdfReport, logRecruiterExport } from '../services/recruiterReportExportService'
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
  const backTo = location.state?.from || '/recruiter/workspace?tab=candidates'
  const { user, profile, signOut } = useAuth()
  const { permissions = [], role = null, loading: permLoading } = usePermissions()
  const canExportCsv = permissions.includes('export_data') || permissions.includes('export_csv')
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
  }, [user, permLoading, prospectId, canViewApplicationTokens])

  const linkedRequirementMap = useMemo(() => buildLookupMap(linkedRequirements), [linkedRequirements])

  const activityItems = useMemo(() => {
    if (!prospect) return []

    const items = [
      {
        id: `prospect-${prospect.id}`,
        label: 'Prospect created',
        detail: `${prospect.name} entered the live prospect pool.`,
        when: prospect.created_at,
        tone: 'bg-blue-100 text-blue-800',
      },
      ...notes.map((note) => ({
        id: `note-${note.id}`,
        label: note.is_transition_note ? 'Transition note' : 'Prospect note',
        detail: note.body,
        when: note.edited_at || note.created_at,
        tone: note.visibility === 'master_only' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800',
      })),
      ...junctions.map((junction) => {
        const requirement = linkedRequirementMap[junction.requirement_id]
        return {
          id: `junction-${junction.id}`,
          label: `Junction ${junction.status}`,
          detail: requirement
            ? `${requirement.req_id_display} · ${formatDisplayValue(requirement.customer_name || 'Customer not set')}`
            : junction.requirement_id,
          when: junction.updated_at,
          tone: 'bg-indigo-100 text-indigo-800',
        }
      }),
      ...applications.map((application) => ({
        id: `application-${application.id}`,
        label: 'Application linked',
        detail: application.reference_number,
        when: application.updated_at || application.created_at,
        tone: 'bg-emerald-100 text-emerald-800',
      })),
    ]

    return items
      .filter((item) => item.when)
      .sort((a, b) => new Date(b.when) - new Date(a.when))
  }, [applications, junctions, linkedRequirementMap, notes, prospect])

  if (!permissions.includes('view_prospects')) {
    return <Navigate to="/unauthorized" replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={Users}
            title="Prospect detail could not load"
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
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={Users}
            title="Prospect not found"
            description="The prospect may have been archived, deleted, or the ID may be incorrect."
            action={
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="workspace-action-button workspace-action-button--primary"
              >
                Back to prospects
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
  const canEditProspect = permissions.includes('edit_prospects')
  const canSendInvite = permissions.includes('send_prospect_invites')

  const handleSendInvite = async () => {
    setInviteLoading(true)
    setInviteStatus('')

    try {
      if (!inviteEmail.trim()) {
        throw new Error('Email is required to send an invite.')
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
            personalMessage: inviteMessage || undefined,
          },
        })

      if (error) throw error

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

  const exportProspectCsv = async () => {
    const rows = [
      {
        id: prospect.id,
        name: prospect.name,
        status: prospect.status,
        email: prospect.email,
        telephone: prospect.telephone,
        lead_source: prospect.lead_source || 'Not provided',
        nationality: nationalityName,
        rank: rankName,
        vessel_type: vesselName,
      },
    ]

    try {
      await logRecruiterExport({
        reportType: 'prospect_snapshot',
        exportFormat: 'csv',
        rowIds: [prospect.id],
        rowCount: 1,
        prospectId: prospect.id,
        filters: { prospect_id: prospect.id },
        sort: { field: 'created_at', direction: 'desc' },
      })
      await downloadCsvReport({
        filename: `prospect-${prospect.name}`,
        columns: [
          { label: 'Name', value: (row) => row.name },
          { label: 'Status', value: (row) => row.status },
          { label: 'Email', value: (row) => row.email },
          { label: 'Phone', value: (row) => row.telephone },
          { label: 'Lead source', value: (row) => row.lead_source },
          { label: 'Nationality', value: (row) => row.nationality },
          { label: 'Rank', value: (row) => row.rank },
          { label: 'Vessel type', value: (row) => row.vessel_type },
        ],
        rows,
      })
    } catch (exportError) {
      console.error('Failed to log prospect CSV export:', exportError)
      window.alert('Unable to export prospect CSV right now.')
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
        title: 'Prospect Snapshot',
        subtitle: prospect.name,
        summaryItems: summaryRows,
        tables: [
          {
            title: 'Linked requirements',
            headers: ['Requirement', 'Customer', 'Status', 'Updated'],
            rows: linkedRequirementsTable,
          },
        ],
        footerNote: 'Generated from the live recruiter prospect detail page.',
      })
    } catch (exportError) {
      console.error('Failed to log prospect PDF export:', exportError)
      window.alert('Unable to export prospect PDF right now.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Prospect Detail"
            title={prospect.name}
            description="Read the current prospect record, linked requirements, notes, and applications in one place."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                {canExportCsv ? (
                  <button
                    type="button"
                    onClick={exportProspectCsv}
                    className="workspace-action-button workspace-action-button--secondary"
                  >
                    Export CSV
                  </button>
                ) : null}
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
                  Back to prospects
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/recruiter/workspace?tab=candidates')}
                  className="workspace-action-button workspace-action-button--primary"
                >
                  Open enrollment workspace
                </button>
              </div>
            }
          >
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
              {prospect.archived_at ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Archived</span> : null}
              {prospect.deleted_at ? <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Deleted</span> : null}
            </div>
          </PageHeader>

          <div className="workspace-kpi-grid">
            <StatCard label="Notes" value={notes.length} icon={FileText} tone="accent" hint="Internal and transition notes on the prospect record." />
            <StatCard label="Linked requirements" value={junctions.length} icon={Layers3} tone="accent" hint="Requirement matches and pipeline junctions." />
            <StatCard label="Applications" value={applications.length} icon={Users} tone="success" hint="Application records linked to this prospect." />
            <StatCard label="Last activity" value={formatRelativeTime(prospect.last_activity_at)} icon={Clock} tone="info" hint="Most recent update on the prospect record." />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Prospect Overview</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Rank applied for</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{formatDisplayValue(rankName)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Vessel type</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{formatDisplayValue(vesselName)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Nationality</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{nationalityName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Experience in rank</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{prospect.exp_in_rank_months} month{prospect.exp_in_rank_months === 1 ? '' : 's'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Phone</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{prospect.telephone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Email</p>
                    <p className="mt-1 text-base font-semibold text-slate-950 break-words">{prospect.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Lead source</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{prospect.lead_source || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">First contacted</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{formatDateTime(prospect.first_contacted_at)}</p>
                  </div>
                </div>
              </div>

              <div className="recruiter-panel overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Linked requirements</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Requirement matches and junction history</h2>
                </div>
                <div className="divide-y">
                  {junctions.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon={Layers3}
                        title="No linked requirements yet"
                        description="This prospect has not been attached to a requirement yet."
                        action={
                          <button
                            type="button"
                            onClick={() => navigate('/recruiter/workspace?tab=candidates')}
                            className="workspace-action-button workspace-action-button--primary"
                          >
                            Open enrollment workspace
                          </button>
                        }
                      />
                    </div>
                  ) : (
                    junctions.map((junction) => {
                      const requirement = linkedRequirementMap[junction.requirement_id]
                      const authorName = authorMap[junction.last_transition_by_recruiter_id]?.full_name || authorMap[junction.assigned_by_recruiter_id]?.full_name || 'Recruiter'

                      return (
                        <div key={junction.id} className="p-6 transition-colors hover:bg-gray-50/70">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {requirement ? requirement.req_id_display : junction.requirement_id}
                                </h3>
                                <StatusPill status={junction.status} metaMap={JUNCTION_STATUS_META} />
                              </div>
                              <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                                <div>
                                  <span className="font-medium text-gray-700">Requirement:</span>{' '}
                                  {requirement ? formatDisplayValue(requirement.customer_name || 'Customer not set') : 'Not loaded'}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Updated:</span> {formatRelativeTime(junction.updated_at)}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Last transition by:</span> {authorName}
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Joined:</span> {formatDateTime(junction.joined_at)}
                                </div>
                              </div>
                            </div>
                            {requirement ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/recruiter/workspace/requirements/${requirement.id}`, { state: { from: `${location.pathname}${location.search}` } })}
                                className="workspace-action-button workspace-action-button--secondary"
                              >
                                Open requirement
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="recruiter-panel overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Notes</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Internal and transition notes</h2>
                </div>
                <div className="divide-y">
                  {notes.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon={FileText}
                        title="No notes yet"
                        description="This prospect does not have any internal notes recorded yet."
                      />
                    </div>
                  ) : (
                    notes.map((note) => {
                      const authorName = authorMap[note.author_recruiter_id]?.full_name || authorMap[note.author_recruiter_id]?.email || 'Recruiter'
                      return (
                        <div key={note.id} className="p-6">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-semibold text-slate-900">{authorName}</p>
                            {note.is_transition_note ? (
                              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">Transition note</span>
                            ) : null}
                            {note.visibility === 'master_only' ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Master only</span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Internal</span>
                            )}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.body}</p>
                          <p className="mt-3 text-xs text-slate-500">
                            {formatDateTime(note.edited_at || note.created_at)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="recruiter-panel p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Invite and bounce recovery</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">Send a new invite or correct the email before resending</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  If the candidate’s address changed or a bounce was recorded, update the email first and then send the invite again.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Invite email</span>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      disabled={!canEditProspect}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Personal message</span>
                    <textarea
                      value={inviteMessage}
                      onChange={(event) => setInviteMessage(event.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
                      placeholder="Optional note to the candidate"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendInvite}
                    disabled={inviteLoading || !canSendInvite || !inviteEmail.trim()}
                    className="workspace-action-button workspace-action-button--primary"
                  >
                    {inviteLoading ? 'Sending...' : 'Send invite'}
                  </button>
                  {prospect.bounce_flag ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      Bounce flag is set
                    </span>
                  ) : null}
                </div>

                {inviteStatus ? (
                  <p className="mt-3 text-sm text-slate-600">{inviteStatus}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Applications</p>
                <div className="mt-4 space-y-3">
                  {applications.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No linked applications"
                      description="This prospect does not have any applications linked yet."
                    />
                  ) : (
                    applications.map((application) =>
                      canViewApplicationTokens && application.public_token ? (
                        <button
                          key={application.id}
                          type="button"
                          onClick={() => navigate(`/application/view/${application.public_token}`)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-teal-300 hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{application.reference_number}</p>
                              <p className="mt-1 text-sm text-slate-600">{formatDateTime(application.created_at)}</p>
                            </div>
                            <StatusBadge status={application.status} />
                          </div>
                        </button>
                      ) : (
                        <div
                          key={application.id}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{application.reference_number}</p>
                              <p className="mt-1 text-sm text-slate-600">{formatDateTime(application.created_at)}</p>
                              <p className="mt-2 text-xs text-slate-500">Application access required to open the live record.</p>
                            </div>
                            <StatusBadge status={application.status} />
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              <div className="recruiter-panel p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Activity feed</p>
                <div className="mt-4 space-y-3">
                  {activityItems.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No activity yet"
                      description="The prospect activity feed will populate as notes, requirements, and applications are added."
                    />
                  ) : (
                    activityItems.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>{item.label}</span>
                          <span className="text-xs text-slate-500">{formatRelativeTime(item.when)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p>
                      </div>
                    ))
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
