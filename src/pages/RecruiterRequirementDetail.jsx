import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
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
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getLookupName,
  getStatusMeta,
  JUNCTION_STATUS_META,
  REQUIREMENT_STATUS_META,
} from './recruiterDashboardUtils'

function StatusPill({ status, metaMap }) {
  const meta = getStatusMeta(metaMap, status)
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function RecruiterRequirementDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { requirementId } = useParams()
  // Return to wherever this page was opened from (tracker, KPI, workspace…).
  const backTo = location.state?.from || '/recruiter/workspace?tab=requirements'
  const { user, profile, signOut } = useAuth()
  const { permissions = [], role = null, loading: permLoading } = usePermissions()
  const canExportCsv = permissions.includes('export_data') || permissions.includes('export_csv')
  const canExportPdf = permissions.includes('export_data') || permissions.includes('export_pdf')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requirement, setRequirement] = useState(null)
  const [remarks, setRemarks] = useState([])
  const [junctions, setJunctions] = useState([])
  const [linkedProspects, setLinkedProspects] = useState([])
  const [nationalityRows, setNationalityRows] = useState([])
  const [authorMap, setAuthorMap] = useState({})
  const [lookupMaps, setLookupMaps] = useState({
    countries: {},
    ranks: {},
    vessel_types: {},
  })

  useEffect(() => {
    let cancelled = false

    const loadDetail = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          requirementResult,
          remarksResult,
          junctionsResult,
          nationalityResult,
          countriesResult,
          ranksResult,
          vesselTypesResult,
        ] = await Promise.all([
          supabase
            .from('requirements')
            .select('id, req_id_display, req_year_month, req_sequence, date_opened, date_closed, vessel_name, status, positions_required, target_days, owner_recruiter_id, customer_name, closure_reason, created_by_recruiter_id, created_at, updated_at, version, rank_id, vessel_type_id')
            .eq('id', requirementId)
            .maybeSingle(),
          supabase
            .from('requirement_remarks')
            .select('id, requirement_id, body, author_recruiter_id, created_at, edited_at, edit_locked_at, is_transition_note, visibility')
            .eq('requirement_id', requirementId)
            .order('created_at', { ascending: false }),
          supabase
            .from('prospect_requirements')
            .select('id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at, version')
            .eq('requirement_id', requirementId)
            .order('updated_at', { ascending: false }),
          supabase
            .from('requirement_nationalities')
            .select('requirement_id, country_id')
            .eq('requirement_id', requirementId),
          supabase.from('countries').select('id, code, name').order('name'),
          supabase.from('ranks').select('id, code, name').order('name'),
          supabase.from('vessel_types').select('id, code, name').order('name'),
        ])

        if (cancelled) return

        if (requirementResult.error) throw requirementResult.error
        if (!requirementResult.data) {
          setRequirement(null)
          setLoading(false)
          return
        }

        const requirementRow = requirementResult.data
        const remarkRows = remarksResult.error ? [] : remarksResult.data || []
        const junctionRows = junctionsResult.error ? [] : junctionsResult.data || []
        const nationalityPreferenceRows = nationalityResult?.error ? [] : nationalityResult?.data || []

        const prospectIds = [...new Set(junctionRows.map((row) => row.prospect_id).filter(Boolean))]
        let prospectRows = []
        if (prospectIds.length > 0) {
          const { data: fetchedProspects, error: prospectError } = await supabase
            .from('prospects')
            .select('id, name, status, telephone, email, lead_source, rank_applied_for_id, nationality_id, vessel_type_id, last_activity_at, created_at, updated_at')
            .in('id', prospectIds)
          if (prospectError) throw prospectError
          prospectRows = fetchedProspects || []
        }

        const authorIds = [...new Set([
          ...remarkRows.map((row) => row.author_recruiter_id),
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

        setRequirement(requirementRow)
        setRemarks(remarkRows)
        setJunctions(junctionRows)
        setLinkedProspects(prospectRows)
        setNationalityRows(nationalityPreferenceRows)
        setAuthorMap(buildLookupMap(authors))
        setLookupMaps({
          countries: buildLookupMap(countriesResult.error ? [] : countriesResult.data || []),
          ranks: buildLookupMap(ranksResult.error ? [] : ranksResult.data || []),
          vessel_types: buildLookupMap(vesselTypesResult.error ? [] : vesselTypesResult.data || []),
        })
      } catch (loadError) {
        if (cancelled) return
        console.error('Error loading requirement detail:', loadError)
        setError(loadError?.message || 'Failed to load requirement detail')
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
  }, [user, permLoading, requirementId])

  const linkedProspectMap = useMemo(() => buildLookupMap(linkedProspects), [linkedProspects])

  const activityItems = useMemo(() => {
    if (!requirement) return []

    const items = [
      {
        id: `requirement-${requirement.id}`,
        label: 'Requirement created',
        detail: `${requirement.req_id_display} entered the live requirement pool.`,
        when: requirement.created_at,
        tone: 'bg-success-soft text-success',
      },
      ...remarks.map((remark) => ({
        id: `remark-${remark.id}`,
        label: remark.is_transition_note ? 'Transition note' : 'Requirement remark',
        detail: remark.body,
        when: remark.edited_at || remark.created_at,
        tone: remark.visibility === 'master_only' ? 'bg-warning-soft text-warning' : 'bg-raised text-fg',
      })),
      ...junctions.map((junction) => {
        const prospect = linkedProspectMap[junction.prospect_id]
        return {
          id: `junction-${junction.id}`,
          label: `Junction ${junction.status}`,
          detail: prospect ? prospect.name : junction.prospect_id,
          when: junction.updated_at,
          tone: 'bg-accent-soft text-accent-text',
        }
      }),
    ]

    return items
      .filter((item) => item.when)
      .sort((a, b) => new Date(b.when) - new Date(a.when))
  }, [junctions, linkedProspectMap, remarks, requirement])

  const nationalityPreferences = useMemo(() => {
    if (!requirement) return []
    return nationalityRows
      .map((row) => {
        const countryName = getLookupName(lookupMaps.countries, row.country_id, 'Unknown country')
        return countryName
      })
      .filter(Boolean)
  }, [nationalityRows, lookupMaps.countries, requirement])

  const exportRequirementCsv = async () => {
    const rows = [
      {
        id: requirement.id,
        req_id_display: requirement.req_id_display,
        customer_name: requirement.customer_name || 'Not provided',
        status: requirement.status,
        rank: rankName,
        vessel_type: vesselTypeName,
        positions_required: requirement.positions_required,
        target_days: requirement.target_days,
        closure_reason: requirement.closure_reason || 'Not set',
      },
    ]

    try {
      await logRecruiterExport({
        reportType: 'requirement_snapshot',
        exportFormat: 'csv',
        rowIds: [requirement.id],
        rowCount: 1,
        requirementId: requirement.id,
        filters: { requirement_id: requirement.id },
        sort: { field: 'updated_at', direction: 'desc' },
      })
      await downloadCsvReport({
        filename: `requirement-${requirement.req_id_display}`,
        columns: [
          { label: 'Requirement', value: (row) => row.req_id_display },
          { label: 'Customer', value: (row) => row.customer_name },
          { label: 'Status', value: (row) => row.status },
          { label: 'Rank', value: (row) => row.rank },
          { label: 'Vessel type', value: (row) => row.vessel_type },
          { label: 'Positions', value: (row) => row.positions_required },
          { label: 'Target days', value: (row) => row.target_days },
          { label: 'Closure reason', value: (row) => row.closure_reason },
        ],
        rows,
      })
    } catch (exportError) {
      console.error('Failed to log requirement CSV export:', exportError)
      window.alert('Unable to export requirement CSV right now.')
    }
  }

  const exportRequirementPdf = async () => {
    try {
      await logRecruiterExport({
        reportType: 'requirement_snapshot',
        exportFormat: 'pdf',
        rowIds: [requirement.id],
        rowCount: 1,
        requirementId: requirement.id,
        filters: { requirement_id: requirement.id },
        sort: { field: 'updated_at', direction: 'desc' },
      })
      await downloadPdfReport({
        filename: `requirement-${requirement.req_id_display}`,
        title: 'Requirement Snapshot',
        subtitle: requirement.req_id_display,
        summaryItems: [
          { label: 'Customer', value: requirement.customer_name || 'Not provided' },
          { label: 'Status', value: requirement.status },
          { label: 'Rank', value: rankName },
          { label: 'Vessel type', value: vesselTypeName },
          { label: 'Positions required', value: requirement.positions_required },
          { label: 'Target days', value: requirement.target_days },
        ],
        tables: [
          {
            title: 'Nationality preferences',
            headers: ['Country'],
            rows: nationalityPreferences.length > 0 ? nationalityPreferences.map((country) => [country]) : [['None recorded']],
          },
          {
            title: 'Linked prospects',
            headers: ['Prospect', 'Status', 'Joined', 'Withdrawn'],
            rows: junctions.slice(0, 20).map((junction) => {
              const prospect = linkedProspectMap[junction.prospect_id]
              return [
                prospect ? prospect.name : junction.prospect_id,
                junction.status,
                formatDateTime(junction.joined_at),
                formatDateTime(junction.withdrawn_at),
              ]
            }),
          },
        ],
        footerNote: 'Generated from the live recruiter requirement detail page.',
      })
    } catch (exportError) {
      console.error('Failed to log requirement PDF export:', exportError)
      window.alert('Unable to export requirement PDF right now.')
    }
  }

  if (!permissions.includes('view_requirements')) {
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
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={FileText}
            title="Requirement detail could not load"
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

  if (!requirement) {
    return (
      <div className="min-h-screen bg-raised">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={FileText}
            title="Requirement not found"
            action={
              <button
                type="button"
                onClick={() => navigate(backTo)}
                className="workspace-action-button workspace-action-button--primary"
              >
                Back to requirements
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const statusMeta = getStatusMeta(REQUIREMENT_STATUS_META, requirement.status)
  const rankName = getLookupName(lookupMaps.ranks, requirement.rank_id, 'Unknown rank')
  const vesselTypeName = getLookupName(lookupMaps.vessel_types, requirement.vessel_type_id, 'Unknown vessel')

  const statusCounts = {
    shortlisted: junctions.filter((junction) => junction.status === 'shortlisted').length,
    submitted_to_customer: junctions.filter((junction) => junction.status === 'submitted_to_customer').length,
    customer_reviewing: junctions.filter((junction) => junction.status === 'customer_reviewing').length,
    customer_accepted: junctions.filter((junction) => junction.status === 'customer_accepted').length,
    customer_rejected: junctions.filter((junction) => junction.status === 'customer_rejected').length,
    joined: junctions.filter((junction) => junction.status === 'joined').length,
    withdrawn: junctions.filter((junction) => junction.status === 'withdrawn').length,
  }

  return (
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            title={requirement.req_id_display}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                {canExportCsv ? (
                  <button
                    type="button"
                    onClick={exportRequirementCsv}
                    className="workspace-action-button workspace-action-button--secondary"
                  >
                    Export CSV
                  </button>
                ) : null}
                {canExportPdf ? (
                  <button
                    type="button"
                    onClick={exportRequirementPdf}
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
                  Back to requirements
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
              <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold text-fg-secondary">
                {requirement.positions_required} position{requirement.positions_required === 1 ? '' : 's'}
              </span>
            </div>
          </PageHeader>

          <div className="workspace-kpi-grid">
            <StatCard label="Linked prospects" value={junctions.length} icon={Users} tone="accent" />
            <StatCard label="Shortlisted" value={statusCounts.shortlisted} icon={Layers3} tone="accent" />
            <StatCard label="Submitted" value={statusCounts.submitted_to_customer} icon={ArrowRight} tone="accent" />
            <StatCard label="Joined" value={statusCounts.joined} icon={ListChecks} tone="success" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Customer</p>
                    <p className="mt-1 text-base font-semibold text-fg">{requirement.customer_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Rank</p>
                    <p className="mt-1 text-base font-semibold text-fg">{formatDisplayValue(rankName)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Vessel type</p>
                    <p className="mt-1 text-base font-semibold text-fg">{formatDisplayValue(vesselTypeName)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Open date</p>
                    <p className="mt-1 text-base font-semibold text-fg">{formatDate(requirement.date_opened)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Target days</p>
                    <p className="mt-1 text-base font-semibold text-fg">{requirement.target_days}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Closure reason</p>
                    <p className="mt-1 text-base font-semibold text-fg">{requirement.closure_reason || 'Not set'}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-fg-muted">Nationality preferences</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nationalityPreferences.length > 0 ? (
                      nationalityPreferences.map((countryName) => (
                        <span
                          key={countryName}
                          className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text"
                        >
                          {countryName}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-fg-muted">No nationality preferences recorded</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="recruiter-panel overflow-hidden">
                <div className="border-b border-line px-6 py-4">
                  <h2 className="mt-1 text-lg font-semibold text-fg">Prospects attached to this requirement</h2>
                </div>
                <div className="divide-y">
                  {junctions.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon={Layers3}
                        title="No linked prospects yet"
                        description="This requirement does not have any shortlist or submission records yet."
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
                      const prospect = linkedProspectMap[junction.prospect_id]
                      const authorName = authorMap[junction.last_transition_by_recruiter_id]?.full_name || authorMap[junction.assigned_by_recruiter_id]?.full_name || 'Recruiter'

                      return (
                        <div key={junction.id} className="p-6 transition-colors hover:bg-raised/70">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-lg font-semibold text-fg">
                                  {prospect ? prospect.name : junction.prospect_id}
                                </h3>
                                <StatusPill status={junction.status} metaMap={JUNCTION_STATUS_META} />
                              </div>
                              <div className="grid gap-2 text-sm text-fg-secondary md:grid-cols-2">
                                <div>
                                  <span className="font-medium text-fg-secondary">Updated:</span> {formatRelativeTime(junction.updated_at)}
                                </div>
                                <div>
                                  <span className="font-medium text-fg-secondary">Last transition by:</span> {authorName}
                                </div>
                                <div>
                                  <span className="font-medium text-fg-secondary">Joined:</span> {formatDateTime(junction.joined_at)}
                                </div>
                                <div>
                                  <span className="font-medium text-fg-secondary">Withdrawn:</span> {formatDateTime(junction.withdrawn_at)}
                                </div>
                              </div>
                              {junction.withdrawal_reason ? (
                                <p className="text-sm leading-6 text-fg-secondary">
                                  <span className="font-medium text-fg">Withdrawal reason:</span> {junction.withdrawal_reason}
                                </p>
                              ) : null}
                            </div>

                            {prospect ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/recruiter/workspace/prospects/${prospect.id}`, { state: { from: `${location.pathname}${location.search}` } })}
                                className="workspace-action-button workspace-action-button--secondary"
                              >
                                Open prospect
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
            </div>

            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <p className="text-sm font-medium text-fg">Remarks</p>
                <div className="mt-4 space-y-3">
                  {remarks.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No remarks yet"
                      description="This requirement does not have any internal remarks recorded yet."
                    />
                  ) : (
                    remarks.map((remark) => {
                      const authorName = authorMap[remark.author_recruiter_id]?.full_name || authorMap[remark.author_recruiter_id]?.email || 'Recruiter'
                      return (
                        <div key={remark.id} className="rounded-control border border-line bg-raised px-4 py-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm font-semibold text-fg">{authorName}</p>
                            {remark.is_transition_note ? (
                              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-text">Transition note</span>
                            ) : null}
                            {remark.visibility === 'master_only' ? (
                              <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">Master only</span>
                            ) : (
                              <span className="rounded-full bg-raised px-3 py-1 text-xs font-semibold text-fg-secondary">Internal</span>
                            )}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-fg-secondary">{remark.body}</p>
                          <p className="mt-3 text-xs text-fg-muted">
                            {formatDateTime(remark.edited_at || remark.created_at)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="recruiter-panel p-6">
                <p className="text-sm font-medium text-fg">Activity feed</p>
                <div className="mt-4 space-y-3">
                  {activityItems.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="No activity yet"
                    />
                  ) : (
                    activityItems.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-control border border-line bg-raised px-4 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>{item.label}</span>
                          <span className="text-xs text-fg-muted">{formatRelativeTime(item.when)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-fg-secondary">{item.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="recruiter-panel p-6">
                <h3 className="mt-2 text-lg font-semibold text-fg">Keep the requirement flowing</h3>
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate('/recruiter/workspace?tab=candidates')}
                    className="workspace-action-button workspace-action-button--primary w-full justify-center"
                  >
                    Open candidates
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/recruiter/applications')}
                    className="workspace-action-button workspace-action-button--secondary w-full justify-center"
                  >
                    Review pipeline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
