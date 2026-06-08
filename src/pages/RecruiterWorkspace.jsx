import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import SegmentedControl from '../components/ui/SegmentedControl'
import {
  ArrowRight,
  Archive,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  UserPlus,
} from 'lucide-react'
import { downloadCsvReport, logRecruiterExport } from '../services/recruiterReportExportService'
import { buildLookupMap, formatDate, formatRelativeTime, getStatusMeta, JUNCTION_STATUS_META } from './recruiterDashboardUtils'

const WORKSPACE_TABS = [
  { value: 'requirements', label: 'Requirements', icon: ClipboardList },
  { value: 'candidates', label: 'Candidates', icon: Users },
  { value: 'pipeline', label: 'Candidate Pipeline', icon: ArrowRight },
]

const REQUIREMENT_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const CANDIDATE_FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'active', label: 'Active' },
  { value: 'unattached', label: 'Unattached' },
  { value: 'in_pipeline', label: 'In Pipeline' },
  { value: 'joined', label: 'Joined' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const PIPELINE_STATUS_OPTIONS = Object.keys(JUNCTION_STATUS_META).map((status) => ({
  value: status,
  label: getStatusMeta(JUNCTION_STATUS_META, status).label,
}))

function formatStatusClass(status) {
  return getStatusMeta(JUNCTION_STATUS_META, status).className
}

function TextField({ label, value, onChange, placeholder = '', type = 'text', required = false }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-gray-700">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select an option', required = false }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-gray-700">
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextAreaField({ label, value, onChange, placeholder = '', rows = 4 }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-gray-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  )
}

function ToggleField({ label, checked, onChange, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span>
        <span className="block font-medium text-gray-800">{label}</span>
        {description ? <span className="block text-xs text-gray-500">{description}</span> : null}
      </span>
    </label>
  )
}

function Panel({ title, description, icon: PanelIcon, children, className = '' }) {
  void PanelIcon
  return (
    <section className={`recruiter-panel p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <PanelIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function sameDay(a, b) {
  if (!a || !b) return false
  const left = new Date(a)
  const right = new Date(b)
  return left.toDateString() === right.toDateString()
}

export default function RecruiterWorkspace() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { hasPermission, role, loading: permLoading } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    WORKSPACE_TABS.some((tab) => tab.value === initialTab) ? initialTab : 'requirements'
  )

  const [countries, setCountries] = useState([])
  const [ranks, setRanks] = useState([])
  const [vesselTypes, setVesselTypes] = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [requirements, setRequirements] = useState([])
  const [prospects, setProspects] = useState([])
  const [junctions, setJunctions] = useState([])
  const [applications, setApplications] = useState([])

  const [requirementFilter, setRequirementFilter] = useState('open')
  const [candidateFilter, setCandidateFilter] = useState('open')

  const [requirementForm, setRequirementForm] = useState({
    id: '',
    dateOpened: new Date().toISOString().slice(0, 10),
    vesselName: '',
    vesselTypeId: '',
    rankId: '',
    positionsRequired: '1',
    targetDays: '30',
    status: 'open',
    customerName: '',
    loggedByRecruiterId: '',
    notes: '',
  })

  const [candidateForm, setCandidateForm] = useState({
    name: '',
    dob: '',
    dateContacted: new Date().toISOString().slice(0, 10),
    addedByRecruiterId: '',
    rankId: '',
    vesselTypeId: '',
    nationalityId: '',
    expInRankMonths: '',
    previousEmployer: '',
    isFirstTimeAtSea: false,
    telephone: '',
    email: '',
    leadSource: '',
    requirementId: '',
    notes: '',
  })

  const [attachForm, setAttachForm] = useState({
    prospectId: '',
    requirementId: '',
  })

  const [pipelineForm, setPipelineForm] = useState({
    prospectRequirementId: '',
    newStatus: 'submitted_to_customer',
    expectedVersion: '',
    withdrawalReason: '',
    noteBody: '',
    noteVisibility: 'internal',
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    const nextTab = WORKSPACE_TABS.some((item) => item.value === tab) ? tab : 'requirements'
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [activeTab, searchParams])

  const changeWorkspaceTab = (tab) => {
    setActiveTab(tab)
    if (tab === 'requirements') {
      setSearchParams({})
    } else {
      setSearchParams({ tab })
    }
  }

  const currentRecruiterId = profile?.id || user?.id || ''
  const recruiterOptions = useMemo(() => {
    return recruiters.map((item) => ({
      value: item.id,
      label: `${item.full_name || item.email || item.id}${item.role_name ? ` · ${item.role_name}` : ''}`,
    }))
  }, [recruiters])

  const rankOptions = useMemo(() => ranks.map((rank) => ({ value: rank.id, label: rank.name })), [ranks])
  const vesselTypeOptions = useMemo(() => vesselTypes.map((vesselType) => ({ value: vesselType.id, label: vesselType.name })), [vesselTypes])
  const countryOptions = useMemo(() => countries.map((country) => ({ value: country.id, label: country.name })), [countries])

  const requirementById = useMemo(() => buildLookupMap(requirements), [requirements])
  const prospectById = useMemo(() => buildLookupMap(prospects), [prospects])
  const applicationByProspectId = useMemo(() => {
    return applications.reduce((acc, application) => {
      if (application?.prospect_id) acc[application.prospect_id] = application
      return acc
    }, {})
  }, [applications])

  const joinedCountByRequirementId = useMemo(() => {
    return junctions.reduce((acc, junction) => {
      if (junction.status === 'joined') {
        acc[junction.requirement_id] = (acc[junction.requirement_id] || 0) + 1
      }
      return acc
    }, {})
  }, [junctions])

  const junctionsByProspectId = useMemo(() => {
    return junctions.reduce((acc, junction) => {
      if (!acc[junction.prospect_id]) acc[junction.prospect_id] = []
      acc[junction.prospect_id].push(junction)
      return acc
    }, {})
  }, [junctions])

  const pipelineRows = useMemo(() => {
    return junctions.map((junction) => {
      const prospect = prospectById[junction.prospect_id]
      const requirement = requirementById[junction.requirement_id]
      const application = applicationByProspectId[junction.prospect_id]
      const applicationStatus = application?.submitted_at
        ? 'Completed'
        : prospect?.invited_at
          ? 'Link Sent'
          : 'Not Sent'

      let nextAction = 'Review the current stage'
      if (applicationStatus !== 'Completed') {
        nextAction = 'Send application link'
      } else if (junction.status === 'shortlisted') {
        nextAction = 'Submit to customer'
      } else if (junction.status === 'submitted_to_customer') {
        nextAction = 'Await customer review'
      } else if (junction.status === 'customer_accepted') {
        nextAction = 'Mark joined when ready'
      } else if (junction.status === 'customer_rejected') {
        nextAction = 'Review rejection and decide'
      } else if (junction.status === 'joined') {
        nextAction = 'Close the requirement row'
      } else if (junction.status === 'withdrawn') {
        nextAction = 'No further action'
      }

      return {
        ...junction,
        prospect,
        requirement,
        applicationStatus,
        nextAction,
        previousStage: '—',
        lastActionBy:
          recruiters.find((member) => member.id === junction.last_transition_by_recruiter_id)?.full_name ||
          recruiters.find((member) => member.id === junction.assigned_by_recruiter_id)?.full_name ||
          'Recruiter',
      }
    })
  }, [applicationByProspectId, junctions, prospectById, recruiters, requirementById])

  const requirementRows = useMemo(() => {
    return requirements.map((requirement) => {
      const joinedCount = joinedCountByRequirementId[requirement.id] || 0
      const openPositions = requirement.status === 'closed' || requirement.status === 'cancelled' || requirement.archived_at || requirement.deleted_at
        ? 0
        : Math.max((Number(requirement.positions_required) || 0) - joinedCount, 0)
      return {
        ...requirement,
        joinedCount,
        openPositions,
      }
    })
  }, [joinedCountByRequirementId, requirements])

  const candidateRows = useMemo(() => {
    return prospects.map((prospect) => {
      const attachedJunctions = junctionsByProspectId[prospect.id] || []
      const application = applicationByProspectId[prospect.id]
      const hasArchivedState = Boolean(prospect.archived_at || prospect.deleted_at)
      const hasJoined = attachedJunctions.some((junction) => junction.status === 'joined')
      const inPipeline = attachedJunctions.some((junction) => !['joined', 'withdrawn'].includes(junction.status))
      const applicationStatus = application?.submitted_at
        ? 'Completed'
        : prospect.invited_at
          ? 'Link Sent'
          : prospect.claimed_at
            ? 'Pending'
            : 'Not Sent'

      return {
        ...prospect,
        attachedJunctions,
        applicationStatus,
        hasArchivedState,
        hasJoined,
        inPipeline,
        isUnattached: attachedJunctions.length === 0,
      }
    })
  }, [applicationByProspectId, junctionsByProspectId, prospects])

  const visibleRequirementRows = useMemo(() => {
    return requirementRows.filter((requirement) => {
      const isArchived = Boolean(requirement.archived_at || requirement.deleted_at)
      if (requirementFilter === 'open') return requirement.status === 'open' && !isArchived
      if (requirementFilter === 'active') return requirement.status !== 'closed' && requirement.status !== 'cancelled' && !isArchived
      if (requirementFilter === 'closed') return requirement.status === 'closed' && !requirement.deleted_at
      if (requirementFilter === 'archived') return isArchived
      return true
    })
  }, [requirementFilter, requirementRows])

  const visibleCandidateRows = useMemo(() => {
    return candidateRows.filter((candidate) => {
      if (candidateFilter === 'open') {
        return !candidate.hasArchivedState && !candidate.hasJoined && candidate.status !== 'rejected'
      }
      if (candidateFilter === 'active') {
        return !candidate.hasArchivedState
      }
      if (candidateFilter === 'unattached') {
        return !candidate.hasArchivedState && candidate.isUnattached
      }
      if (candidateFilter === 'in_pipeline') {
        return !candidate.hasArchivedState && candidate.inPipeline
      }
      if (candidateFilter === 'joined') {
        return !candidate.hasArchivedState && candidate.hasJoined
      }
      if (candidateFilter === 'archived') {
        return candidate.hasArchivedState
      }
      return true
    })
  }, [candidateFilter, candidateRows])

  const canChooseRecruiter = role === 'Master Recruiter' || hasPermission('manage_runtime_settings') || hasPermission('manage_settings')
  const canCreateRequirements = hasPermission('create_requirements') || hasPermission('edit_requirements')
  const canCreateCandidates = hasPermission('create_prospects')
  const canAttachCandidates = hasPermission('edit_junction_status')
  const canArchiveRequirements = hasPermission('edit_requirements') || hasPermission('archive_prospects')
  const canDeleteRequirements = role === 'Master Recruiter'
  const canManageCandidates = hasPermission('archive_prospects') || hasPermission('delete_prospects') || hasPermission('edit_prospects')
  const canTransitionPipeline = hasPermission('edit_junction_status') || hasPermission('withdraw_junctions')

  useEffect(() => {
    if (!requirementForm.loggedByRecruiterId && currentRecruiterId) {
      setRequirementForm((current) => ({ ...current, loggedByRecruiterId: currentRecruiterId }))
    }
    if (!candidateForm.addedByRecruiterId && currentRecruiterId) {
      setCandidateForm((current) => ({ ...current, addedByRecruiterId: currentRecruiterId }))
    }
  }, [currentRecruiterId, requirementForm.loggedByRecruiterId, candidateForm.addedByRecruiterId])

  useEffect(() => {
    let cancelled = false

    const loadWorkspace = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          countriesResult,
          ranksResult,
          vesselTypesResult,
          profilesResult,
          requirementsResult,
          prospectsResult,
          junctionsResult,
          applicationsResult,
        ] = await Promise.all([
          supabase.from('countries').select('id, code, name').order('name'),
          supabase.from('ranks').select('id, code, name').order('name'),
          supabase.from('vessel_types').select('id, code, name').order('name'),
          supabase.from('profiles').select('id, full_name, email, role_name, user_type').eq('user_type', 'recruiter').order('full_name'),
          supabase
            .from('requirements')
            .select('id, req_id_display, date_opened, date_closed, vessel_name, vessel_type_id, rank_id, positions_required, target_days, customer_name, status, owner_recruiter_id, created_by_recruiter_id, archived_at, archived_by_recruiter_id, archive_reason, deleted_at, deleted_by_recruiter_id, delete_reason, version, created_at, updated_at')
            .order('updated_at', { ascending: false }),
          supabase
            .from('prospects')
            .select('id, name, dob, nationality_id, rank_applied_for_id, vessel_type_id, exp_in_rank_months, previous_employer, is_first_time_at_sea, telephone, email, lead_source, status, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, archive_reason, deleted_at, deleted_by_recruiter_id, invited_at, claimed_at, applicant_user_id, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at, version')
            .order('last_activity_at', { ascending: false }),
          supabase
            .from('prospect_requirements')
            .select('id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at, version')
            .order('updated_at', { ascending: false }),
          supabase
            .from('applications')
            .select('id, prospect_id, status, submitted_at, created_at, updated_at, reference_number')
            .order('updated_at', { ascending: false }),
        ])

        if (cancelled) return

        const rowsOrThrow = (result) => {
          if (result.error) throw result.error
          return result.data || []
        }

        setCountries(rowsOrThrow(countriesResult))
        setRanks(rowsOrThrow(ranksResult))
        setVesselTypes(rowsOrThrow(vesselTypesResult))
        setRecruiters(rowsOrThrow(profilesResult))
        setRequirements(rowsOrThrow(requirementsResult))
        setProspects(rowsOrThrow(prospectsResult))
        setJunctions(rowsOrThrow(junctionsResult))
        setApplications(rowsOrThrow(applicationsResult))
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load recruiter workspace:', loadError)
        setError(loadError?.message || 'Failed to load recruiter workspace')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (!permLoading) {
      loadWorkspace()
    }

    return () => {
      cancelled = true
    }
  }, [permLoading, user?.id])

  useEffect(() => {
    if (!attachForm.requirementId && visibleRequirementRows[0]) {
      setAttachForm((current) => ({ ...current, requirementId: visibleRequirementRows[0].id }))
    }
    if (!attachForm.prospectId && visibleCandidateRows[0]) {
      setAttachForm((current) => ({ ...current, prospectId: visibleCandidateRows[0].id }))
    }
    if (!pipelineForm.prospectRequirementId && pipelineRows[0]) {
      setPipelineForm((current) => ({
        ...current,
        prospectRequirementId: pipelineRows[0].id,
        expectedVersion: String(pipelineRows[0].version || ''),
      }))
    }
  }, [attachForm.prospectId, attachForm.requirementId, pipelineForm.prospectRequirementId, pipelineRows, visibleCandidateRows, visibleRequirementRows])

  const reloadWorkspace = async () => {
    setRefreshing(true)
    setSuccess('')
    setError('')
    try {
      const [{ data: countriesData }, { data: ranksData }, { data: vesselsData }, { data: profilesData }, { data: requirementsData }, { data: prospectsData }, { data: junctionsData }, { data: applicationsData }] = await Promise.all([
        supabase.from('countries').select('id, code, name').order('name'),
        supabase.from('ranks').select('id, code, name').order('name'),
        supabase.from('vessel_types').select('id, code, name').order('name'),
        supabase.from('profiles').select('id, full_name, email, role_name, user_type').eq('user_type', 'recruiter').order('full_name'),
        supabase
          .from('requirements')
          .select('id, req_id_display, date_opened, date_closed, vessel_name, vessel_type_id, rank_id, positions_required, target_days, customer_name, status, owner_recruiter_id, created_by_recruiter_id, archived_at, archived_by_recruiter_id, archive_reason, deleted_at, deleted_by_recruiter_id, delete_reason, version, created_at, updated_at')
          .order('updated_at', { ascending: false }),
        supabase
          .from('prospects')
          .select('id, name, dob, nationality_id, rank_applied_for_id, vessel_type_id, exp_in_rank_months, previous_employer, is_first_time_at_sea, telephone, email, lead_source, status, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, archive_reason, deleted_at, deleted_by_recruiter_id, invited_at, claimed_at, applicant_user_id, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at, version')
          .order('last_activity_at', { ascending: false }),
        supabase
          .from('prospect_requirements')
          .select('id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at, version')
          .order('updated_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, prospect_id, status, submitted_at, created_at, updated_at, reference_number')
          .order('updated_at', { ascending: false }),
      ])

      setCountries(countriesData || [])
      setRanks(ranksData || [])
      setVesselTypes(vesselsData || [])
      setRecruiters(profilesData || [])
      setRequirements(requirementsData || [])
      setProspects(prospectsData || [])
      setJunctions(junctionsData || [])
      setApplications(applicationsData || [])
    } catch (refreshError) {
      console.error('Failed to refresh workspace:', refreshError)
      setError(refreshError?.message || 'Failed to refresh workspace')
    } finally {
      setRefreshing(false)
    }
  }

  const handleActionError = (actionError, fallback) => {
    console.error(fallback, actionError)
    setError(actionError?.message || fallback)
  }

  const requirementStat = useMemo(() => {
    const open = requirementRows.filter((row) => row.status === 'open' && !row.archived_at && !row.deleted_at).length
    const closed = requirementRows.filter((row) => row.status === 'closed' && !row.deleted_at).length
    const archived = requirementRows.filter((row) => row.archived_at || row.deleted_at).length
    const openPositions = requirementRows.reduce((sum, row) => sum + row.openPositions, 0)
    return { open, closed, archived, openPositions }
  }, [requirementRows])

  const candidateStat = useMemo(() => {
    const open = candidateRows.filter((row) => !row.hasArchivedState && row.status !== 'rejected' && !row.hasJoined).length
    const active = candidateRows.filter((row) => !row.hasArchivedState).length
    const unattached = candidateRows.filter((row) => !row.hasArchivedState && row.isUnattached).length
    const pipeline = candidateRows.filter((row) => !row.hasArchivedState && row.inPipeline).length
    const joined = candidateRows.filter((row) => !row.hasArchivedState && row.hasJoined).length
    return { open, active, unattached, pipeline, joined }
  }, [candidateRows])

  const requirementActivityOptions = useMemo(() => {
    return visibleRequirementRows.map((requirement) => ({
      value: requirement.id,
      label: `${requirement.req_id_display} · ${requirement.customer_name || 'No customer'}`,
    }))
  }, [visibleRequirementRows])

  const candidateOptions = useMemo(() => {
    return visibleCandidateRows.map((candidate) => ({
      value: candidate.id,
      label: `${candidate.name} · ${candidate.email || 'No email'}`,
    }))
  }, [visibleCandidateRows])

  const handleRequirementSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      date_opened: requirementForm.dateOpened,
      vessel_name: requirementForm.vesselName || null,
      vessel_type_id: requirementForm.vesselTypeId,
      rank_id: requirementForm.rankId,
      positions_required: Number(requirementForm.positionsRequired),
      target_days: Number(requirementForm.targetDays),
      status: requirementForm.status,
      customer_name: requirementForm.customerName || null,
      owner_recruiter_id: requirementForm.loggedByRecruiterId || currentRecruiterId,
      created_by_recruiter_id: requirementForm.loggedByRecruiterId || currentRecruiterId,
      ...(requirementForm.status === 'cancelled'
        ? { closure_reason: requirementForm.notes?.trim() || 'Cancelled from recruiter workspace' }
        : {}),
    }

    if (!payload.vessel_type_id || !payload.rank_id || !payload.positions_required || !payload.target_days) {
      setError('Please complete the required requirement fields.')
      return
    }

    try {
      if (requirementForm.id) {
        const { error: updateError } = await supabase
          .from('requirements')
          .update(payload)
          .eq('id', requirementForm.id)

        if (updateError) throw updateError
        setSuccess('Requirement updated.')
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('requirements')
          .insert({
            ...payload,
            status: 'open',
          })
          .select('id, req_id_display')
          .maybeSingle()

        if (insertError) throw insertError
        setSuccess('Requirement created.')

        if (requirementForm.status && requirementForm.status !== 'open' && insertData?.id) {
          const { error: transitionError } = await supabase
            .from('requirements')
            .update({
              status: requirementForm.status,
              ...(requirementForm.status === 'cancelled'
                ? { closure_reason: requirementForm.notes?.trim() || 'Cancelled from recruiter workspace' }
                : {}),
            })
            .eq('id', insertData.id)

          if (transitionError) throw transitionError
        }

        if (requirementForm.notes?.trim() && insertData?.id) {
          const { error: remarkError } = await supabase.rpc('add_requirement_remark', {
            p_requirement_id: insertData.id,
            p_body: requirementForm.notes.trim(),
            p_visibility: 'internal',
          })
          if (remarkError) throw remarkError
        }
      }

      setRequirementForm((current) => ({
        ...current,
        id: '',
        dateOpened: new Date().toISOString().slice(0, 10),
        vesselName: '',
        vesselTypeId: '',
        rankId: '',
        positionsRequired: '1',
        targetDays: '30',
        status: 'open',
        customerName: '',
        loggedByRecruiterId: currentRecruiterId,
        notes: '',
      }))
      await reloadWorkspace()
    } catch (submitError) {
      handleActionError(submitError, 'Failed to save the requirement')
    }
  }

  const populateRequirementForm = (requirement) => {
    setRequirementForm({
      id: requirement.id,
      dateOpened: requirement.date_opened || new Date().toISOString().slice(0, 10),
      vesselName: requirement.vessel_name || '',
      vesselTypeId: requirement.vessel_type_id || '',
      rankId: requirement.rank_id || '',
      positionsRequired: String(requirement.positions_required ?? '1'),
      targetDays: String(requirement.target_days ?? '30'),
      status: requirement.status || 'open',
      customerName: requirement.customer_name || '',
      loggedByRecruiterId: requirement.created_by_recruiter_id || currentRecruiterId,
      notes: '',
    })
    setActiveTab('requirements')
  }

  const handleRequirementStatusChange = async (requirement, newStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('requirements')
        .update({ status: newStatus })
        .eq('id', requirement.id)

      if (updateError) throw updateError
      await reloadWorkspace()
      setSuccess(`Requirement ${requirement.req_id_display} moved to ${newStatus}.`)
    } catch (updateError) {
      handleActionError(updateError, 'Failed to update requirement status')
    }
  }

  const handleRequirementArchive = async (requirement) => {
    try {
      const { error: updateError } = await supabase
        .from('requirements')
        .update({
          archived_at: requirement.archived_at || new Date().toISOString(),
          archived_by_recruiter_id: currentRecruiterId,
          archive_reason: requirement.archive_reason || 'Archived from recruiter workspace',
        })
        .eq('id', requirement.id)

      if (updateError) throw updateError
      await reloadWorkspace()
      setSuccess(`Requirement ${requirement.req_id_display} archived.`)
    } catch (updateError) {
      handleActionError(updateError, 'Failed to archive the requirement')
    }
  }

  const handleRequirementDelete = async (requirement) => {
    if (role !== 'Master Recruiter' && !sameDay(requirement.created_at, new Date())) {
      setError('Only the Master Recruiter can delete older requirement rows.')
      return
    }

    if (!window.confirm(`Delete requirement ${requirement.req_id_display}? This is a restricted action.`)) {
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('requirements')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_recruiter_id: currentRecruiterId,
          delete_reason: 'Deleted from recruiter workspace',
        })
        .eq('id', requirement.id)

      if (updateError) throw updateError
      await reloadWorkspace()
      setSuccess(`Requirement ${requirement.req_id_display} deleted.`)
    } catch (updateError) {
      handleActionError(updateError, 'Failed to delete the requirement')
    }
  }

  const handleCandidateSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!candidateForm.name.trim() || !candidateForm.dob || !candidateForm.dateContacted || !candidateForm.rankId || !candidateForm.vesselTypeId || !candidateForm.nationalityId || !candidateForm.expInRankMonths || !candidateForm.telephone || !candidateForm.email) {
      setError('Please complete the required candidate fields.')
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('prospects')
        .insert({
          name: candidateForm.name,
          dob: candidateForm.dob,
          nationality_id: candidateForm.nationalityId,
          rank_applied_for_id: candidateForm.rankId,
          vessel_type_id: candidateForm.vesselTypeId,
          exp_in_rank_months: Number(candidateForm.expInRankMonths),
          previous_employer: candidateForm.previousEmployer || null,
          is_first_time_at_sea: candidateForm.isFirstTimeAtSea,
          telephone: candidateForm.telephone,
          email: candidateForm.email,
          lead_source: candidateForm.leadSource || null,
          status: 'contacted',
          first_contacted_at: candidateForm.dateContacted ? new Date(`${candidateForm.dateContacted}T00:00:00`).toISOString() : new Date().toISOString(),
          created_by_recruiter_id: candidateForm.addedByRecruiterId || currentRecruiterId,
        })
        .select('id')
        .maybeSingle()

      if (insertError) throw insertError

      if (candidateForm.notes?.trim() && data?.id) {
        const { error: noteError } = await supabase.rpc('add_prospect_note', {
          p_prospect_id: data.id,
          p_body: candidateForm.notes.trim(),
          p_visibility: 'internal',
        })
        if (noteError) throw noteError
      }

      if (candidateForm.requirementId && data?.id && canAttachCandidates) {
        const { error: attachError } = await supabase.rpc('attach_existing_prospect_to_requirement', {
          p_prospect_id: data.id,
          p_requirement_id: candidateForm.requirementId,
        })
        if (attachError) throw attachError
      }

      setCandidateForm((current) => ({
        ...current,
        name: '',
        dob: '',
        telephone: '',
        email: '',
        previousEmployer: '',
        expInRankMonths: '',
        leadSource: '',
        notes: '',
      }))
      setSuccess('Candidate created.')
      await reloadWorkspace()
    } catch (submitError) {
      handleActionError(submitError, 'Failed to save the candidate')
    }
  }

  const handleCandidateArchive = async (candidate) => {
    try {
      const { error: updateError } = await supabase
        .from('prospects')
        .update({
          archived_at: candidate.archived_at || new Date().toISOString(),
          archive_reason: candidate.archive_reason || 'Archived from recruiter workspace',
        })
        .eq('id', candidate.id)

      if (updateError) throw updateError
      await reloadWorkspace()
      setSuccess(`Candidate ${candidate.name} archived.`)
    } catch (updateError) {
      handleActionError(updateError, 'Failed to archive the candidate')
    }
  }

  const handleCandidateDelete = async (candidate) => {
    if (role !== 'Master Recruiter' && !sameDay(candidate.created_at, new Date())) {
      setError('Only the Master Recruiter can delete older candidate rows.')
      return
    }

    if (!window.confirm(`Delete candidate ${candidate.name}? This is a restricted action.`)) {
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('prospects')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_recruiter_id: currentRecruiterId,
        })
        .eq('id', candidate.id)

      if (updateError) throw updateError
      await reloadWorkspace()
      setSuccess(`Candidate ${candidate.name} deleted.`)
    } catch (updateError) {
      handleActionError(updateError, 'Failed to delete the candidate')
    }
  }

  const handleSendApplicationLink = async (candidate) => {
    try {
      const { error: functionError } = await supabase.functions.invoke('send-prospect-invite', {
        body: {
          prospectId: candidate.id,
          personalMessage: 'Application link sent from recruiter workspace',
        },
      })

      if (functionError) throw functionError
      await reloadWorkspace()
      setSuccess(`Application link sent to ${candidate.name}.`)
    } catch (inviteError) {
      handleActionError(inviteError, 'Failed to send the application link')
    }
  }

  const handlePipelineTransition = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error: transitionError } = await supabase.rpc('transition_junction_status', {
        p_prospect_requirement_id: pipelineForm.prospectRequirementId,
        p_new_status: pipelineForm.newStatus,
        p_expected_version: Number(pipelineForm.expectedVersion),
        p_withdrawal_reason: pipelineForm.withdrawalReason || null,
        p_note_body: pipelineForm.noteBody || null,
        p_note_visibility: pipelineForm.noteVisibility,
      })

      if (transitionError) throw transitionError

      setPipelineForm((current) => ({
        ...current,
        noteBody: '',
        withdrawalReason: '',
      }))
      setSuccess('Pipeline stage updated.')
      await reloadWorkspace()
    } catch (transitionError) {
      handleActionError(transitionError, 'Failed to transition the pipeline stage')
    }
  }

  const handleAttachment = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error: attachError } = await supabase.rpc('attach_existing_prospect_to_requirement', {
        p_prospect_id: attachForm.prospectId,
        p_requirement_id: attachForm.requirementId,
      })
      if (attachError) throw attachError
      setSuccess('Candidate attached to requirement.')
      await reloadWorkspace()
    } catch (attachError) {
      handleActionError(attachError, 'Failed to attach the candidate to the requirement')
    }
  }

  const exportRequirementsCsv = async () => {
    await logRecruiterExport({
      reportType: 'workspace_requirements',
      exportFormat: 'csv',
      rowIds: visibleRequirementRows.map((row) => row.id),
      rowCount: visibleRequirementRows.length,
      filters: { requirementFilter },
    })

    await downloadCsvReport({
      filename: `workspace-requirements-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Req ID', value: (row) => row.req_id_display },
        { label: 'Status', value: (row) => row.status },
        { label: 'Vessel', value: (row) => row.vessel_name || '' },
        { label: 'Rank', value: (row) => ranks.find((item) => item.id === row.rank_id)?.name || row.rank_id || '' },
        { label: 'Open Positions', value: (row) => row.openPositions },
        { label: 'Logged By', value: (row) => recruiters.find((item) => item.id === row.created_by_recruiter_id)?.full_name || row.created_by_recruiter_id || '' },
      ],
      rows: visibleRequirementRows,
    })
  }

  const formatCandidateApplicationStatus = (candidate) => {
    if (candidate.applicationStatus === 'Completed') return 'green'
    if (candidate.applicationStatus === 'Link Sent') return 'amber'
    return 'red'
  }

  if (permLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  const canAccessWorkspace = hasPermission('view_prospects') || hasPermission('create_prospects') || hasPermission('view_requirements') || hasPermission('create_requirements')

  if (!canAccessWorkspace) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <EmptyState
            icon={ShieldCheck}
            title="Workspace is not available"
            description="This recruiter account does not have permission to view the workspace."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Workspace"
          title="Daily recruiting workspace"
          description="Manage requirements, candidates, and candidate pipeline stages from the same operating surface."
          actions={(
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reloadWorkspace}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Refresh
              </button>
              <Link
                to="/recruiter/kpi"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <ArrowRight className="h-4 w-4" />
                Open KPI
              </Link>
            </div>
          )}
        />

        {error ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Open requirements" value={requirementStat.open} icon={ClipboardList} tone="info" hint="Requirements currently needing candidate flow." />
          <StatCard label="Open positions" value={requirementStat.openPositions} icon={CheckCircle2} tone="warning" hint="Remaining slots across active requirements." />
          <StatCard label="Active candidates" value={candidateStat.active} icon={Users} tone="success" hint="Candidates that are not archived or deleted." />
          <StatCard label="In pipeline" value={candidateStat.pipeline} icon={ArrowRight} tone="accent" hint="Candidates linked to an active requirement pipeline." />
        </div>

        <div className="mt-6">
          <SegmentedControl options={WORKSPACE_TABS} value={activeTab} onChange={changeWorkspaceTab} />
        </div>

        {activeTab === 'requirements' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Panel
              title={requirementForm.id ? 'Edit requirement' : 'Add requirement'}
              description="Replicate the spreadsheet-style requirement row input with a compact recruiter form."
              icon={Plus}
            >
              <form className="space-y-4" onSubmit={handleRequirementSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Date opened"
                    type="date"
                    required
                    value={requirementForm.dateOpened}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, dateOpened: value }))}
                  />
                  <TextField
                    label="Vessel"
                    required
                    value={requirementForm.vesselName}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, vesselName: value }))}
                    placeholder="Vessel name"
                  />
                  <SelectField
                    label="Vessel type"
                    required
                    value={requirementForm.vesselTypeId}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, vesselTypeId: value }))}
                    options={vesselTypeOptions}
                    placeholder="Choose a vessel type"
                  />
                  <SelectField
                    label="Rank"
                    required
                    value={requirementForm.rankId}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, rankId: value }))}
                    options={rankOptions}
                    placeholder="Choose a rank"
                  />
                  <TextField
                    label="Positions required"
                    type="number"
                    required
                    value={requirementForm.positionsRequired}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, positionsRequired: value }))}
                    placeholder="1"
                  />
                  <TextField
                    label="Target days"
                    type="number"
                    required
                    value={requirementForm.targetDays}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, targetDays: value }))}
                    placeholder="30"
                  />
                  <SelectField
                    label="Requirement status"
                    required
                    value={requirementForm.status}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, status: value }))}
                    options={[
                      { value: 'open', label: 'Open' },
                      { value: 'closed', label: 'Closed' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ]}
                  />
                  <TextField
                    label="Customer name"
                    value={requirementForm.customerName}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, customerName: value }))}
                    placeholder="Optional"
                  />
                </div>

                {canChooseRecruiter ? (
                  <SelectField
                    label="Logged by"
                    value={requirementForm.loggedByRecruiterId}
                    onChange={(value) => setRequirementForm((current) => ({ ...current, loggedByRecruiterId: value }))}
                    options={recruiterOptions}
                    placeholder="Choose recruiter"
                  />
                ) : null}

                <TextAreaField
                  label="Remarks / notes"
                  value={requirementForm.notes}
                  onChange={(value) => setRequirementForm((current) => ({ ...current, notes: value }))}
                  placeholder="Optional notes for this requirement row"
                />

                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canCreateRequirements}>
                    <Plus className="h-4 w-4" />
                    {requirementForm.id ? 'Update requirement' : 'Save requirement'}
                  </button>
                  {requirementForm.id ? (
                    <button
                      type="button"
                      className="workspace-action-button workspace-action-button--secondary"
                      onClick={() => setRequirementForm((current) => ({
                        ...current,
                        id: '',
                        vesselName: '',
                        customerName: '',
                        notes: '',
                      }))}
                    >
                      Cancel edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="workspace-action-button workspace-action-button--secondary"
                    onClick={exportRequirementsCsv}
                  >
                    Export CSV
                  </button>
                </div>
              </form>
            </Panel>

            <Panel
              title="Requirement rows"
              description="Spreadsheet-style rows with quick close, archive, and delete controls."
              icon={ClipboardList}
            >
              <div className="mb-4">
                <SegmentedControl options={REQUIREMENT_FILTERS} value={requirementFilter} onChange={setRequirementFilter} size="sm" />
              </div>

              <div className="space-y-3">
                {visibleRequirementRows.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No requirement rows"
                    description="Create the first requirement or switch to All to view archived rows."
                  />
                ) : visibleRequirementRows.map((requirement) => {
                  const ownerName = recruiters.find((item) => item.id === requirement.owner_recruiter_id)?.full_name || 'Recruiter'
                  const creatorName = recruiters.find((item) => item.id === requirement.created_by_recruiter_id)?.full_name || 'Recruiter'
                  const archived = Boolean(requirement.archived_at || requirement.deleted_at)
                  return (
                    <div key={requirement.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => populateRequirementForm(requirement)}
                              className="text-left text-base font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {requirement.req_id_display}
                            </button>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {requirement.status}
                            </span>
                            {archived ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                                Archived
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {requirement.customer_name || 'No customer'} · {requirement.vessel_name || 'No vessel'} · {vesselTypes.find((item) => item.id === requirement.vessel_type_id)?.name || 'Unknown vessel type'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Rank: {ranks.find((item) => item.id === requirement.rank_id)?.name || 'Unknown'} · Positions: {requirement.positions_required} · Joined: {requirement.joinedCount} · Open positions: {requirement.openPositions}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Opened {formatDate(requirement.date_opened)} · Updated {formatRelativeTime(requirement.updated_at)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Logged by {creatorName} · Owner {ownerName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={() => populateRequirementForm(requirement)}>
                            Edit
                          </button>
                          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={() => handleRequirementStatusChange(requirement, 'closed')} disabled={!canCreateRequirements}>
                            Close
                          </button>
                          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={() => handleRequirementStatusChange(requirement, 'cancelled')} disabled={!canCreateRequirements}>
                            Cancel
                          </button>
                          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={() => handleRequirementArchive(requirement)} disabled={!canArchiveRequirements}>
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                          <button type="button" className="workspace-action-button workspace-action-button--secondary" onClick={() => handleRequirementDelete(requirement)} disabled={!canDeleteRequirements && !sameDay(requirement.created_at, new Date())}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === 'candidates' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Panel
              title="Create candidate"
              description="Candidates can be entered without a requirement, then attached later."
              icon={UserPlus}
            >
              <form className="space-y-4" onSubmit={handleCandidateSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Candidate name"
                    required
                    value={candidateForm.name}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, name: value }))}
                    placeholder="Full name"
                  />
                  <TextField
                    label="Date of birth"
                    type="date"
                    required
                    value={candidateForm.dob}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, dob: value }))}
                  />
                  <TextField
                    label="Date contacted"
                    type="date"
                    required
                    value={candidateForm.dateContacted}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, dateContacted: value }))}
                  />
                  <SelectField
                    label="Added by"
                    value={candidateForm.addedByRecruiterId}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, addedByRecruiterId: value }))}
                    options={recruiterOptions}
                    placeholder="Choose recruiter"
                  />
                  <SelectField
                    label="Rank"
                    required
                    value={candidateForm.rankId}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, rankId: value }))}
                    options={rankOptions}
                    placeholder="Choose a rank"
                  />
                  <SelectField
                    label="Vessel type"
                    required
                    value={candidateForm.vesselTypeId}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, vesselTypeId: value }))}
                    options={vesselTypeOptions}
                    placeholder="Choose a vessel type"
                  />
                  <SelectField
                    label="Nationality"
                    required
                    value={candidateForm.nationalityId}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, nationalityId: value }))}
                    options={countryOptions}
                    placeholder="Choose nationality"
                  />
                  <TextField
                    label="Experience in rank (months)"
                    required
                    type="number"
                    value={candidateForm.expInRankMonths}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, expInRankMonths: value }))}
                    placeholder="0"
                  />
                  <TextField
                    label="Telephone"
                    required
                    value={candidateForm.telephone}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, telephone: value }))}
                    placeholder="+919999999999"
                  />
                  <TextField
                    label="Email"
                    type="email"
                    required
                    value={candidateForm.email}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, email: value }))}
                    placeholder="candidate@example.com"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Previous employer"
                    value={candidateForm.previousEmployer}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, previousEmployer: value }))}
                    placeholder="Optional"
                  />
                  <TextField
                    label="Lead source"
                    value={candidateForm.leadSource}
                    onChange={(value) => setCandidateForm((current) => ({ ...current, leadSource: value }))}
                    placeholder="Referral, walk-in, search..."
                  />
                </div>

                <SelectField
                  label="Optional requirement attachment"
                  value={candidateForm.requirementId}
                  onChange={(value) => setCandidateForm((current) => ({ ...current, requirementId: value }))}
                  options={requirementActivityOptions}
                  placeholder="Leave unattached for now"
                />

                <ToggleField
                  label="First time at sea"
                  checked={candidateForm.isFirstTimeAtSea}
                  onChange={(checked) => setCandidateForm((current) => ({ ...current, isFirstTimeAtSea: checked }))}
                  description="If checked, previous employer stays optional."
                />

                <TextAreaField
                  label="Notes"
                  value={candidateForm.notes}
                  onChange={(value) => setCandidateForm((current) => ({ ...current, notes: value }))}
                  placeholder="Optional candidate notes"
                />

                <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canCreateCandidates}>
                  <Plus className="h-4 w-4" />
                  Save candidate
                </button>
              </form>
            </Panel>

            <Panel
              title="Candidate rows"
              description="Open, unattached, pipeline, joined, and archived views for the live candidate list."
              icon={Users}
            >
              <div className="mb-4">
                <SegmentedControl options={CANDIDATE_FILTERS} value={candidateFilter} onChange={setCandidateFilter} size="sm" />
              </div>

              <div className="space-y-3">
                {visibleCandidateRows.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No candidates"
                    description="Create the first candidate or switch to All to view archived rows."
                  />
                ) : visibleCandidateRows.map((candidate) => {
                  const joinedRequirement = candidate.attachedJunctions.find((junction) => junction.status === 'joined')
                  const application = applicationByProspectId[candidate.id]
                  return (
                    <div key={candidate.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/recruiter/workspace/prospects/${candidate.id}`)}
                              className="text-left text-base font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {candidate.name}
                            </button>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {candidate.status}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${formatCandidateApplicationStatus(candidate) === 'green' ? 'bg-emerald-100 text-emerald-700' : formatCandidateApplicationStatus(candidate) === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                              Application {candidate.applicationStatus}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {candidate.email} · {candidate.telephone}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Rank: {ranks.find((item) => item.id === candidate.rank_applied_for_id)?.name || 'Unknown'} · Vessel type: {vesselTypes.find((item) => item.id === candidate.vessel_type_id)?.name || 'Unknown'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Last activity {formatRelativeTime(candidate.last_activity_at)} · Added by {recruiters.find((item) => item.id === candidate.created_by_recruiter_id)?.full_name || 'Recruiter'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {candidate.attachedJunctions.length === 0 ? 'Unattached' : `${candidate.attachedJunctions.length} requirement link(s)`}
                            {joinedRequirement ? ` · Joined requirement ${requirementById[joinedRequirement.requirement_id]?.req_id_display || joinedRequirement.requirement_id}` : ''}
                          </p>
                          {application?.reference_number ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Application ref: {application.reference_number}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="workspace-action-button workspace-action-button--secondary"
                            onClick={() => navigate(`/recruiter/workspace/prospects/${candidate.id}`)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="workspace-action-button workspace-action-button--secondary"
                            onClick={() => setAttachForm({ prospectId: candidate.id, requirementId: attachForm.requirementId || visibleRequirementRows[0]?.id || '' })}
                            disabled={!canAttachCandidates}
                          >
                            Attach
                          </button>
                          <button
                            type="button"
                            className="workspace-action-button workspace-action-button--secondary"
                            onClick={() => handleSendApplicationLink(candidate)}
                            disabled={candidate.applicationStatus === 'Completed'}
                          >
                            <Mail className="h-4 w-4" />
                            Send application link
                          </button>
                          <button
                            type="button"
                            className="workspace-action-button workspace-action-button--secondary"
                            onClick={() => handleCandidateArchive(candidate)}
                            disabled={!canManageCandidates}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                          <button
                            type="button"
                            className="workspace-action-button workspace-action-button--secondary"
                            onClick={() => handleCandidateDelete(candidate)}
                            disabled={!canManageCandidates}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Attach existing candidate to a requirement</p>
                <form className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={handleAttachment}>
                  <SelectField
                    label="Candidate"
                    value={attachForm.prospectId}
                    onChange={(value) => setAttachForm((current) => ({ ...current, prospectId: value }))}
                    options={candidateOptions}
                    placeholder="Choose a candidate"
                    required
                  />
                  <SelectField
                    label="Requirement"
                    value={attachForm.requirementId}
                    onChange={(value) => setAttachForm((current) => ({ ...current, requirementId: value }))}
                    options={requirementActivityOptions}
                    placeholder="Choose a requirement"
                    required
                  />
                  <button type="submit" className="workspace-action-button workspace-action-button--primary self-end" disabled={!canAttachCandidates}>
                    <ArrowRight className="h-4 w-4" />
                    Attach
                  </button>
                </form>
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === 'pipeline' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Panel
              title="Pipeline stage control"
              description="Stage jumps are allowed, but every move is logged with the recruiter who completed it."
              icon={ArrowRight}
            >
              <form className="space-y-4" onSubmit={handlePipelineTransition}>
                <SelectField
                  label="Pipeline row"
                  value={pipelineForm.prospectRequirementId}
                  onChange={(value) => {
                    const selected = pipelineRows.find((row) => row.id === value)
                    setPipelineForm((current) => ({
                      ...current,
                      prospectRequirementId: value,
                      expectedVersion: String(selected?.version || ''),
                    }))
                  }}
                  options={pipelineRows.map((row) => ({
                    value: row.id,
                    label: `${row.prospect?.name || row.prospect_id} · ${row.requirement?.req_id_display || row.requirement_id} · ${row.status}`,
                  }))}
                  placeholder="Choose a pipeline row"
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="New status"
                    value={pipelineForm.newStatus}
                    onChange={(value) => setPipelineForm((current) => ({ ...current, newStatus: value }))}
                    options={PIPELINE_STATUS_OPTIONS}
                    required
                  />
                  <TextField
                    label="Expected version"
                    type="number"
                    value={pipelineForm.expectedVersion}
                    onChange={(value) => setPipelineForm((current) => ({ ...current, expectedVersion: value }))}
                    required
                  />
                </div>
                <TextField
                  label="Withdrawal reason"
                  value={pipelineForm.withdrawalReason}
                  onChange={(value) => setPipelineForm((current) => ({ ...current, withdrawalReason: value }))}
                  placeholder="Required only for withdrawals"
                />
                <TextAreaField
                  label="Transition note"
                  value={pipelineForm.noteBody}
                  onChange={(value) => setPipelineForm((current) => ({ ...current, noteBody: value }))}
                  placeholder="Optional note to attach to the transition"
                />
                <SelectField
                  label="Note visibility"
                  value={pipelineForm.noteVisibility}
                  onChange={(value) => setPipelineForm((current) => ({ ...current, noteVisibility: value }))}
                  options={[
                    { value: 'internal', label: 'Internal' },
                    { value: 'master_only', label: 'Master only' },
                  ]}
                />
                <button type="submit" className="workspace-action-button workspace-action-button--primary" disabled={!canTransitionPipeline}>
                  <ArrowRight className="h-4 w-4" />
                  Save transition
                </button>
              </form>
            </Panel>

            <Panel
              title="Candidate pipeline rows"
              description="Current stage, last action by, application status, and next action guidance."
              icon={ClipboardList}
            >
              <div className="space-y-3">
                {pipelineRows.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No pipeline rows"
                    description="Attach a candidate to a requirement to begin pipeline tracking."
                  />
                ) : pipelineRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/recruiter/workspace/prospects/${row.prospect_id}`)}
                            className="text-left text-base font-semibold text-slate-900 hover:text-blue-700"
                          >
                            {row.prospect?.name || row.prospect_id}
                          </button>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${formatStatusClass(row.status)}`}>
                            {row.status}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.applicationStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' : row.applicationStatus === 'Link Sent' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                            Application {row.applicationStatus}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {row.requirement?.req_id_display || row.requirement_id} · {row.requirement?.vessel_name || 'No vessel'} · {ranks.find((item) => item.id === row.requirement?.rank_id)?.name || 'Unknown rank'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Requirement owner: {recruiters.find((item) => item.id === row.requirement?.owner_recruiter_id)?.full_name || 'Recruiter'} · Last action by {row.lastActionBy}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Previous stage: {row.previousStage} · Stage updated {formatRelativeTime(row.updated_at)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Next action: {row.nextAction}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Application ref: {applicationByProspectId[row.prospect_id]?.reference_number || 'Not sent yet'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="workspace-action-button workspace-action-button--secondary"
                          onClick={() => navigate(`/recruiter/workspace/prospects/${row.prospect_id}`)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="workspace-action-button workspace-action-button--secondary"
                          onClick={() => setPipelineForm((current) => ({ ...current, prospectRequirementId: row.id, expectedVersion: String(row.version || '') }))}
                        >
                          Transition
                        </button>
                        <button
                          type="button"
                          className="workspace-action-button workspace-action-button--secondary"
                          onClick={() => handleSendApplicationLink(row.prospect)}
                          disabled={row.applicationStatus === 'Completed'}
                        >
                          <Mail className="h-4 w-4" />
                          Send application link
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}
      </main>
    </div>
  )
}
