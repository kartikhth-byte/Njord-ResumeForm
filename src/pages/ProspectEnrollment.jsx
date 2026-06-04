/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import RecruiterWorkspaceNav from '../components/recruiter/RecruiterWorkspaceNav'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle,
  ClipboardList,
  Loader2,
  MessageSquareText,
  Link2,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'

const NOTE_VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Internal' },
  { value: 'master_only', label: 'Master only' },
]

const REQUIREMENT_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const JUNCTION_STATUS_OPTIONS = [
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'submitted_to_customer', label: 'Submitted to customer' },
  { value: 'customer_reviewing', label: 'Customer reviewing' },
  { value: 'customer_accepted', label: 'Customer accepted' },
  { value: 'customer_rejected', label: 'Customer rejected' },
  { value: 'joined', label: 'Joined' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

function unwrapSingleRow(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

function formatTimestamp(value) {
  if (!value) return 'Unknown'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getStatusTone(status) {
  if (!status) return 'bg-gray-100 text-gray-700'
  if (status === 'open' || status === 'shortlisted') return 'bg-emerald-100 text-emerald-700'
  if (status === 'closed' || status === 'customer_accepted' || status === 'joined') {
    return 'bg-blue-100 text-blue-700'
  }
  if (status === 'cancelled' || status === 'withdrawn' || status === 'customer_rejected') {
    return 'bg-rose-100 text-rose-700'
  }
  return 'bg-amber-100 text-amber-700'
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

function SectionCard({ title, description, icon, children, className = '' }) {
  const Icon = icon
  return (
    <section className={`recruiter-panel p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
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

function LockedActionState({ title, description }) {
  return (
    <EmptyState
      icon={ShieldCheck}
      title={title}
      description={description}
    />
  )
}

export default function ProspectEnrollment() {
  const { user, profile, signOut } = useAuth()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countries, setCountries] = useState([])
  const [ranks, setRanks] = useState([])
  const [vesselTypes, setVesselTypes] = useState([])
  const [prospects, setProspects] = useState([])
  const [requirements, setRequirements] = useState([])
  const [junctions, setJunctions] = useState([])

  const [createForm, setCreateForm] = useState({
    requirementId: '',
    name: '',
    dob: '',
    expInRankMonths: '',
    previousEmployer: '',
    isFirstTimeAtSea: false,
    telephone: '',
    email: '',
    nationalityId: '',
    leadSource: '',
  })
  const [attachForm, setAttachForm] = useState({
    prospectId: '',
    requirementId: '',
  })
  const [prospectNoteForm, setProspectNoteForm] = useState({
    prospectId: '',
    body: '',
    visibility: 'internal',
  })
  const [requirementRemarkForm, setRequirementRemarkForm] = useState({
    requirementId: '',
    body: '',
    visibility: 'internal',
  })
  const [requirementTransitionForm, setRequirementTransitionForm] = useState({
    requirementId: '',
    newStatus: 'closed',
    expectedVersion: '',
    closureReason: '',
    noteBody: '',
    noteVisibility: 'internal',
  })
  const [junctionTransitionForm, setJunctionTransitionForm] = useState({
    prospectRequirementId: '',
    newStatus: 'submitted_to_customer',
    expectedVersion: '',
    withdrawalReason: '',
    noteBody: '',
    noteVisibility: 'internal',
  })

  const countryNameById = useMemo(() => {
    return new Map(countries.map((country) => [country.id, country.name]))
  }, [countries])

  const rankNameById = useMemo(() => {
    return new Map(ranks.map((rank) => [rank.id, rank.name]))
  }, [ranks])

  const vesselTypeNameById = useMemo(() => {
    return new Map(vesselTypes.map((vesselType) => [vesselType.id, vesselType.name]))
  }, [vesselTypes])

  const isMasterRecruiter = profile?.role_name === 'Master Recruiter'
  const canCreateProspects = hasPermission('create_prospects')
  const canAttachProspectsToRequirements = hasPermission('edit_junction_status')
  const canWriteProspectNotes = hasPermission('edit_prospect_notes')
  const canWriteRequirementRemarks = hasPermission('edit_requirements')
  const canTransitionRequirements = hasPermission('transition_requirements')
  const canTransitionJunctions = hasPermission('edit_junction_status') || hasPermission('withdraw_junctions')
  const prospectNoteVisibilityOptions = isMasterRecruiter
    ? NOTE_VISIBILITY_OPTIONS
    : NOTE_VISIBILITY_OPTIONS.filter((option) => option.value === 'internal')
  const requirementRemarkVisibilityOptions = prospectNoteVisibilityOptions

  const openRequirements = useMemo(() => requirements.filter((requirement) => requirement.status === 'open'), [requirements])
  const prospectOptions = useMemo(() => prospects.map((prospect) => ({
    value: prospect.id,
    label: `${prospect.name} · ${prospect.email}`,
  })), [prospects])

  const requirementOptions = useMemo(() => requirements.map((requirement) => ({
    value: requirement.id,
    label: `${requirement.req_id_display} · ${requirement.status}`,
  })), [requirements])

  const junctionOptions = useMemo(() => junctions.map((junction) => {
    const prospect = prospects.find((item) => item.id === junction.prospect_id)
    const requirement = requirements.find((item) => item.id === junction.requirement_id)
    return {
      value: junction.id,
      label: `${requirement?.req_id_display || junction.requirement_id} · ${prospect?.name || junction.prospect_id}`,
    }
  }), [junctions, prospects, requirements])

  const canAccessWorkspace = hasPermission('view_prospects')
    || hasPermission('create_prospects')
    || hasPermission('view_requirements')
    || hasPermission('create_requirements')

  const loadWorkspace = async () => {
    setError('')
    try {
      const [
        countriesResponse,
        ranksResponse,
        vesselTypesResponse,
        prospectsResponse,
        requirementsResponse,
        junctionsResponse,
      ] = await Promise.all([
        supabase.from('countries').select('id, code, name, is_active').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('ranks').select('id, code, name, is_active').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('vessel_types').select('id, code, name, is_active').eq('is_active', true).order('name', { ascending: true }),
        supabase
          .from('prospects')
          .select('id, name, email, telephone, status, created_at, updated_at, last_activity_at, nationality_id, rank_applied_for_id, vessel_type_id')
          .order('last_activity_at', { ascending: false })
          .limit(12),
        supabase
          .from('requirements')
          .select('id, req_id_display, status, version, customer_name, vessel_name, created_at, updated_at, owner_recruiter_id, rank_id, vessel_type_id')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('prospect_requirements')
          .select('id, prospect_id, requirement_id, status, version, created_at, updated_at, assigned_by_recruiter_id, last_transition_by_recruiter_id')
          .order('created_at', { ascending: false })
          .limit(12),
      ])

      if (countriesResponse.error) throw countriesResponse.error
      if (ranksResponse.error) throw ranksResponse.error
      if (vesselTypesResponse.error) throw vesselTypesResponse.error
      if (prospectsResponse.error) throw prospectsResponse.error
      if (requirementsResponse.error) throw requirementsResponse.error
      if (junctionsResponse.error) throw junctionsResponse.error

      setCountries(countriesResponse.data || [])
      setRanks(ranksResponse.data || [])
      setVesselTypes(vesselTypesResponse.data || [])
      setProspects(prospectsResponse.data || [])
      setRequirements(requirementsResponse.data || [])
      setJunctions(junctionsResponse.data || [])
    } catch (loadError) {
      console.error('Failed to load prospect enrollment workspace:', loadError)
      setError(loadError.message || 'Failed to load prospect enrollment workspace')
    }
  }

  useEffect(() => {
    if (permLoading) return
    if (!canAccessWorkspace) {
      setLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      await loadWorkspace()
      if (!cancelled) {
        setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [permLoading, user?.id])

  useEffect(() => {
    if (!createForm.requirementId && openRequirements.length > 0) {
      setCreateForm((current) => ({ ...current, requirementId: openRequirements[0].id }))
    }
    if (!attachForm.requirementId && requirements.length > 0) {
      setAttachForm((current) => ({ ...current, requirementId: requirements[0].id }))
    }
    if (!prospectNoteForm.prospectId && prospects.length > 0) {
      setProspectNoteForm((current) => ({ ...current, prospectId: prospects[0].id }))
    }
    if (!requirementRemarkForm.requirementId && requirements.length > 0) {
      setRequirementRemarkForm((current) => ({ ...current, requirementId: requirements[0].id }))
    }
    if (!requirementTransitionForm.requirementId && requirements.length > 0) {
      setRequirementTransitionForm((current) => ({
        ...current,
        requirementId: requirements[0].id,
        expectedVersion: String(requirements[0].version || ''),
      }))
    }
    if (!junctionTransitionForm.prospectRequirementId && junctions.length > 0) {
      setJunctionTransitionForm((current) => ({
        ...current,
        prospectRequirementId: junctions[0].id,
        expectedVersion: String(junctions[0].version || ''),
      }))
    }
  }, [openRequirements, requirements, prospects, junctions])

  const reloadWorkspace = async () => {
    setRefreshing(true)
    setError('')
    setSuccess('')
    try {
      await loadWorkspace()
    } finally {
      setRefreshing(false)
    }
  }

  const handleRpcError = (rpcError, fallback) => {
    console.error(fallback, rpcError)
    setError(rpcError.message || fallback)
  }

  const handleCreateProspect = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error: rpcError } = await supabase.rpc('create_prospect_with_requirement', {
        p_requirement_id: createForm.requirementId,
        p_name: createForm.name,
        p_dob: createForm.dob,
        p_exp_in_rank_months: Number(createForm.expInRankMonths),
        p_previous_employer: createForm.previousEmployer || null,
        p_is_first_time_at_sea: createForm.isFirstTimeAtSea,
        p_telephone: createForm.telephone,
        p_email: createForm.email,
        p_nationality_id: createForm.nationalityId || null,
        p_lead_source: createForm.leadSource || null,
      })

      if (rpcError) throw rpcError

      const result = unwrapSingleRow(data)
      setSuccess(
        `Created prospect ${result?.prospect_id || 'successfully'} and attached it to ${result?.req_id_display || 'the requirement'}.`
      )
      setCreateForm((current) => ({
        ...current,
        name: '',
        dob: '',
        expInRankMonths: '',
        previousEmployer: '',
        isFirstTimeAtSea: false,
        telephone: '',
        email: '',
        leadSource: '',
      }))
      await reloadWorkspace()
    } catch (rpcError) {
      handleRpcError(rpcError, 'Failed to create prospect and attach it to the requirement')
    }
  }

  const handleAttachExistingProspect = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error: rpcError } = await supabase.rpc('attach_existing_prospect_to_requirement', {
        p_prospect_id: attachForm.prospectId,
        p_requirement_id: attachForm.requirementId,
      })

      if (rpcError) throw rpcError

      const result = unwrapSingleRow(data)
      setSuccess(
        `Attached ${result?.prospect_id || 'the prospect'} to ${result?.req_id_display || 'the requirement'}.`
      )
      await reloadWorkspace()
    } catch (rpcError) {
      handleRpcError(rpcError, 'Failed to attach the prospect to the requirement')
    }
  }

  const handleAddProspectNote = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc('add_prospect_note', {
        p_prospect_id: prospectNoteForm.prospectId,
        p_body: prospectNoteForm.body,
        p_visibility: prospectNoteForm.visibility,
      })

      if (rpcError) throw rpcError

      setSuccess('Prospect note saved.')
      setProspectNoteForm((current) => ({ ...current, body: '' }))
      await reloadWorkspace()
    } catch (rpcError) {
      handleRpcError(rpcError, 'Failed to save the prospect note')
    }
  }

  const handleAddRequirementRemark = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc('add_requirement_remark', {
        p_requirement_id: requirementRemarkForm.requirementId,
        p_body: requirementRemarkForm.body,
        p_visibility: requirementRemarkForm.visibility,
      })

      if (rpcError) throw rpcError

      setSuccess('Requirement remark saved.')
      setRequirementRemarkForm((current) => ({ ...current, body: '' }))
      await reloadWorkspace()
    } catch (rpcError) {
      handleRpcError(rpcError, 'Failed to save the requirement remark')
    }
  }

  const handleTransitionRequirement = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error: rpcError } = await supabase.rpc('transition_requirement_status', {
        p_requirement_id: requirementTransitionForm.requirementId,
        p_new_status: requirementTransitionForm.newStatus,
        p_expected_version: Number(requirementTransitionForm.expectedVersion),
        p_closure_reason: requirementTransitionForm.closureReason || null,
        p_note_body: requirementTransitionForm.noteBody || null,
        p_note_visibility: requirementTransitionForm.noteVisibility,
      })

      if (rpcError) throw rpcError

      const result = unwrapSingleRow(data)
      setSuccess(
        `Requirement ${result?.req_id_display || ''} moved to ${result?.status || 'the selected status'}.`
      )
      setRequirementTransitionForm((current) => ({ ...current, noteBody: '', closureReason: '' }))
      await reloadWorkspace()
    } catch (rpcError) {
      handleRpcError(rpcError, 'Failed to transition the requirement')
    }
  }

  const handleTransitionJunction = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error: rpcError } = await supabase.rpc('transition_junction_status', {
        p_prospect_requirement_id: junctionTransitionForm.prospectRequirementId,
        p_new_status: junctionTransitionForm.newStatus,
        p_expected_version: Number(junctionTransitionForm.expectedVersion),
        p_withdrawal_reason: junctionTransitionForm.withdrawalReason || null,
        p_note_body: junctionTransitionForm.noteBody || null,
        p_note_visibility: junctionTransitionForm.noteVisibility,
      })

      if (rpcError) throw rpcError

      const result = unwrapSingleRow(data)
      setSuccess(
        `Junction ${result?.prospect_requirement_id || ''} moved to ${result?.status || 'the selected status'}.`
      )
      setJunctionTransitionForm((current) => ({ ...current, noteBody: '', withdrawalReason: '' }))
      await reloadWorkspace()
    } catch (rpcError) {
      handleRpcError(rpcError, 'Failed to transition the junction')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
            <p className="text-sm text-slate-600">Loading prospect enrollment workspace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!canAccessWorkspace) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
        <RecruiterWorkspaceNav />
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <EmptyState
            icon={ShieldCheck}
            title="Prospect enrollment is not available"
            description="This recruiter account does not yet have the permissions needed to view prospects or requirements."
          />
        </div>
      </div>
    )
  }

  const totalProspects = prospects.length
  const openRequirementsCount = requirements.filter((requirement) => requirement.status === 'open').length
  const junctionCount = junctions.length
  const liveProspects = prospects.filter((prospect) => prospect.status !== 'rejected').length

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruiterTopbar user={user} profile={profile} role={profile?.role_name} signOut={signOut} />
      <RecruiterWorkspaceNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Prospect Enrollment"
          title="Recruiter enrollment workspace"
          description="Create prospects, attach them to requirements, and move the prospect-to-requirement workflow forward without leaving the recruiter console."
          actions={(
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reloadWorkspace}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <Link
                to="/recruiter/applications"
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <ArrowRight className="h-4 w-4" />
                Open applications workspace
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
          <StatCard label="Prospects" value={totalProspects} icon={Users} tone="info" hint="Prospects visible to this recruiter." />
          <StatCard label="Live prospects" value={liveProspects} icon={UserPlus} tone="success" hint="Prospects that are not rejected." />
          <StatCard label="Open requirements" value={openRequirementsCount} icon={BriefcaseBusiness} tone="warning" hint="Requirements available for shortlisting." />
          <StatCard label="Active junctions" value={junctionCount} icon={ClipboardList} tone="info" hint="Prospect-to-requirement links loaded into the workspace." />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Create and attach a new prospect"
            description="Use the transactional RPC so the prospect and shortlist link are created together."
            icon={Plus}
          >
            {!canCreateProspects ? (
              <LockedActionState
                title="Prospect creation is read-only for this role"
                description="This recruiter account can view prospects and requirements, but it cannot create new prospects."
              />
            ) : openRequirements.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No open requirements are available yet.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleCreateProspect}>
                <SelectField
                  label="Requirement"
                  required
                  value={createForm.requirementId}
                  onChange={(value) => setCreateForm((current) => ({ ...current, requirementId: value }))}
                  options={openRequirements.map((requirement) => ({
                    value: requirement.id,
                    label: `${requirement.req_id_display} · ${requirement.customer_name || 'No customer'}`,
                  }))}
                  placeholder="Choose an open requirement"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="Prospect name" required value={createForm.name} onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))} placeholder="Full name" />
                  <TextField label="Date of birth" required type="date" value={createForm.dob} onChange={(value) => setCreateForm((current) => ({ ...current, dob: value }))} />
                  <SelectField
                    label="Nationality"
                    required
                    value={createForm.nationalityId}
                    onChange={(value) => setCreateForm((current) => ({ ...current, nationalityId: value }))}
                    options={countries.map((country) => ({ value: country.id, label: country.name }))}
                    placeholder="Choose a nationality"
                  />
                  <TextField
                    label="Experience in rank (months)"
                    required
                    type="number"
                    value={createForm.expInRankMonths}
                    onChange={(value) => setCreateForm((current) => ({ ...current, expInRankMonths: value }))}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="Telephone" required value={createForm.telephone} onChange={(value) => setCreateForm((current) => ({ ...current, telephone: value }))} placeholder="+919999999999" />
                  <TextField label="Email" required type="email" value={createForm.email} onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))} placeholder="prospect@example.com" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Previous employer"
                    value={createForm.previousEmployer}
                    onChange={(value) => setCreateForm((current) => ({ ...current, previousEmployer: value }))}
                    placeholder="Optional"
                  />
                  <TextField
                    label="Lead source"
                    value={createForm.leadSource}
                    onChange={(value) => setCreateForm((current) => ({ ...current, leadSource: value }))}
                    placeholder="Referral, walk-in, search, etc."
                  />
                </div>
                <ToggleField
                  label="First time at sea"
                  description="If checked, previous employer becomes optional and the prospect will be treated as a first-time seafarer."
                  checked={createForm.isFirstTimeAtSea}
                  onChange={(checked) => setCreateForm((current) => ({ ...current, isFirstTimeAtSea: checked }))}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!createForm.requirementId || !createForm.name || !createForm.dob || !createForm.nationalityId || !createForm.expInRankMonths || !createForm.telephone || !createForm.email}
                >
                  <UserPlus className="h-4 w-4" />
                  Create prospect and attach
                </button>
              </form>
            )}
          </SectionCard>

          <SectionCard
            title="Attach an existing prospect"
            description="Shortlist an already-recorded prospect against an open requirement."
            icon={Link2}
          >
            {!canAttachProspectsToRequirements ? (
              <LockedActionState
                title="Attaching prospects is not available"
                description="This account can view the prospect and requirement lists, but it cannot create shortlist links."
              />
            ) : (
              <form className="space-y-4" onSubmit={handleAttachExistingProspect}>
                <SelectField
                  label="Prospect"
                  required
                  value={attachForm.prospectId}
                  onChange={(value) => setAttachForm((current) => ({ ...current, prospectId: value }))}
                  options={prospectOptions}
                  placeholder="Choose a prospect"
                />
                <SelectField
                  label="Requirement"
                  required
                  value={attachForm.requirementId}
                  onChange={(value) => setAttachForm((current) => ({ ...current, requirementId: value }))}
                  options={openRequirements.map((requirement) => ({
                    value: requirement.id,
                    label: `${requirement.req_id_display} · ${requirement.customer_name || 'No customer'}`,
                  }))}
                  placeholder="Choose an open requirement"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!attachForm.prospectId || !attachForm.requirementId}
                >
                  <Link2 className="h-4 w-4" />
                  Attach prospect to requirement
                </button>
              </form>
            )}
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Prospect notes"
            description="Add recruiter notes directly through the shared RPC helper."
            icon={MessageSquareText}
          >
            {!canWriteProspectNotes ? (
              <LockedActionState
                title="Prospect notes are read-only for this role"
                description="This recruiter account can view prospects, but it cannot add or edit prospect notes."
              />
            ) : (
              <form className="space-y-4" onSubmit={handleAddProspectNote}>
                <SelectField
                  label="Prospect"
                  required
                  value={prospectNoteForm.prospectId}
                  onChange={(value) => setProspectNoteForm((current) => ({ ...current, prospectId: value }))}
                  options={prospectOptions}
                  placeholder="Choose a prospect"
                />
                <TextAreaField
                  label="Note"
                  value={prospectNoteForm.body}
                  onChange={(value) => setProspectNoteForm((current) => ({ ...current, body: value }))}
                  placeholder="Add a recruiter note for this prospect"
                />
                <SelectField
                  label="Visibility"
                  value={prospectNoteForm.visibility}
                  onChange={(value) => setProspectNoteForm((current) => ({ ...current, visibility: value }))}
                  options={prospectNoteVisibilityOptions}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!prospectNoteForm.prospectId || !prospectNoteForm.body.trim()}
                >
                  <Send className="h-4 w-4" />
                  Save prospect note
                </button>
              </form>
            )}
          </SectionCard>

          <SectionCard
            title="Requirement remarks"
            description="Write remarks and transition notes on the requirement itself."
            icon={ClipboardList}
          >
            {!canWriteRequirementRemarks ? (
              <LockedActionState
                title="Requirement remarks are read-only for this role"
                description="This recruiter account can view requirements, but it cannot add or edit requirement remarks."
              />
            ) : (
              <form className="space-y-4" onSubmit={handleAddRequirementRemark}>
                <SelectField
                  label="Requirement"
                  required
                  value={requirementRemarkForm.requirementId}
                  onChange={(value) => setRequirementRemarkForm((current) => ({ ...current, requirementId: value }))}
                  options={requirementOptions}
                  placeholder="Choose a requirement"
                />
                <TextAreaField
                  label="Remark"
                  value={requirementRemarkForm.body}
                  onChange={(value) => setRequirementRemarkForm((current) => ({ ...current, body: value }))}
                  placeholder="Add a remark for the requirement"
                />
                <SelectField
                  label="Visibility"
                  value={requirementRemarkForm.visibility}
                  onChange={(value) => setRequirementRemarkForm((current) => ({ ...current, visibility: value }))}
                  options={requirementRemarkVisibilityOptions}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!requirementRemarkForm.requirementId || !requirementRemarkForm.body.trim()}
                >
                  <Send className="h-4 w-4" />
                  Save requirement remark
                </button>
              </form>
            )}
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Requirement status transitions"
            description="Move a requirement between open, closed, and cancelled using the version-guarded RPC."
            icon={BriefcaseBusiness}
          >
            {!canTransitionRequirements ? (
              <LockedActionState
                title="Requirement transitions are read-only for this role"
                description="This recruiter account can review requirements, but it cannot change requirement status."
              />
            ) : (
              <form className="space-y-4" onSubmit={handleTransitionRequirement}>
                <SelectField
                  label="Requirement"
                  required
                  value={requirementTransitionForm.requirementId}
                  onChange={(value) => {
                    const selected = requirements.find((requirement) => requirement.id === value)
                    setRequirementTransitionForm((current) => ({
                      ...current,
                      requirementId: value,
                      expectedVersion: String(selected?.version || ''),
                    }))
                  }}
                  options={requirementOptions}
                  placeholder="Choose a requirement"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="New status"
                    required
                    value={requirementTransitionForm.newStatus}
                    onChange={(value) => setRequirementTransitionForm((current) => ({ ...current, newStatus: value }))}
                    options={REQUIREMENT_STATUS_OPTIONS}
                  />
                  <TextField
                    label="Expected version"
                    required
                    type="number"
                    value={requirementTransitionForm.expectedVersion}
                    onChange={(value) => setRequirementTransitionForm((current) => ({ ...current, expectedVersion: value }))}
                    placeholder="Version guard"
                  />
                </div>
                <TextField
                  label="Closure reason"
                  value={requirementTransitionForm.closureReason}
                  onChange={(value) => setRequirementTransitionForm((current) => ({ ...current, closureReason: value }))}
                  placeholder="Required when cancelling a requirement"
                />
                <TextAreaField
                  label="Transition note"
                  value={requirementTransitionForm.noteBody}
                  onChange={(value) => setRequirementTransitionForm((current) => ({ ...current, noteBody: value }))}
                  placeholder="Optional note to store alongside the transition"
                />
                <SelectField
                  label="Note visibility"
                  value={requirementTransitionForm.noteVisibility}
                  onChange={(value) => setRequirementTransitionForm((current) => ({ ...current, noteVisibility: value }))}
                  options={requirementRemarkVisibilityOptions}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!requirementTransitionForm.requirementId || !requirementTransitionForm.expectedVersion || !requirementTransitionForm.newStatus}
                >
                  <ArrowRight className="h-4 w-4" />
                  Transition requirement
                </button>
              </form>
            )}
          </SectionCard>

          <SectionCard
            title="Junction status transitions"
            description="Advance or withdraw the shortlist link between a prospect and a requirement."
            icon={ClipboardList}
          >
            {!canTransitionJunctions ? (
              <LockedActionState
                title="Junction transitions are read-only for this role"
                description="This recruiter account can review shortlist links, but it cannot advance or withdraw them."
              />
            ) : (
              <form className="space-y-4" onSubmit={handleTransitionJunction}>
                <SelectField
                  label="Prospect-requirement link"
                  required
                  value={junctionTransitionForm.prospectRequirementId}
                  onChange={(value) => {
                    const selected = junctions.find((junction) => junction.id === value)
                    setJunctionTransitionForm((current) => ({
                      ...current,
                      prospectRequirementId: value,
                      expectedVersion: String(selected?.version || ''),
                    }))
                  }}
                  options={junctionOptions}
                  placeholder="Choose a junction"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="New status"
                    required
                    value={junctionTransitionForm.newStatus}
                    onChange={(value) => setJunctionTransitionForm((current) => ({ ...current, newStatus: value }))}
                    options={JUNCTION_STATUS_OPTIONS}
                  />
                  <TextField
                    label="Expected version"
                    required
                    type="number"
                    value={junctionTransitionForm.expectedVersion}
                    onChange={(value) => setJunctionTransitionForm((current) => ({ ...current, expectedVersion: value }))}
                    placeholder="Version guard"
                  />
                </div>
                <TextField
                  label="Withdrawal reason"
                  value={junctionTransitionForm.withdrawalReason}
                  onChange={(value) => setJunctionTransitionForm((current) => ({ ...current, withdrawalReason: value }))}
                  placeholder="Required when withdrawing a junction"
                />
                <TextAreaField
                  label="Transition note"
                  value={junctionTransitionForm.noteBody}
                  onChange={(value) => setJunctionTransitionForm((current) => ({ ...current, noteBody: value }))}
                  placeholder="Optional note to store alongside the junction transition"
                />
                <SelectField
                  label="Note visibility"
                  value={junctionTransitionForm.noteVisibility}
                  onChange={(value) => setJunctionTransitionForm((current) => ({ ...current, noteVisibility: value }))}
                  options={requirementRemarkVisibilityOptions}
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!junctionTransitionForm.prospectRequirementId || !junctionTransitionForm.expectedVersion || !junctionTransitionForm.newStatus}
                >
                  <ArrowRight className="h-4 w-4" />
                  Transition junction
                </button>
              </form>
            )}
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <SectionCard
            title="Recent prospects"
            description="Quick access to the latest loaded prospects."
            icon={Users}
            className="xl:col-span-1"
          >
            <div className="space-y-3">
              {prospects.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No prospects loaded"
                  description="Create the first prospect or refresh the workspace after deployment."
                />
              ) : prospects.map((prospect) => (
                <div key={prospect.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{prospect.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{prospect.email}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Nationality: {countryNameById.get(prospect.nationality_id) || prospect.nationality_id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Rank: {rankNameById.get(prospect.rank_applied_for_id) || prospect.rank_applied_for_id}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(prospect.status)}`}>
                      {prospect.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canWriteProspectNotes ? (
                      <button
                        type="button"
                        onClick={() => setProspectNoteForm((current) => ({ ...current, prospectId: prospect.id }))}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Note
                      </button>
                    ) : null}
                    {canAttachProspectsToRequirements ? (
                      <button
                        type="button"
                        onClick={() => setAttachForm((current) => ({ ...current, prospectId: prospect.id }))}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Attach
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent requirements"
            description="Latest requirement rows and quick prefill actions."
            icon={BriefcaseBusiness}
            className="xl:col-span-1"
          >
            <div className="space-y-3">
              {requirements.length === 0 ? (
                <EmptyState
                  icon={BriefcaseBusiness}
                  title="No requirements loaded"
                  description="Open requirements will appear here once the schema is deployed."
                />
              ) : requirements.map((requirement) => (
                <div key={requirement.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{requirement.req_id_display}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {requirement.customer_name || 'No customer name'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Vessel: {requirement.vessel_name || vesselTypeNameById.get(requirement.vessel_type_id) || requirement.vessel_type_id}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Opened: {formatTimestamp(requirement.created_at)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(requirement.status)}`}>
                      {requirement.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canWriteRequirementRemarks ? (
                      <button
                        type="button"
                        onClick={() => setRequirementRemarkForm((current) => ({ ...current, requirementId: requirement.id }))}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Remark
                      </button>
                    ) : null}
                    {canTransitionRequirements ? (
                      <button
                        type="button"
                        onClick={() => setRequirementTransitionForm((current) => ({
                          ...current,
                          requirementId: requirement.id,
                          expectedVersion: String(requirement.version || ''),
                        }))}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Transition
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent junctions"
            description="Latest shortlist links and their current workflow state."
            icon={ClipboardList}
            className="xl:col-span-1"
          >
            <div className="space-y-3">
              {junctions.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No junctions loaded"
                  description="Create or attach a prospect to populate the workflow list."
                />
              ) : junctions.map((junction) => {
                const prospect = prospects.find((item) => item.id === junction.prospect_id)
                const requirement = requirements.find((item) => item.id === junction.requirement_id)
                return (
                  <div key={junction.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {prospect?.name || junction.prospect_id}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {requirement?.req_id_display || junction.requirement_id}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Created: {formatTimestamp(junction.created_at)}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(junction.status)}`}>
                        {junction.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canTransitionJunctions ? (
                        <button
                          type="button"
                          onClick={() => setJunctionTransitionForm((current) => ({
                            ...current,
                            prospectRequirementId: junction.id,
                            expectedVersion: String(junction.version || ''),
                          }))}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Transition
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-white/80 p-5 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
            <p>
              The new prospect-enrollment RPCs are wired into the recruiter console here. If a transition or note action fails, the server-side permission or version guard is usually the first thing to check.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
