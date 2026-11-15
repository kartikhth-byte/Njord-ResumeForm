/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import RecruiterTopbar from '../components/recruiter/RecruiterTopbar'
import { formatDisplayValue } from '../utils/formatUtils'
import InterviewSchedulingModal from '../components/InterviewSchedulingModal'
import ApplicationFilters from '../components/ApplicationFilters'
import Pagination from '../components/Pagination'
import PageHeader from '../components/ui/PageHeader'
import useRefreshOnFocus from '../hooks/useRefreshOnFocus'
import { buildApplicationCompliance } from '../utils/applicationCompliance'
import { applicationStatusLabel } from '../constants/applicationStatus'
import { loadApplicationDirectory } from '../services/applicationDirectoryService'
import { applicationPlacements, filterApplicationPlacements, groupApplicationPlacements, matchesLegacyApplicationStatus, readApplicationFilters } from '../utils/applicationDirectory'
import { workStage } from '../utils/recruitmentWorkspace'
import DirectoryNotes from '../components/recruiter/DirectoryNotes'
import { dateCell, latestRecordDate, recordDisplayId } from '../utils/directoryDisplay'

import { Building2, Ship, Loader2, SlidersHorizontal, RefreshCw } from 'lucide-react'

function normalizeCertificateGrade(value) {
  return (value || '').toString().trim().toLowerCase()
}

function getApplicationFields(appData = {}) {
  const section1 = appData.section1 || {}
  const section2 = appData.section2 || {}
  const section5 = appData.section5 || {}
  const section8 = appData.section8 || {}
  const section15 = appData.section15 || {}
  const section16 = appData.section16 || {}

  return {
    section1,
    section2,
    section5,
    section8,
    section15,
    section16,
    visas: Array.isArray(section5.visas) ? section5.visas : [],
    certificates: Array.isArray(section8.certificates) ? section8.certificates : [],
    endorsements: Array.isArray(section15.endorsements) ? section15.endorsements : [],
    seaService: Array.isArray(section16.seaService) ? section16.seaService : []
  }
}

const COMPLIANCE_STYLES = {
  red: 'bg-danger-soft text-danger border-danger-line',
  amber: 'bg-warning-soft text-warning border-warning-line',
  green: 'bg-success-soft text-success border-success-line',
}

function complianceLabel(status) {
  return ({red: 'Action needed', amber: 'Check details', green: 'Checks clear'})[status] || 'Not checked'
}

