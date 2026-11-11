import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import FleetRequirementFilter from '../components/recruiter/FleetRequirementFilter'
import useClientFleet from '../hooks/useClientFleet'
import CandidateBasicForm from '../components/recruiter/CandidateBasicForm'
import CandidateAttachmentDialog from '../components/recruiter/CandidateAttachmentDialog'
import CandidateDirectoryRows from '../components/recruiter/CandidateDirectoryRows'
import { candidateAttachmentState, matchingCandidateLinks } from '../utils/candidateDirectory'
import { supabase } from '../lib/supabase'
import ResumeIntakeQueue from '../components/recruiter/ResumeIntakeQueue'
import { resumeIntakeEnabled, RESUME_INTAKE_HOLD } from '../lib/resumeIntake'
import CandidateForm from '../components/recruiter/CandidateForm'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import useKpiTrackerData from '../hooks/useKpiTrackerData'
import {
  buildCandidateFunnelRows,
  FUNNEL_STAGES,
  localDayString,
  workingRecruiters,
} from '../utils/kpiTracker'
import { downloadCsvReport, logRecruiterExport } from '../services/recruiterReportExportService'
import {
  Download,
  Loader2,
  Plus,
  RefreshCcw,
  Users,
} from 'lucide-react'

const VIEW_FILTERS = [
  { value: 'active', label: 'In process' },
  { value: 'current', label: 'Current candidates' },
  { value: 'joined', label: 'Joined' },
  { value: 'closed', label: 'Rejected / Withdrawn' },
  { value: 'archived', label: 'Archived' },
  { value: 'resume_missing', label: 'Résumé missing' },
  { value: 'all', label: 'All' },
]

