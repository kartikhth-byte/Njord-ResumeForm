import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { canUseAiSearch } from '../lib/needle'
import { requirementMatchBlocker } from '../utils/requirementMatch'
import RequirementMatchDialog from '../components/recruiter/RequirementMatchDialog'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import MoreMenu from '../components/ui/MoreMenu'
import RecruitmentCasePanel from '../components/recruiter/RecruitmentCasePanel'
import { isCaseTableMissing } from '../utils/recruitmentCase'
import RequirementForm from '../components/recruiter/RequirementForm'
import {
  archiveRequirement,
  canDeleteRecord,
  deleteRequirement,
  setRequirementStatus,
} from '../services/recruiterRecordService'
import {
  ArrowLeft,
  FileText,
  Layers3,
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { downloadPdfReport, logRecruiterExport } from '../services/recruiterReportExportService'
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
  const backTo = location.state?.from || '/recruiter/requirements'
  const { user, profile, signOut, isOperator } = useAuth()
  const { permissions = [], role = null, loading: permLoading } = usePermissions()
  const canExportPdf = permissions.includes('export_data') || permissions.includes('export_pdf')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requirement, setRequirement] = useState(null)
  const [remarks, setRemarks] = useState([])
  const [junctions, setJunctions] = useState([])
  const [linkedProspects, setLinkedProspects] = useState([])
  const [requirementCases, setRequirementCases] = useState(null)
  const [nationalityRows, setNationalityRows] = useState([])
  const [authorMap, setAuthorMap] = useState({})
  const [editing, setEditing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [acting, setActing] = useState(false)
  const [matching, setMatching] = useState(false)
  const [matchesChanged, setMatchesChanged] = useState(false)
  const matchButton = useRef(null)
  const restoreMatchFocus = useRef(false)
  const [lookupMaps, setLookupMaps] = useState({
    countries: {},
    ranks: {},
    vessel_types: {},
  })

  useEffect(() => {
    if (!loading && restoreMatchFocus.current) { matchButton.current?.focus(); restoreMatchFocus.current = false }
  }, [loading])

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
          casesResult,
        ] = await Promise.all([
          supabase
            .from('requirements')
            .select('company_id, ship_id, location_reviewed_at, id, req_id_display, req_year_month, req_sequence, date_opened, date_closed, vessel_name, status, positions_required, target_days, owner_recruiter_id, customer_name, closure_reason, created_by_recruiter_id, created_at, updated_at, version, rank_id, vessel_type_id, archived_at, archive_reason, deleted_at')
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
          supabase.from('recruitment_cases').select('prospect_id, status').eq('requirement_id', requirementId),
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
        if (casesResult.error && !isCaseTableMissing(casesResult.error)) throw casesResult.error
        const caseRows = casesResult.error ? null : casesResult.data || []

        const prospectIds = [...new Set([...junctionRows, ...caseRows || []].map((row) => row.prospect_id).filter(Boolean))]
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
        setRequirementCases(caseRows)
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
  }, [user, permLoading, requirementId, reloadToken])

  const linkedProspectMap = useMemo(() => buildLookupMap(linkedProspects), [linkedProspects])

  const nationalityPreferences = useMemo(() => {
    if (!requirement) return []
    return nationalityRows
      .map((row) => {
        const countryName = getLookupName(lookupMaps.countries, row.country_id, 'Unknown country')
        return countryName
      })
      .filter(Boolean)
  }, [nationalityRows, lookupMaps.countries, requirement])

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
            title: 'Linked candidates',
            headers: ['Candidate', 'Status', 'Joined', 'Withdrawn'],
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
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            icon={FileText}
            title="Could not load requirement"
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
                Back
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const statusMeta = getStatusMeta(REQUIREMENT_STATUS_META, requirement.status)
  const canEditRequirement = permissions.includes('create_requirements') || permissions.includes('edit_requirements')
  const canArchiveRequirement = permissions.includes('edit_requirements') || permissions.includes('archive_prospects')
  const canDeleteThis = canDeleteRecord({ role, createdAt: requirement.created_at })
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
      setActionError(actionErr?.message || 'The requirement could not be updated.')
    } finally {
      setActing(false)
    }
  }

  // A filled position is a hired case; legacy junctions remain the fallback
  // until the case migration is deployed in this environment.
  const joinedCount = requirementCases === null
    ? junctions.filter((junction) => junction.status === 'joined').length
    : new Set(requirementCases.filter((row) => row.status === 'hired').map((row) => row.prospect_id)).size
  const stillOpen = Math.max((Number(requirement.positions_required) || 0) - joinedCount, 0)
  const onClose = () => {
    if (stillOpen > 0 && !window.confirm(`${stillOpen} of ${requirement.positions_required} position${requirement.positions_required === 1 ? '' : 's'} still open. Close anyway?`)) return
    runAction(() => setRequirementStatus(requirement, 'closed'), 'Requirement closed.')
  }

  const onCancelRequirement = () => {
    const reason = window.prompt(`Why is ${requirement.req_id_display} being cancelled?`)
    if (reason === null) return
    runAction(() => setRequirementStatus(requirement, 'cancelled', reason), 'Requirement cancelled.')
  }

  const onDelete = () => {
    if (!window.confirm(`Delete requirement ${requirement.req_id_display}? This is a restricted action.`)) return
    runAction(() => deleteRequirement(requirement, currentRecruiterId), 'Requirement deleted.', () => navigate('/recruiter/requirements'))
  }

  const rankName = getLookupName(lookupMaps.ranks, requirement.rank_id, 'Unknown rank')
  const vesselTypeName = getLookupName(lookupMaps.vessel_types, requirement.vessel_type_id, 'Unknown vessel')


  return (
    <div className="min-h-screen bg-raised">
      {matching && <RequirementMatchDialog requirement={requirement} onChanged={() => setMatchesChanged(true)} onClose={() => {
        setMatching(false)
        if (matchesChanged) { restoreMatchFocus.current = true; setReloadToken(token => token + 1); setMatchesChanged(false) }
        else matchButton.current?.focus()
      }} />}
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            title={requirement.req_id_display}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                {!requirementMatchBlocker(requirement) && role !== 'Coordinator' && canUseAiSearch({ isOperator, role }) && permissions.includes('create_prospects') && <button ref={matchButton} disabled={acting} className="workspace-action-button workspace-action-button--primary" onClick={() => setMatching(true)}>Match résumés</button>}

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
                  Back
                </button>
                {canEditRequirement && !editing ? (
                  <button type="button" disabled={acting} onClick={() => setEditing(true)} className="workspace-action-button workspace-action-button--primary">
                    Edit
                  </button>
                ) : null}
                {canEditRequirement && requirement.status === 'open' ? (
                  <button type="button" disabled={acting} onClick={onClose} className="workspace-action-button workspace-action-button--secondary">
                    Close
                  </button>
                ) : null}
                <MoreMenu
                  disabled={acting}
                  items={[
                    canEditRequirement && requirement.status === 'open' && { label: 'Cancel requirement', onClick: onCancelRequirement },
                    canArchiveRequirement && !requirement.archived_at && { label: 'Archive', onClick: () => runAction(() => archiveRequirement(requirement, currentRecruiterId), 'Requirement archived.') },
                    canEditRequirement && canDeleteThis && { label: 'Delete', danger: true, onClick: onDelete },
                  ]}
                />
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

          {notice ? <div className="mt-4 rounded-control border border-success-line bg-success-soft px-4 py-3 text-sm text-success">{notice}</div> : null}
          {actionError ? <div className="mt-4 rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{actionError}</div> : null}
          {editing ? (
            <div className="mt-4">
              <RequirementForm
                requirement={requirement}
                ranks={Object.values(lookupMaps.ranks)}
                vesselTypes={Object.values(lookupMaps.vessel_types)}
                currentRecruiterId={currentRecruiterId}
                canSave={canEditRequirement}
                onCancel={() => setEditing(false)}
                onSaved={(message) => { setEditing(false); setNotice(message); setReloadToken((token) => token + 1) }}
              />
            </div>
          ) : null}


          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Customer</p>
                    <p className="mt-1 text-base font-semibold text-fg">{requirement.customer_name || 'Not provided'}</p>
                  </div>
                  {requirement.vessel_name ? (
                    <div>
                      <p className="text-sm font-medium text-fg-muted">Vessel</p>
                      <p className="mt-1 text-base font-semibold text-fg">{requirement.vessel_name}</p>
                    </div>
                  ) : null}
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
                    <p className="mt-1 text-base font-semibold text-fg">{requirement.status==='draft'?'Not opened':formatDate(requirement.date_opened)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg-muted">Target days</p>
                    <p className="mt-1 text-base font-semibold text-fg">{requirement.target_days}</p>
                  </div>
                  {requirement.closure_reason && requirement.status !== 'open' ? (
                    <div>
                      <p className="text-sm font-medium text-fg-muted">Closure reason</p>
                      <p className="mt-1 text-base font-semibold text-fg">{requirement.closure_reason}</p>
                    </div>
                  ) : null}
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

              <RecruitmentCasePanel
                requirementId={requirement.id}
                requirementOpen={requirement.status === 'open' && Boolean(requirement.location_reviewed_at) && !requirement.archived_at && !requirement.deleted_at}
                linkedProspects={linkedProspects}
                permissions={permissions}
                onCaseChanged={() => setReloadToken((token) => token + 1)}
              />

              {requirementCases === null ? <div className="recruiter-panel overflow-hidden">
                <div className="border-b border-line px-6 py-4">
                  <h2 className="mt-1 text-lg font-semibold text-fg">Linked candidates</h2>
                </div>
                <div className="divide-y">
                  {junctions.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon={Layers3}
                        title="No linked candidates"
                        action={
                          <button
                            type="button"
                            onClick={() => navigate('/recruiter/candidates')}
                            className="workspace-action-button workspace-action-button--primary"
                          >
                            Open candidates
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
                                  {prospect ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/recruiter/workspace/prospects/${prospect.id}`, { state: { from: `${location.pathname}${location.search}` } })}
                                      className="text-left hover:text-accent-text hover:underline"
                                    >
                                      {prospect.name}
                                    </button>
                                  ) : junction.prospect_id}
                                </h3>
                                <StatusPill status={junction.status} metaMap={JUNCTION_STATUS_META} />
                              </div>
                              <div className="grid gap-2 text-sm text-fg-secondary md:grid-cols-2">
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
                                {junction.withdrawn_at ? (
                                  <div>
                                    <span className="font-medium text-fg-secondary">Withdrawn:</span> {formatDateTime(junction.withdrawn_at)}
                                  </div>
                                ) : null}
                              </div>
                              {junction.withdrawal_reason ? (
                                <p className="text-sm leading-6 text-fg-secondary">
                                  <span className="font-medium text-fg">Withdrawal reason:</span> {junction.withdrawal_reason}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div> : null}
            </div>

            <div className="space-y-6">
              <div className="recruiter-panel p-6">
                <p className="text-sm font-medium text-fg">Remarks</p>
                <div className="mt-4 space-y-3">
                  {remarks.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No remarks yet"
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
                            ) : null}
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

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