function ComplianceBadge({ status, summary }) {
  const reason = summary && (summary.red || summary.amber)
    ? `${summary.red ? `${summary.red} action needed` : ''}${summary.red && summary.amber ? ' · ' : ''}${summary.amber ? `${summary.amber} to review` : ''}`
    : ''
  return (
    <div className="space-y-1"><span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${COMPLIANCE_STYLES[status] || 'bg-raised text-fg-secondary border-line'}`}>
      {complianceLabel(status)}
    </span>{reason && <p className="text-xs text-fg-secondary">{reason}</p>}</div>
  )
}

export default function RecruiterApplications() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, signOut } = useAuth()
  const { canViewApplications, canManageApplications, loading: permLoading, role } = usePermissions()
  const canEditApplications = canManageApplications()

  const [applications, setApplications] = useState([])
  const [autoOpenInterviewForApp, setAutoOpenInterviewForApp] = useState(null)

  const [loading, setLoading] = useState(true)
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [context, setContext] = useState({ cases: [], requirements: [], companies: [], ships: [] })
  const appliedFilterKey = searchParams.get('filters') || ''
  const appliedFilters = readApplicationFilters(appliedFilterKey)
  const [filters, setFilters] = useState(() => readApplicationFilters(appliedFilterKey))
  useEffect(() => { setFilters(readApplicationFilters(appliedFilterKey)) }, [appliedFilterKey])
  const [showFilters, setShowFilters] = useState(false)
  const request = useRef(0)
  const pendingParams = useRef(searchParams)
  useLayoutEffect(() => { pendingParams.current = searchParams }, [searchParams])
  const setParam = (key, value) => {
    const next = new URLSearchParams(pendingParams.current)
    value ? next.set(key, value) : next.delete(key)
    if (key === 'company') { next.delete('ship'); next.delete('requirement') }
    if (key === 'ship') next.delete('requirement')
    pendingParams.current = next
    setSearchParams(next, { replace: true })
  }
  const searchTerm = searchParams.get('q') || ''
  const complianceFilter = searchParams.get('checks') || 'all'
  const statusFilter = searchParams.get('status') || ''

  // Preserve an in-flight Teams return from the older application workflow.
  // Normal list rows now open Recruitment for stage/task work.
  useEffect(() => {
    if (loading || loadError || searchParams.get('teams_connected') !== 'true') return
    const id = localStorage.getItem('reopen_interview_modal')
    const app = applications.find(a => a.id === id)
    if (canEditApplications && app?.status === 'test_passed') setAutoOpenInterviewForApp(app)
    localStorage.removeItem('reopen_interview_modal')
    setParam('teams_connected', '')
  }, [loading, loadError, applications, searchParams, canEditApplications])

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [notesByApplication, setNotesByApplication] = useState({})
  const [noteApplication, setNoteApplication] = useState(null)
  const [noteRevision, setNoteRevision] = useState(0)

  useEffect(() => {
    const ids = [...new Set(applications.map((app) => app.id).filter(Boolean))]
    if (ids.length === 0) {
      setNotesByApplication({})
      return undefined
    }
    let cancelled = false
    Promise.all(Array.from({length:Math.ceil(ids.length/100)},(_,index)=>supabase
      .from('directory_notes')
      .select('application_id,body,created_at')
      .in('application_id', ids.slice(index*100,index*100+100))
      .order('created_at', { ascending: false })
      .limit(500))).then(results => {
        if (cancelled) return
        const map = {}
        for (const result of results) for (const note of result.data || []) if (!map[note.application_id]) map[note.application_id] = note
        setNotesByApplication(map)
      })
    return () => {
      cancelled = true
    }
  }, [applications, noteRevision])
  
  useEffect(() => {
    if (!permLoading && canViewApplications()) {
      loadApplications(readApplicationFilters(appliedFilterKey))
    }
    return () => { request.current += 1 }
  }, [permLoading, user?.id, appliedFilterKey])

  useEffect(() => { setCurrentPage(1) }, [searchParams, applications])

  const calculateExperience = (seaService) => {
    if (!seaService || seaService.length === 0) return 0
    let totalDays = 0
    seaService.forEach(service => {
      if (service.signOnDate && service.signOffDate) {
        const signOn = new Date(service.signOnDate)
        const signOff = new Date(service.signOffDate)
        const days = Math.floor((signOff - signOn) / (1000 * 60 * 60 * 24))
        totalDays += days
      }
    })
    return Math.floor(totalDays / 365)
  }


  const matchesExperienceFilter = (years, filterValue) => {
    switch (filterValue) {
      case '0-2': return years >= 0 && years <= 2
      case '3-5': return years >= 3 && years <= 5
      case '6-10': return years >= 6 && years <= 10
      case '10+': return years >= 10
      default: return true
    }
  }

  const matchesAgeRange = (age, filterValue) => {
    const ageNum = parseInt(age)
    if (isNaN(ageNum)) return false
    switch (filterValue) {
      case '20-30': return ageNum >= 20 && ageNum <= 30
      case '31-40': return ageNum >= 31 && ageNum <= 40
      case '41-50': return ageNum >= 41 && ageNum <= 50
      case '50+': return ageNum >= 50
      default: return true
    }
  }

  const matchesAvailability = (availableFrom, filterValue) => {
    if (!availableFrom) return false
    const availDate = new Date(availableFrom)
    const today = new Date()
    const daysUntilAvailable = Math.floor((availDate - today) / (1000 * 60 * 60 * 24))
    switch (filterValue) {
      case 'now': return daysUntilAvailable <= 0
      case '30': return daysUntilAvailable <= 30
      case '60': return daysUntilAvailable <= 60
      case '90': return daysUntilAvailable <= 90
      default: return true
    }
  }

  const loadApplications = async (appliedFilters = {}, { background = false } = {}) => {
    const current = ++request.current
    setLoadError('')
    try {
      if (background) {
        setBackgroundRefreshing(true)
      } else {
        setLoading(true)
      }

      const snapshot = await loadApplicationDirectory(supabase, appliedFilters)
      if (current !== request.current) return
      const { applications: appsData, profiles: profilesData } = snapshot

      let formattedData = appsData.map(app => {
        const profile = profilesData.find(p => p.id === app.user_id)
        const section1 = app.application_data?.data?.section1 || {}
        const section2 = app.application_data?.data?.section2 || {}
        const section8 = app.application_data?.data?.section8 || {}
        const section16 = app.application_data?.data?.section16 || {}
        
        const fullName = [
          section2.firstName,
          section2.middleName,
          section2.surname
        ].filter(Boolean).join(' ').trim() || profile?.full_name || 'Unknown'
        
        const age = section2.dateOfBirth 
          ? Math.floor((new Date() - new Date(section2.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
          : null

        return {
          ...app,
          full_name: fullName,
          email: section2.email || profile?.email || '',
          phone: section2.phoneNumber || section2.phone || '',
          desired_rank: section1.appliedForRank || app.applied_rank || '',
          vessel_type: section1.vesselType || '',
          nationality: section2.nationality || '',
          age: age,
          experience_years: calculateExperience(section16.seaService),
          available_from: section1.availableFrom || '',
          last_vessel: section16.seaService?.[0]?.vesselName || '',
          last_rank: section16.seaService?.[0]?.rankHeld || '',
          coc_number: section8.certificates?.[0]?.certificateNumber || '',
          coc_issuing_country: section8.certificates?.[0]?.issuingAuthority || '',
          compliance: buildApplicationCompliance(app.application_data?.data || {}),
        }
      }).map((app) => ({
        ...app,
        compliance_status: app.compliance?.overallStatus || '',
        compliance_summary: app.compliance?.summary || null,
      }))

      // Apply client-side filters
      if (appliedFilters.nationality) {
        formattedData = formattedData.filter(app => app.nationality === appliedFilters.nationality)
      }
      if (appliedFilters.vesselType) {
        formattedData = formattedData.filter(app => app.vessel_type === appliedFilters.vesselType)
      }
      if (appliedFilters.experienceRange) {
        formattedData = formattedData.filter(app => matchesExperienceFilter(app.experience_years, appliedFilters.experienceRange))
      }
      if (appliedFilters.ageRange) {
        formattedData = formattedData.filter(app => app.age !== null && matchesAgeRange(app.age, appliedFilters.ageRange))
      }
      if (appliedFilters.availability) {
        formattedData = formattedData.filter(app => app.available_from && matchesAvailability(app.available_from, appliedFilters.availability))
      }

            // Certificate Grade filter
      if (appliedFilters.certificateGrade) {
        formattedData = formattedData.filter(app => {
          const fields = getApplicationFields(app.application_data?.data)
          const selectedGrade = normalizeCertificateGrade(appliedFilters.certificateGrade)
          return fields.certificates.some(cert =>
            normalizeCertificateGrade(cert.grade) === selectedGrade
          )
        })
      }

      // Visa Type filter
      if (appliedFilters.visaType) {
        formattedData = formattedData.filter(app => {
          const fields = getApplicationFields(app.application_data?.data)
          return fields.visas.some(visa =>
            visa.type === appliedFilters.visaType
          )
        })
      }

      // Flag State filter
      if (appliedFilters.flagState) {
        formattedData = formattedData.filter(app => {
          const fields = getApplicationFields(app.application_data?.data)
          return fields.endorsements.some(endorsement =>
            endorsement.flagState === appliedFilters.flagState
          )
        })
      }

      if (current !== request.current) return
      setApplications(formattedData)
      setContext(snapshot)
    } catch (error) {
      if (current === request.current) setLoadError(error.message || 'Could not load applications.')
    } finally {
      if (current === request.current) {
        setBackgroundRefreshing(false)
        setLoading(false)
      }
    }
  }

const updateContractEndDate = async (applicationId, value) => {
  try {
    const { error: updateError } = await supabase
      .from('applications')
      .update({ contract_end_date: value || null })
      .eq('id', applicationId)
    if (updateError) throw updateError
    const patch = (rows) => rows.map((row) => (row.id === applicationId ? { ...row, contract_end_date: value || null } : row))
    setApplications(patch)
  } catch (contractError) {
    console.error('Failed to update contract end date:', contractError)
    alert(`Could not save the contract end date${contractError?.message ? `: ${contractError.message}` : ''}`)
  }
}

  const handleApplyFilters = (filtersToApply = null) => {
    const next = filtersToApply || filters
    const key = Object.keys(next).length ? JSON.stringify(next) : ''
    if (key === appliedFilterKey) loadApplications(next)
    else setParam('filters', key)
  }

  useRefreshOnFocus(() => loadApplications(appliedFilters, { background: true }), !permLoading && canViewApplications())

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-text" />
      </div>
    )
  }

  if (!canViewApplications()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-fg-secondary">You do not have permission to view applications.</p>
      </div>
    )
  }

  const placements = applicationPlacements(applications.filter(a => matchesLegacyApplicationStatus(a.status, statusFilter)), context)
  const filtered = filterApplicationPlacements(placements, { q: searchTerm, checks: complianceFilter, company: searchParams.get('company') || '', ship: searchParams.get('ship') || '', requirement: searchParams.get('requirement') || '' })
  // Saved tab URLs no longer hide forms. Missing links are data exceptions.
  const listed = filtered
  const uniqueIds = [...new Set(listed.map(r => r.application.id))]
  const totalPages = Math.max(1, Math.ceil(uniqueIds.length / itemsPerPage))
  const page = Math.min(currentPage, totalPages)
  const idsOnPage = new Set(uniqueIds.slice((page - 1) * itemsPerPage, page * itemsPerPage))
  const pageRows = listed.filter(r => idsOnPage.has(r.application.id))
  const groups = groupApplicationPlacements(pageRows.filter(r => r.links.length))
  const corrections = pageRows.filter(r => !r.links.length)
  let serial = (page - 1) * itemsPerPage
  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length
  const field = 'h-11 min-w-0 w-full rounded-control border border-line bg-surface px-3 text-sm'
  const label = 'flex min-w-0 flex-col gap-1.5 text-sm'
  const button = 'workspace-action-button workspace-action-button--secondary'
  const options = (rows, key, name) => [...new Map(rows.filter(r => r[key]).map(r => [r[key], r[name]])).entries()].sort((a,b) => a[1].localeCompare(b[1]))
  const companyOptions = options(placements, 'companyId', 'companyName')
  const shipScope = placements.filter(r => !searchParams.get('company') || r.companyId === searchParams.get('company'))
  const shipOptions = options(shipScope, 'shipId', 'shipName')
  const requirementScope = shipScope.filter(r => !searchParams.get('ship') || r.shipId === searchParams.get('ship')).flatMap(r => r.links)
  const requirementOptions = options(requirementScope, 'requirement_id', 'requirementName')
  const tableRows = rows => rows.map(({ id, application: app, links }) => <tr key={id} className={!links.length ? 'directory-row--issue' : ''} title={!links.length ? 'Recruitment link missing. Verify the original invitation before correcting it.' : undefined}>
      <td>{++serial}</td><td>{recordDisplayId(app, app.reference_number)}</td>
      <td><p className="font-medium">{app.full_name}</p><p className="text-xs text-fg-muted">{app.reference_number || '—'}</p></td>
      <td>{links.length ? <ul className="space-y-2">{links.map(link => <li key={link.id}><Link className="text-accent-text underline" to={`/recruiter/recruitment?case=${link.id}`}>{link.requirementName}</Link><p className="text-xs text-fg-muted">{workStage(link.status)}{link.cycle > 1 ? ` · Cycle ${link.cycle}` : ''}</p></li>)}</ul> : <span className="text-warning" tabIndex={0} role="note" aria-label="Recruitment link missing. Verify the original invitation before correcting it." title="Verify the original invitation before correcting this link.">⚠ Link missing</span>}</td>
      <td>{formatDisplayValue(app.desired_rank) || 'Rank not provided'}<p className="text-xs text-fg-muted">{formatDisplayValue(app.vessel_type) || 'Vessel type not provided'}</p></td>
      <td>{dateCell(app.submitted_at)}</td><td>{dateCell(app.created_at)}</td><td>{dateCell(latestRecordDate(app.updated_at, notesByApplication[app.id]?.created_at))}</td>
      <td><ComplianceBadge status={app.compliance_status} summary={app.compliance_summary} /></td>
      <td><button className="text-accent-text underline" onClick={() => setNoteApplication(app)}>{notesByApplication[app.id] ? <span title={notesByApplication[app.id].body}>{notesByApplication[app.id].body.slice(0,32)}{notesByApplication[app.id].body.length>32?'…':''}</span> : canEditApplications ? 'Add note' : 'View notes'}</button></td>
      <td><div className="flex flex-col items-start gap-2">{app.public_token ? <button title="View application" className="text-accent-text underline" onClick={() => navigate(`/application/view/${app.public_token}`, { state: { from: location.pathname + location.search } })}>View application</button> : <span className="text-sm text-fg-muted">Application unavailable</span>}
        {links.length === 1 && <Link className="text-accent-text underline" to={`/recruiter/recruitment?case=${links[0].id}`}>Open recruitment</Link>}
        {links.length > 1 && <span className="text-xs text-fg-muted">Choose a requirement to open recruitment.</span>}
        {canEditApplications && app.status === 'hired' && <label className="w-full min-w-0 text-xs text-fg-muted">Contract ends<input aria-label={`Contract ends for ${app.reference_number}`} type="date" className={`${field} mt-1`} value={app.contract_end_date || ''} onChange={event => updateContractEndDate(app.id,event.target.value)} /></label>}
      </div></td>
    </tr>)

  return <div className="recruiter-shell">
    <RecruiterTopbar user={user} profile={profile} role={role} signOut={signOut} />
    <div className="w-full min-w-0 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Applications" actions={<div className="flex flex-wrap gap-2"><button className={button} disabled={loading || backgroundRefreshing} onClick={() => loadApplications(appliedFilters,{background:true})}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</button><button className={button} aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal aria-hidden="true" className="h-4 w-4" />More filters{activeFilterCount ? ` (${activeFilterCount})` : ''}</button></div>} />
      <section aria-label="Application filters" className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className={label}>Search<input className={field} placeholder="Name or reference…" value={searchTerm} onChange={e => setParam('q',e.target.value)} /></label>
        <label className={label}>Company<select aria-label="Company" className={field} value={searchParams.get('company') || ''} onChange={e => setParam('company',e.target.value)}><option value="">All</option>{searchParams.get('company') && !companyOptions.some(([id]) => id === searchParams.get('company')) && <option value={searchParams.get('company')}>Unavailable selection</option>}{companyOptions.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className={label}>Ship<select aria-label="Ship" className={field} value={searchParams.get('ship') || ''} onChange={e => setParam('ship',e.target.value)}><option value="">All</option>{searchParams.get('ship') && !shipOptions.some(([id]) => id === searchParams.get('ship')) && <option value={searchParams.get('ship')}>Unavailable selection</option>}{shipOptions.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className={label}>Requirement<select aria-label="Requirement" className={field} value={searchParams.get('requirement') || ''} onChange={e => setParam('requirement',e.target.value)}><option value="">All</option>{searchParams.get('requirement') && !requirementOptions.some(([id]) => id === searchParams.get('requirement')) && <option value={searchParams.get('requirement')}>Unavailable selection</option>}{requirementOptions.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className={label}>Document checks<select aria-label="Document checks" className={field} value={complianceFilter} onChange={e => setParam('checks',e.target.value==='all'?'':e.target.value)}><option value="all">All</option>{['red','amber','green'].map(value => <option key={value} value={value}>{complianceLabel(value)}</option>)}</select></label>
      </section>
      {statusFilter && <p className="text-sm text-fg-muted">Saved status filter: {applicationStatusLabel(statusFilter)} <button className="underline text-accent-text" onClick={() => setParam('status','')}>Clear status filter</button></p>}
      {showFilters && <ApplicationFilters dateLabel="Submitted date" applyLabel="Apply filters" activeFilters={filters} onFilterChange={setFilters} onApplyFilters={handleApplyFilters} />}
      {loadError ? <div role="alert" className="recruiter-panel p-5"><p>Could not load applications and their recruitment links. {loadError}</p><button className={`${button} mt-3`} onClick={() => loadApplications(appliedFilters)}>Retry</button></div> : loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Loading applications…</p> : <>
        <p className="text-sm text-fg-muted" role="status">{uniqueIds.length} submitted {uniqueIds.length===1?'application matches':'applications match'} these filters.{backgroundRefreshing ? ' Refreshing…' : ''}</p>
        <section key={`${searchParams}:${page}`} aria-label="Applications by company and ship" tabIndex={0} className="tracker-table-wrap"><table className="tracker-table min-w-[1450px]">
          <thead><tr>{['S.No.','Application ID','Candidate','Requirement ID','Applied for','Submitted','Created','Modified','Document checks','Notes','Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{groups.flatMap(company => [
            <tr key={`company:${company.id}`} className="bg-accent-soft"><td colSpan={11} className="font-semibold"><Building2 aria-hidden="true" className="mr-2 inline h-4 w-4" />{company.name}</td></tr>,
            ...company.ships.flatMap(ship => [
              <tr key={`ship:${ship.id}`} className="bg-raised"><td colSpan={11} className="font-medium"><Ship aria-hidden="true" className="mr-2 inline h-4 w-4" />{ship.name}</td></tr>,
              ...tableRows(ship.rows)
            ])
          ])}{tableRows(corrections)}</tbody>
        </table>{!listed.length && <p className="p-5 text-sm text-fg-muted">No submitted applications match. <button className="text-accent-text underline" onClick={() => { setSearchParams({}); setFilters({}) }}>Clear filters</button></p>}</section>
        {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} totalItems={uniqueIds.length} />}
      </>}
      {autoOpenInterviewForApp && canEditApplications && <InterviewSchedulingModal application={autoOpenInterviewForApp} onCancel={() => setAutoOpenInterviewForApp(null)} onScheduled={() => {setAutoOpenInterviewForApp(null);loadApplications(appliedFilters,{background:true})}} />}
      {noteApplication && <DirectoryNotes kind="application" id={noteApplication.id} label={recordDisplayId(noteApplication, noteApplication.reference_number)} canAdd={canEditApplications} onClose={() => setNoteApplication(null)} onSaved={() => setNoteRevision(value => value + 1)} />}
    </div>
  </div>
}