export default function RecruiterCandidatesPage() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const setParam = (key, value) => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab',tab); next.set('history',history); if (value) next.set(key, value); else next.delete(key); return next }, {replace: true})
  // Legacy KPI drill-downs include both attached and unattached people.
  const tab = params.get('tab') || (params.get('requirement') || ['active','joined','closed'].includes(params.get('view')) ? 'attached' : params.get('view') === 'all' ? 'all' : 'unattached')
  const history = params.get('history') || (params.get('requirement') || ['joined','closed','archived'].includes(params.get('view')) ? 'all' : 'active')
  const { user, profile, signOut } = useAuth()
  const { role, loading: permLoading, canExportData, hasPermission } = usePermissions()
  const canCreateCandidates = hasPermission('create_prospects')
  const canAttachCandidates = hasPermission('edit_junction_status')
  const canEditCandidates = hasPermission('edit_prospects')
  const [basicForm, setBasicForm] = useState(null)
  const [attachCandidate, setAttachCandidate] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [draftError, setDraftError] = useState('')
  const [resumeStates, setResumeStates] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [reviewResume,setReviewResume]=useState(null)
  const [leadForm,setLeadForm]=useState({})
  const [intakeRevision,setIntakeRevision]=useState(0)
  const fleetFilter = Object.fromEntries(['company','ship','requirement','caseStage'].map(key => [key === 'caseStage' ? 'stage' : key, params.get(key) || '']))
  const setFleetFilter = value => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab',tab); next.set('history',history); for (const [key, item] of Object.entries(value)) { const name = key === 'stage' ? 'caseStage' : key; if (item) next.set(name,item); else next.delete(name) } return next }, {replace:true})
  const [notice, setNotice] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(() => ['company','ship','requirement','caseStage','stage','recruiter','from','to','rank'].some(key => params.has(key)))
  const rankFilter = params.get('rank') || ''
  const fleet = useClientFleet({ includeArchived: true, enabled: !permLoading })
  const tracker = useKpiTrackerData({ enabled: !permLoading })
  const createButton = useRef(null)
  const restoreCreateFocus = useRef(false)
  useEffect(() => {
    if (!tracker.loading && restoreCreateFocus.current) {
      createButton.current?.focus()
      restoreCreateFocus.current = false
    }
  }, [tracker.loading])

  // URL state survives profile navigation, reload and browser Back.
  const viewFilter = params.get('view') === 'unattached' ? 'current' : params.get('view') || 'current'
  const setViewFilter = value => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab',tab); next.set('view',value); next.set('history',['joined','closed','archived','all'].includes(value) ? 'all' : history); return next }, {replace:true})
  const stageFilter = params.get('stage') || ''
  const setStageFilter = value => setParam('stage', value)
  const recruiterFilter = params.get('recruiter') || ''
  const setRecruiterFilter = value => setParam('recruiter', value)
  const search = params.get('q') || ''
  const setSearch = value => setParam('q', value)
  const dateFrom = params.get('from') || ''
  const setDateFrom = value => setParam('from', value)
  const dateTo = params.get('to') || ''
  const setDateTo = value => setParam('to', value)
  useEffect(() => {
    if (permLoading) return
    let active = true
    const load = async () => {
      const rows = []
      for (let start = 0; ; start += 1000) {
        const {data,error} = await supabase.rpc('list_candidate_drafts').range(start,start+999)
        if (!active) return
        if (error) {setDraftError('Candidates without CVs could not be loaded. Refresh to try again.'); return}
        rows.push(...(data || []))
        if ((data || []).length < 1000) break
      }
      setDrafts(rows);setDraftError('')
    }
    void load()
    return () => { active = false }
  }, [permLoading, intakeRevision, tracker.data])
  const saved = message => { if (attachCandidate || (basicForm && !basicForm.id)) setParams({tab:attachCandidate ? 'attached' : 'unattached',view:'current'},{replace:true}); setBasicForm(null); setAttachCandidate(null); setShowForm(false); setNotice(message); setIntakeRevision(n => n + 1); restoreCreateFocus.current = true; tracker.reload() }
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const candidateRows = useMemo(() => buildCandidateFunnelRows({
    ...tracker.data,
    notes: tracker.data.prospectNotes,
  }), [tracker.data])

  useEffect(() => {
    let active = true
    const ids = [...new Set(candidateRows.map(row => row.needle_resume_id).filter(Boolean))]
    const load = async () => {
      const states = {}
      for (let i = 0; i < ids.length; i += 100) {
        const {data,error} = await supabase.from('needle_resume_registry').select('resume_id,status,original_available').in('resume_id',ids.slice(i,i+100))
        if (error) break
        for (const row of data || []) states[row.resume_id] = row
      }
      if (active) setResumeStates(states)
    }
    void load()
    return () => { active = false }
  }, [candidateRows])

  const rows = useMemo(() => [...candidateRows.map(row => ({...row,cvStatus:resumeStates[row.needle_resume_id]})), ...drafts.map(row => ({...row, isDraft:true, created_by_recruiter_id:row.created_by, requirementCount:0, attachedRequirements:[], stage:'Unattached'}))], [candidateRows,drafts,resumeStates])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (tab === 'unattached' && candidateAttachmentState(row) !== 'unattached') return false
      if (tab === 'attached' && !matchingCandidateLinks(row, fleetFilter, history).length) return false
      if (viewFilter === 'current' && row.isArchived) return false
      if (viewFilter === 'resume_missing' && (row.needle_resume_id || row.isArchived)) return false
      if (viewFilter === 'active' && (row.isArchived || candidateAttachmentState(row) !== 'attached')) return false
      if (viewFilter === 'joined' && !(row.hasJoined && !row.isArchived)) return false
      if (viewFilter === 'closed' && !(candidateAttachmentState(row) === 'unattached' && row.requirementCount>0 && !row.hasJoined && !row.isArchived)) return false
      if (viewFilter === 'archived' && !row.isArchived) return false
      if (rankFilter && row.rank_applied_for_id !== rankFilter) return false
      if (stageFilter && row.stage !== stageFilter) return false
      if (recruiterFilter && row.created_by_recruiter_id !== recruiterFilter) return false
      const contactedDay = localDayString(row.contactedAt)
      if (dateFrom && (!contactedDay || contactedDay < dateFrom)) return false
      if (dateTo && (!contactedDay || contactedDay > dateTo)) return false
      if (query) {
        const haystack = [row.name, row.email, row.telephone, row.rankName, row.vesselTypeName, row.requirementLabel, row.recruiterName, ...(row.attachedRequirements || []).flatMap(link => [link.requirement?.req_id_display, link.requirement?.customer_name, link.requirement?.vessel_name, fleet.companies.find(c => c.id === link.requirement?.company_id)?.name, fleet.ships.find(s => s.id === link.requirement?.ship_id)?.name])]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [rows, viewFilter, stageFilter, recruiterFilter, search, dateFrom, dateTo, fleetFilter, fleet.companies, fleet.ships, tab, history, rankFilter])

  const tabCounts = {unattached: rows.filter(row => !row.isArchived && candidateAttachmentState(row) === 'unattached').length, attached: rows.filter(row => !row.isArchived && candidateAttachmentState(row) === 'attached').length}

  const exportCsv = async () => {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await runExport()
    } catch (error) {
      console.error('Candidate funnel export failed:', error)
      setExportError(error?.message || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const runExport = async () => {
    await logRecruiterExport({
      reportType: 'candidate_funnel',
      exportFormat: 'csv',
      rowIds: filteredRows.map((row) => row.id),
      rowCount: filteredRows.length,
      filters: { tab, history, fleetFilter, rankFilter, viewFilter, stageFilter, recruiterFilter, search, dateFrom, dateTo },
      notesIncluded: true,
    })
    await downloadCsvReport({
      filename: `candidate-funnel-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { label: 'Candidate Name', value: (row) => row.name },
        { label: 'Date Contacted', value: (row) => localDayString(row.contactedAt) },
        { label: 'Recruiter', value: (row) => row.recruiterName },
        { label: 'Requirements', value: (row) => matchingCandidateLinks(row, tab === 'attached' ? fleetFilter : {}, tab === 'attached' ? history : 'all').map(link => `${link.requirement?.req_id_display || 'Historical requirement'} (${link.stage})`).join('; ') },
        { label: 'Rank', value: (row) => row.rankName },
        { label: 'Vessel Type', value: (row) => row.vesselTypeName },
        { label: 'Current Stage', value: (row) => row.stage },
        { label: 'Date Joined', value: (row) => localDayString(row.joinedAt) },
        { label: 'Joined?', value: (row) => (row.hasJoined ? 'Yes' : 'No') },
        { label: 'Days to Join', value: (row) => (row.daysToJoin ?? '') },
        { label: 'In Active Pipeline?', value: (row) => (row.inActivePipeline ? 'Yes' : 'No') },
        { label: 'Cycle Completed?', value: (row) => (row.cycleCompleted ? 'Yes' : 'No') },
        { label: 'Notes', value: (row) => row.latestNote },
      ],
      rows: filteredRows,
    })
  }

  if (permLoading || tracker.loading) {
    return (
      <div className="min-h-screen bg-raised">
        <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-accent-text" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-raised">
      <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Candidates"
          actions={(
            <div className="flex flex-wrap gap-3">
              {canExportData() ? (
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-medium text-fg-secondary transition hover:bg-raised disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={tracker.reload}
                className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-medium text-fg-secondary transition hover:bg-raised"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              {canCreateCandidates ? (
                <button
                  ref={createButton}
                  type="button"
                  onClick={() => { setNotice(''); setBasicForm({}); setShowForm(false) }}
                  disabled={showForm || !!basicForm}
                  aria-expanded={!!basicForm}
                  className="inline-flex items-center gap-2 rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition hover:bg-accent-fill-hover disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add candidate
                </button>
              ) : null}
            </div>
          )}
        />

        {notice ? (
          <div role="status" className="mt-6 rounded-control border border-success-line bg-success-soft px-4 py-3 text-sm text-success">{notice}</div>
        ) : null}

        {canCreateCandidates && !resumeIntakeEnabled() && <p role="note" className="mt-4 rounded-control border border-warning-line bg-warning-soft p-3 text-sm text-warning">{RESUME_INTAKE_HOLD}</p>}
        {basicForm && <CandidateBasicForm key={basicForm.id || 'new'} candidate={basicForm.id ? basicForm : null} drafts={drafts} onSaved={saved} onCancel={() => setBasicForm(null)} onUpload={form => {setLeadForm(form);setReviewResume(null);setBasicForm(null);setShowForm(true)}}/>}
        {attachCandidate && <CandidateAttachmentDialog candidate={attachCandidate} requirements={tracker.data.requirements} fleet={fleet} onSaved={saved} onClose={() => setAttachCandidate(null)}/>}
        {canCreateCandidates && resumeIntakeEnabled() && <details className="mt-4"><summary className="cursor-pointer text-sm">CVs awaiting review</summary><ResumeIntakeQueue key={'intake'+intakeRevision} onReview={resume => {setBasicForm(null);setLeadForm({});setReviewResume(resume);setShowForm(true)}}/></details>}
        {showForm && resumeIntakeEnabled() ? (
          <section className="mt-5" aria-label="Add candidate CV">
            <CandidateForm key={reviewResume?.resume_version_id||leadForm.leadId||'new'} initialForm={reviewResume?{resume:reviewResume}:leadForm}
              ranks={tracker.data.ranks}
              vesselTypes={tracker.data.vesselTypes}
              recruiters={workingRecruiters(tracker.data.recruiters)}
              canChooseRecruiter={role === 'Master Recruiter'}
              requirementOptions={tracker.data.requirements
                .filter((row) => row.status === 'open' && row.location_reviewed_at && row.ship_id && !row.archived_at && !row.deleted_at)
                .map((row) => ({ value: row.id, label: `${row.req_id_display} · ${row.customer_name || 'No customer'}`, version: row.version, rankId: row.rank_id, vesselTypeId: row.vessel_type_id }))}
              currentRecruiterId={profile?.id || user?.id || ''}
              canAttach={canAttachCandidates}
              canSave={canCreateCandidates}
              onCancel={() => setShowForm(false)}
              onSaved={saved}
            />
          </section>
        ) : null}

        {exportError ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
            {exportError}
          </div>
        ) : null}

        {tracker.error ? (
          <div className="mt-6 rounded-control border border-danger-line bg-danger-soft px-5 py-6 text-sm text-danger">
            <p className="font-semibold">Could not load the candidate funnel.</p>
            <p className="mt-1">{tracker.error}</p>
            <button
              type="button"
              onClick={tracker.reload}
              className="mt-4 inline-flex items-center gap-2 rounded-control border border-danger-line bg-surface px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : (
        <>
        <div className="mt-6"><SegmentedControl options={[...(tab === 'all' ? [{value:'all',label:'All candidates'}] : []),{value:'unattached',label:'Unattached',count:tabCounts.unattached},{value:'attached',label:'Attached',count:tabCounts.attached}]} value={tab} onChange={value => setParams(previous => { const next = new URLSearchParams(previous); next.set('tab',value); ['company','ship','requirement','caseStage','stage','history'].forEach(key => next.delete(key)); next.set('view','current'); return next },{replace:true})}/></div>
        <p className="mt-2 text-xs text-fg-muted">Counts show unique current candidates. Unattached includes people with previous cases but no active attachment.</p>
        {draftError && <p role="alert" className="mt-4 text-danger">{draftError}</p>}
        <section className="recruiter-panel mt-6 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <label className="text-sm w-full min-w-0 sm:w-auto sm:flex-1"><span className="mb-1 block text-xs font-medium text-fg-muted">Search</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone, rank, requirement…" className="w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2"/></label>
            {tab === 'attached' && <label className="text-sm"><span className="mb-1 block text-xs text-fg-muted">Attachments</span><select className="rounded-control border border-line bg-surface p-2" value={history} onChange={e => setParam('history',e.target.value)}><option value="active">Active</option><option value="history">History</option><option value="all">Active and history</option></select></label>}
            <button className="workspace-action-button workspace-action-button--secondary" aria-expanded={filtersOpen} aria-controls="candidate-filters" onClick={() => setFiltersOpen(v => !v)}>Filters</button>
          </div>
          {filtersOpen && <section id="candidate-filters" className="mb-5 space-y-4 rounded-control border border-line p-4" aria-label="Candidate filters">
            {tab === 'attached' && <FleetRequirementFilter title="Company, ship and requirement" value={fleetFilter} onChange={setFleetFilter} requirements={tracker.data.requirements} cases/>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">Candidate status<select className="mt-1 block w-full rounded-control border border-line bg-surface p-2" value={viewFilter} onChange={e => setViewFilter(e.target.value)}>{VIEW_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="text-sm">Present rank<select className="mt-1 block w-full rounded-control border border-line bg-surface p-2" value={rankFilter} onChange={e => setParam('rank',e.target.value)}><option value="">All ranks</option>{tracker.data.ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <label className="text-sm">Recruiter<select className="mt-1 block w-full rounded-control border border-line bg-surface p-2" value={recruiterFilter} onChange={e => setRecruiterFilter(e.target.value)}><option value="">All recruiters</option>{workingRecruiters(tracker.data.recruiters).map(r => <option key={r.id} value={r.id}>{r.full_name || r.email}</option>)}</select></label>
              <label className="text-sm">Contacted from<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 block w-full min-w-0 rounded-control border border-line bg-surface p-2"/></label>
              <label className="text-sm">Contacted to<input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 block w-full min-w-0 rounded-control border border-line bg-surface p-2"/></label>
              {stageFilter && <label className="text-sm">Pipeline stage<select className="mt-1 block w-full rounded-control border border-line bg-surface p-2" value={stageFilter} onChange={e => setStageFilter(e.target.value)}><option value="">All stages</option>{FUNNEL_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select></label>}
            </div>
            <button type="button" className="text-sm underline" onClick={() => setParams({tab,history,view:'current'},{replace:true})}>Clear filters</button>
          </section>}

          {filteredRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No candidates match"
            />
          ) : (
            <CandidateDirectoryRows key={`${tab}:${search}:${JSON.stringify(fleetFilter)}:${history}`} rows={filteredRows} attached={tab === 'attached'} showAllLinks={tab === 'all'} fleet={fleet} filter={fleetFilter} history={history}
              from={`${location.pathname}${location.search}`} canEdit={canEditCandidates} canAttach={canAttachCandidates}
              onEdit={row => {setShowForm(false);setBasicForm(row);window.scrollTo({top:0,behavior:'smooth'})}} onAttach={setAttachCandidate} onError={setExportError}/>

          )}

          <p className="mt-4 text-xs text-fg-muted">
            {filteredRows.length} {filteredRows.length === 1 ? 'candidate' : 'candidates'} shown
          </p>
        </section>
        </>
        )}
      </main>
    </div>
  )
}
