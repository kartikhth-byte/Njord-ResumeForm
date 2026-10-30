/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/auth/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { downloadGeneratedWorksheet, getWorksheetExportReadiness, listWorksheetCustomers } from '../services/worksheetConfigService'
import { Loader2, AlertCircle, Printer, ArrowLeft, Mail, Phone, Anchor, BadgeCheck, BriefcaseBusiness, CalendarDays, FileSpreadsheet, Download, X } from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import RejectionHistory from '../components/recruiter/RejectionHistory'
import ReopenApplicationButton from '../components/recruiter/ReopenApplicationButton'
import ApplicationCompliancePanel from '../components/recruiter/ApplicationCompliancePanel'
import SequentialStatusControl from '../components/SequentialStatusControl'
import StatusBadge from '../components/StatusBadge'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import { buildApplicationCompliance, buildRequirementComplianceOverlay } from '../utils/applicationCompliance'
import { useTheme } from '../hooks/useThemeForRoute'

// Add this style tag to hide browser print headers/footers
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @page {
      margin: 0.5cm;
    }
    @media print {
      @page {
        margin-top: 0.5cm;
        margin-bottom: 0.5cm;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
  `
  document.head.appendChild(style)
}

export default function ViewApplication() {
  const { publicToken } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailAccessToken = searchParams.get('access')
  const { user, userType, loading: authLoading, authorizationLoading } = useAuth()
  useTheme(userType === 'recruiter' ? 'dark' : 'light')
  const { canExportData } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [error, setError] = useState(null)
  const [copiedRef, setCopiedRef] = useState(false)
  const [worksheetCustomers, setWorksheetCustomers] = useState([])
  const [selectedWorksheetCustomerId, setSelectedWorksheetCustomerId] = useState('')
  const [worksheetModalOpen, setWorksheetModalOpen] = useState(false)
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  const [worksheetError, setWorksheetError] = useState('')
  const [worksheetGenerating, setWorksheetGenerating] = useState(false)
  const [worksheetSuccess, setWorksheetSuccess] = useState('')
  const [linkedRequirement, setLinkedRequirement] = useState(null)
  const [linkedRequirementNationalities, setLinkedRequirementNationalities] = useState([])
  const worksheetModalCloseTimeoutRef = useRef(null)

  useEffect(() => {
    if (authLoading || (user && authorizationLoading && !userType)) return
    loadApplication()
  }, [publicToken, emailAccessToken, user?.id, userType, authLoading, authorizationLoading])

  const exportAllowed = userType === 'recruiter' && canExportData()

  const loadWorksheetCustomers = useCallback(async () => {
    if (!exportAllowed) return
    setWorksheetLoading(true)
    setWorksheetError('')
    try {
      const customers = await listWorksheetCustomers()
      setWorksheetCustomers(customers)
      setSelectedWorksheetCustomerId((current) => current || customers[0]?.id || '')
    } catch (loadError) {
      console.error('Failed to load worksheet customers:', loadError)
      setWorksheetError(loadError.message || 'Failed to load worksheet customers')
    } finally {
      setWorksheetLoading(false)
    }
  }, [exportAllowed])

  useEffect(() => {
    if (!worksheetModalOpen) return
    loadWorksheetCustomers()
  }, [worksheetModalOpen, loadWorksheetCustomers])

  useEffect(() => {
    if (!worksheetModalOpen) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [worksheetModalOpen])

  useEffect(() => {
    return () => {
      if (worksheetModalCloseTimeoutRef.current) {
        clearTimeout(worksheetModalCloseTimeoutRef.current)
      }
    }
  }, [])

  const loadApplication = async () => {
    try {
      setLoading(true)
      setError(null)

      const isAuthenticatedRecruiter = userType === 'recruiter'
      const isAuthenticatedApplicant = userType === 'applicant' && Boolean(user?.id)

      let appQuery = supabase
        .from('applications')
        .select('*, prospect_id')
        .eq('public_token', publicToken)
        .not('submitted_at', 'is', null)

      if (isAuthenticatedRecruiter) {
        // Recruiters already passed app auth and can view via the internal workspace.
      } else if (isAuthenticatedApplicant) {
        appQuery = appQuery.eq('user_id', user.id)
      } else if (emailAccessToken) {
        const encodedToken = new TextEncoder().encode(emailAccessToken)
        const digest = await crypto.subtle.digest('SHA-256', encodedToken)
        const accessTokenHash = Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')

        appQuery = appQuery
          .eq('review_access_token_hash', accessTokenHash)
          .gt('review_access_token_expires_at', new Date().toISOString())
      } else {
        setError('This application link is missing secure access credentials')
        return
      }

      const { data: app, error: appError } = await appQuery.single()

      if (appError) {
        setError('Application not found, expired, or not yet submitted')
        return
      }

      setApplication(app)
      setLinkedRequirement(null)
      setLinkedRequirementNationalities([])

      const { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('*')
        .eq('application_id', app.id)
        .single()

      if (dataError) {
        setError('Application data not found')
        return
      }

      setApplicationData(appData?.data || {})

      if (isAuthenticatedRecruiter && app.prospect_id) {
        const { data: prospectRow, error: prospectError } = await supabase
          .from('prospects')
          .select('id, name, status, nationality_id, rank_applied_for_id, vessel_type_id, email, telephone, lead_source, bounce_flag, first_contacted_at, invited_at, claimed_at')
          .eq('id', app.prospect_id)
          .maybeSingle()

        if (prospectError) {
          console.error('Failed to load linked prospect:', prospectError)
        } else if (prospectRow) {
          const { data: junctionRow, error: junctionError } = await supabase
            .from('prospect_requirements')
            .select('requirement_id, status, updated_at')
            .eq('prospect_id', prospectRow.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (junctionError) {
            console.error('Failed to load linked junction:', junctionError)
          } else if (junctionRow?.requirement_id) {
            const { data: requirementRow, error: requirementError } = await supabase
              .from('requirements')
              .select('id, req_id_display, customer_name, rank_id, vessel_type_id')
              .eq('id', junctionRow.requirement_id)
              .maybeSingle()

            if (requirementError) {
              console.error('Failed to load linked requirement:', requirementError)
            } else if (requirementRow) {
              setLinkedRequirement(requirementRow)

              const { data: nationalityRows, error: nationalityError } = await supabase
                .from('requirement_nationalities')
                .select('country_id, countries(id, code, name)')
                .eq('requirement_id', requirementRow.id)
              if (nationalityError) {
                console.error('Failed to load linked requirement nationalities:', nationalityError)
              } else {
                setLinkedRequirementNationalities((nationalityRows || []).map((row) => row.countries).filter(Boolean))
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading application:', error)
      setError('Failed to load application')
    } finally {
      setLoading(false)
    }
  }

  const refreshApplication = async () => {
    await loadApplication()
  }

  const handlePrint = () => {
    window.print()
  }

  const handleBack = () => {
    if (userType === 'applicant') {
      navigate('/dashboard')
      return
    }

    navigate(-1)
  }

  // Helper to parse JSON strings safely
  const parseJSON = (str) => {
    if (!str) return null
    if (typeof str === 'object') return str
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  // Helper to get photo URL from storage path
  const getPhotoUrl = (storagePath) => {
    if (!storagePath) return null
    
    // If it's already a full URL, return it
    if (storagePath.startsWith('http')) {
      return storagePath
    }
    
    // Otherwise, construct public URL from storage path
    const { data } = supabase.storage
      .from('application-photos')
      .getPublicUrl(storagePath)
    
    return data.publicUrl
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // Parse nextOfKin and emergencyContact
  const nextOfKin = parseJSON(applicationData?.section2?.nextOfKin)
  const emergencyContact = parseJSON(applicationData?.section2?.emergencyContact)
  const fullName = [applicationData?.section2?.firstName, applicationData?.section2?.middleName, applicationData?.section2?.surname]
    .filter(Boolean)
    .join(' ')
    .trim()
  const certificates = applicationData?.section8?.certificates || []
  const endorsements = applicationData?.section15?.endorsements || []
  const seaService = applicationData?.section16?.seaService || []
  const visas = applicationData?.section5?.visas || []
  const isApplicantView = userType === 'applicant'
  const isRecruiterView = userType === 'recruiter'
  const pageEyebrow = isApplicantView ? 'Application Summary' : 'Candidate Review'
  const pageDescription = isApplicantView
    ? 'Review the submitted details for your application and track the current recruitment status.'
    : 'Review candidate evidence, move the application through status changes, and keep context visible while making a hiring decision.'
  const summaryEyebrow = isApplicantView ? 'Application Summary' : 'Candidate Summary'
  const summaryCardTitle = isApplicantView ? 'Application snapshot' : 'Recruiter summary'
  const compliance = isRecruiterView ? buildApplicationCompliance(applicationData || {}) : null
  const summaryStats = [
    { label: 'Certificates', value: certificates.length, icon: BadgeCheck, tone: 'accent', hint: 'CoC entries on file.' },
    { label: 'Endorsements', value: endorsements.length, icon: Anchor, hint: 'Flag-state endorsements recorded.' },
    { label: 'Sea Service Entries', value: seaService.length, icon: BriefcaseBusiness, hint: 'Previous contracts and vessel experience.' },
    { label: 'Visas', value: visas.length, icon: CalendarDays, tone: 'warning', hint: 'Travel and port-entry documents.' }
  ]
  const selectedWorksheetCustomer = worksheetCustomers.find((customer) => customer.id === selectedWorksheetCustomerId) || null
  const worksheetReadiness = getWorksheetExportReadiness(selectedWorksheetCustomer)
  const requirementCompliance = linkedRequirement
    ? buildRequirementComplianceOverlay(applicationData || {}, linkedRequirement, linkedRequirementNationalities)
    : null

  const formatWorksheetTimestamp = (value) => {
    if (!value) return 'Unknown'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return date.toLocaleString()
  }

  const handleGenerateWorksheet = async () => {
    if (!selectedWorksheetCustomerId) return

    setWorksheetGenerating(true)
    setWorksheetError('')
    setWorksheetSuccess('')
    if (worksheetModalCloseTimeoutRef.current) {
      clearTimeout(worksheetModalCloseTimeoutRef.current)
      worksheetModalCloseTimeoutRef.current = null
    }
    try {
      const { fileName } = await downloadGeneratedWorksheet({
        applicationId: application.id,
        customerId: selectedWorksheetCustomerId,
      })
      setWorksheetSuccess(
        `Worksheet download started successfully for ${fileName}. Check your browser's default Downloads folder.`
      )
      worksheetModalCloseTimeoutRef.current = setTimeout(() => {
        setWorksheetModalOpen(false)
        setWorksheetSuccess('')
        worksheetModalCloseTimeoutRef.current = null
      }, 1800)
    } catch (generateError) {
      setWorksheetError(generateError.message || 'Failed to generate worksheet')
    } finally {
      setWorksheetGenerating(false)
    }
  }

  return (
    <div className={isApplicantView ? 'applicant-shell' : 'recruiter-shell'}>
      <div className="border-b border-gray-200/80 bg-white/80 shadow-sm backdrop-blur print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={handleBack}
                className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>

              <PageHeader
                eyebrow={pageEyebrow}
                title={fullName || 'Application View'}
                description={pageDescription}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {isRecruiterView && (application.status === 'rejected' || application.status === 'withdrawn') && (
                <ReopenApplicationButton application={application} onReopened={refreshApplication} />
              )}
              {exportAllowed && (
                <button
                  type="button"
                  onClick={() => setWorksheetModalOpen(true)}
                  className="workspace-action-button workspace-action-button--secondary"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Generate Worksheet
                </button>
              )}
              <button onClick={handlePrint} className="workspace-action-button workspace-action-button--secondary">
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {worksheetModalOpen ? (
        <div className="fixed inset-0 z-50 print:hidden">
          <div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
            onClick={() => !worksheetGenerating && setWorksheetModalOpen(false)}
          />

          <div className="absolute inset-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="flex min-h-full items-center justify-center">
              <div className="relative flex h-[min(88vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:px-7">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Customer Worksheet</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">Generate &amp; Download</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                      Use this to prepare customer worksheets at any application stage. Select the customer and download the
                      generated workbook once the template status is ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWorksheetModalOpen(false)}
                    disabled={worksheetGenerating}
                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-50/55 px-6 py-6 sm:px-7">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Application Status</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Current status: <span className="font-semibold text-slate-900">{formatDisplayValue(application.status)}</span>
                    </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <label className="text-sm font-medium text-slate-800">Customer</label>
                      <select
                        value={selectedWorksheetCustomerId}
                        onChange={(event) => setSelectedWorksheetCustomerId(event.target.value)}
                        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                        disabled={worksheetLoading || worksheetGenerating}
                      >
                        {worksheetCustomers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`rounded-2xl border px-4 py-3 text-sm ${
                      worksheetReadiness.ready
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}>
                      {worksheetLoading ? 'Loading customer worksheet settings...' : worksheetReadiness.message}
                    </div>

                    {selectedWorksheetCustomer ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template Details</p>
                        {worksheetReadiness.template ? (
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <p>
                              Active template: <span className="font-semibold text-slate-900">{worksheetReadiness.template.file_name}</span>
                            </p>
                            <p>
                              Uploaded: <span className="font-medium text-slate-900">{formatWorksheetTimestamp(worksheetReadiness.template.created_at)}</span>
                            </p>
                            <p className="text-xs leading-5 text-slate-500">
                              This export starts from a fresh copy of the uploaded template and overwrites mapped output cells with the current application data.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-600">
                            No active template is configured for this customer yet.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {worksheetGenerating ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="font-medium">Generating worksheet...</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-sky-700">
                          The template is being populated now. This can take a few seconds.
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
                          <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-sky-500" />
                        </div>
                      </div>
                    ) : null}

                    {worksheetSuccess ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {worksheetSuccess}
                      </div>
                    ) : null}

                    {worksheetError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <div className="flex items-start justify-between gap-3">
                          <span>{worksheetError}</span>
                          <button
                            type="button"
                            onClick={loadWorksheetCustomers}
                            className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:px-7">
                  <button
                    type="button"
                    onClick={() => setWorksheetModalOpen(false)}
                    disabled={worksheetGenerating}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateWorksheet}
                    disabled={!worksheetReadiness.ready || worksheetLoading || worksheetGenerating || !selectedWorksheetCustomerId}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {worksheetGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Generate Worksheet
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block bg-white p-8 border-b">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Njordships Maritime Recruitment</h1>
          <p className="text-gray-600">Seafarer Application</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 print:p-8 sm:px-6 lg:px-8">
        {isRecruiterView && <RejectionHistory application={application} />}
        
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6 print:hidden">
            <div className="recruiter-panel p-6 xl:sticky xl:top-6">
              <div className="flex items-start gap-4">
                {applicationData?.section2?.photoStoragePath ? (
                  <img
                    src={getPhotoUrl(applicationData.section2.photoStoragePath)}
                    alt={fullName}
                    className="h-20 w-20 rounded-2xl object-cover border border-gray-200 shadow-sm"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold tracking-wide text-gray-600">
                      {application.reference_number}
                    </span>
                    <StatusBadge status={application.status} />
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{fullName || 'Unnamed candidate'}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatDisplayValue(applicationData?.section1?.appliedForRank) || 'Rank not specified'} • {formatDisplayValue(applicationData?.section1?.vesselType) || 'Vessel preference not specified'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{applicationData?.section2?.email || 'No email provided'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{applicationData?.section2?.phoneNumber ? `+${applicationData?.section2?.phoneCountryCode || ''} ${applicationData?.section2?.phoneNumber}` : 'No phone provided'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <span>Available from {applicationData?.section1?.availableFrom || 'unknown date'}</span>
                </div>
              </div>

              {isRecruiterView ? (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Decision Actions</p>
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
                    <SequentialStatusControl
                      applicationId={application.id}
                      currentStatus={application.status}
                      onStatusChange={refreshApplication}
                      application={application}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Application Status</p>
                  <div className="mt-3">
                    <StatusBadge status={application.status} />
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3">
                {summaryStats.map(stat => (
                  <StatCard key={stat.label} {...stat} />
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">{summaryCardTitle}</p>
                <div className="mt-3 space-y-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>Nationality</span>
                    <span className="font-medium text-gray-900">{applicationData?.section2?.nationality || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Age</span>
                    <span className="font-medium text-gray-900">{applicationData?.section2?.age || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Submission date</span>
                    <span className="font-medium text-gray-900">
                      {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="recruiter-panel p-6 print:shadow-none print:border">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">{summaryEyebrow}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{fullName || 'Application view'}</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Submitted on {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'unknown date'} for {formatDisplayValue(applicationData?.section1?.appliedForRank) || 'an unspecified rank'}.
                  </p>
                </div>

                {application.reference_number ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Application Reference</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xl font-bold font-mono tracking-wider text-gray-900">{application.reference_number}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(application.reference_number)
                          setCopiedRef(true)
                          setTimeout(() => setCopiedRef(false), 2000)
                        }}
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                      >
                        {copiedRef ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-6">
          {isRecruiterView && compliance ? (
            <div className={`grid gap-6 ${requirementCompliance ? 'xl:grid-cols-2' : ''}`}>
              <ApplicationCompliancePanel
                compliance={compliance}
                eyebrow="Recruiter Compliance Review"
                title="Documents, training, and review flags"
                description="This is the general recruiter-side readiness pass based on the submitted application data."
              />
              {requirementCompliance ? (
                <ApplicationCompliancePanel
                  compliance={requirementCompliance}
                  eyebrow="Requirement Compliance Overlay"
                  title={`Application compared against ${requirementCompliance.metadata?.requirementSummary?.requirementDisplayId || 'the live requirement'}`}
                  description={`This overlay keeps the live candidate evidence visible beside the matching requirement${requirementCompliance.metadata?.requirementSummary?.customerName ? ` for ${requirementCompliance.metadata.requirementSummary.customerName}` : ''} so the recruiter can spot mismatches quickly.`}
                />
              ) : null}
            </div>
          ) : null}

          {/* Section 1: Availability & Position */}
          <ViewSection title="Availability & Position Applied For">
            <ViewRow label="Applied For Rank" value={formatDisplayValue(applicationData?.section1?.appliedForRank)} />
            <ViewRow label="Preferred Vessel Type" value={formatDisplayValue(applicationData?.section1?.vesselType)} />
            <ViewRow label="Available From" value={applicationData?.section1?.availableFrom} />
            <ViewRow label="Available Till" value={applicationData?.section1?.availableTill || 'Open'} />
            <ViewRow label="Recommended By" value={applicationData?.section1?.recommendedBy} />
            {applicationData?.section1?.mediaAdvertisement && (
              <ViewRow label="Found Via Advertisement" value={applicationData.section1.mediaAdvertisementDetails || 'Yes'} />
            )}
            {applicationData?.section1?.professionalRecommendation && (
              <ViewRow label="Professional Recommendation" value="Yes" />
            )}
          </ViewSection>

          {/* Section 2: Personal & Contact Details */}
          <ViewSection title="Personal & Contact Details">
            <ViewRow label="Full Name" value={`${applicationData?.section2?.firstName || ''} ${applicationData?.section2?.middleName || ''} ${applicationData?.section2?.surname || ''}`} />
            {applicationData?.section2?.knownAs && <ViewRow label="Known As" value={applicationData.section2.knownAs} />}
            {applicationData?.section2?.otherNames && <ViewRow label="Other Names" value={applicationData.section2.otherNames} />}
            <ViewRow label="Date of Birth" value={applicationData?.section2?.dateOfBirth} />
            <ViewRow label="Age" value={applicationData?.section2?.age} />
            <ViewRow label="Gender" value={applicationData?.section2?.gender} />
            <ViewRow label="Nationality" value={applicationData?.section2?.nationality} />
            <ViewRow label="Place of Birth" value={applicationData?.section2?.placeOfBirth} />
            <ViewRow label="Marital Status" value={applicationData?.section2?.maritalStatus} />
            <ViewRow label="Email" value={applicationData?.section2?.email} />
            <ViewRow label="Phone" value={`+${applicationData?.section2?.phoneCountryCode || ''} ${applicationData?.section2?.phoneNumber || ''}`} />
            <ViewRow label="Address" value={applicationData?.section2?.address} />
            <ViewRow label="City" value={applicationData?.section2?.city} />
            <ViewRow label="State" value={applicationData?.section2?.state} />
            <ViewRow label="Country" value={applicationData?.section2?.country} />
            <ViewRow label="Postal Code" value={applicationData?.section2?.postalCode} />
            {applicationData?.section2?.domesticAirport && <ViewRow label="Nearest Domestic Airport" value={applicationData.section2.domesticAirport} />}
            {applicationData?.section2?.internationalAirport && <ViewRow label="Nearest International Airport" value={applicationData.section2.internationalAirport} />}
            
            {/* Emergency Contact - Parsed from JSON */}
            {emergencyContact && (
              <div className="mt-6 pt-6 border-t">
                <p className="font-semibold text-gray-900 mb-3">Emergency Contact</p>
                <div className="space-y-2">
                  <ViewRow label="Name" value={emergencyContact.name} />
                  <ViewRow label="Relationship" value={emergencyContact.relationship} />
                  <ViewRow label="Phone" value={emergencyContact.phone} />
                  {emergencyContact.mobile && <ViewRow label="Mobile" value={emergencyContact.mobile} />}
                  <ViewRow label="Address" value={emergencyContact.address} />
                </div>
              </div>
            )}

            {/* Next of Kin - Parsed from JSON */}
            {nextOfKin && (
              <div className="mt-6 pt-6 border-t">
                <p className="font-semibold text-gray-900 mb-3">Next of Kin</p>
                <div className="space-y-2">
                  <ViewRow label="Name" value={nextOfKin.name} />
                  <ViewRow label="Relationship" value={nextOfKin.relationship} />
                  {nextOfKin.phone && <ViewRow label="Phone" value={nextOfKin.phone} />}
                  {nextOfKin.address && <ViewRow label="Address" value={nextOfKin.address} />}
                </div>
              </div>
            )}
          </ViewSection>

          {/* Section 3: Passport */}
          <ViewSection title="Passport Details">
            <ViewRow label="Passport Number" value={applicationData?.section3?.passportNumber} />
            <ViewRow label="Issuing Authority" value={applicationData?.section3?.issuingAuthority} />
            <ViewRow label="Place of Issue" value={applicationData?.section3?.placeOfIssue} />
            <ViewRow label="Date of Issue" value={applicationData?.section3?.dateOfIssue} />
            <ViewRow label="Date of Expiry" value={applicationData?.section3?.dateOfExpiry} />
          </ViewSection>

          {/* Section 4: CDC */}
          <ViewSection title="CDC (Continuous Discharge Certificate)">
            <ViewRow label="CDC Number" value={applicationData?.section4?.cdcNumber} />
            <ViewRow label="Issuing Authority" value={applicationData?.section4?.issuingAuthority} />
            <ViewRow label="Place of Issue" value={applicationData?.section4?.placeOfIssue} />
            <ViewRow label="Date of Issue" value={applicationData?.section4?.dateOfIssue} />
            <ViewRow label="Date of Expiry" value={applicationData?.section4?.dateOfExpiry} />
          </ViewSection>

          {/* Section 5: Visas */}
          {applicationData?.section5?.visas && applicationData.section5.visas.length > 0 && (
            <ViewSection title="Visas">
              {applicationData.section5.visas.map((visa, index) => {
                // Skip empty visas
                if (!visa.type && !visa.number && !visa.dateOfIssue) return null
                return (
                  <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                    <p className="font-semibold text-gray-900 mb-3">Visa {index + 1}</p>
                    <div className="space-y-2">
                      <ViewRow label="Type" value={visa.type} />
                      <ViewRow label="Number" value={visa.number} />
                      <ViewRow label="Place of Issue" value={visa.placeOfIssue} />
                      <ViewRow label="Date of Issue" value={visa.dateOfIssue} />
                      <ViewRow label="Date of Expiry" value={visa.dateOfExpiry} />
                    </div>
                  </div>
                )
              })}
            </ViewSection>
          )}

          {/* Section 6: Education */}
          {applicationData?.section6?.education && applicationData.section6.education.length > 0 && (
            <ViewSection title="Education">
              {applicationData.section6.education.map((edu, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">{edu.institution || `Education ${index + 1}`}</p>
                  <div className="space-y-2">
                    <ViewRow label="Institution" value={edu.institution} />
                    <ViewRow label="Qualification" value={edu.qualification} />
                    <ViewRow label="From" value={edu.from} />
                    <ViewRow label="To" value={edu.to} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 8: Certificates */}
          {applicationData?.section8?.certificates && applicationData.section8.certificates.length > 0 && (
            <ViewSection title="Certificates of Competency">
              {applicationData.section8.certificates.map((cert, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">Certificate {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Certificate Number" value={cert.certificateNumber} />
                    <ViewRow label="Grade" value={formatDisplayValue(cert.grade)} />
                    <ViewRow label="Issuing Authority" value={cert.issuingAuthority} />
                    <ViewRow label="Place of Issue" value={cert.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={cert.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={cert.dateOfExpiry} />
                    {cert.dateRevalidated && <ViewRow label="Date Revalidated" value={cert.dateRevalidated} />}
                    {cert.dateRevalidationExpiry && <ViewRow label="Revalidation Expiry" value={cert.dateRevalidationExpiry} />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 9: GMDSS */}
          {applicationData?.section9?.gmdss && applicationData.section9.gmdss.length > 0 && (
            <ViewSection title="GMDSS Certificates">
              {applicationData.section9.gmdss.map((gmdss, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">GMDSS Certificate {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Certificate Number" value={gmdss.number} />
                    <ViewRow label="Issuing Authority" value={gmdss.issuingAuthority} />
                    <ViewRow label="Place of Issue" value={gmdss.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={gmdss.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={gmdss.dateOfExpiry} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 10: Medical & Vaccinations */}
          <ViewSection title="Medical Fitness & Vaccinations">
            {applicationData?.section10?.medicalFitness && applicationData.section10.medicalFitness.length > 0 && (
              <div className="mb-4">
                <p className="font-semibold text-gray-900 mb-3">Medical Fitness Certificates</p>
                {applicationData.section10.medicalFitness.map((cert, index) => (
                  <div key={index} className="mb-4 last:mb-0 space-y-2">
                    <ViewRow label="Type" value={cert.type} />
                    <ViewRow label="Date of Issue" value={cert.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={cert.dateOfExpiry} />
                  </div>
                ))}
              </div>
            )}
            
            {applicationData?.section10?.vaccinations && (
              <div className="mt-4 pt-4 border-t">
                <p className="font-semibold text-gray-900 mb-3">Vaccinations</p>
                <div className="space-y-2">
                  {/* Polio */}
                  {applicationData.section10.vaccinations.polio && (
                    <ViewRow label="Polio" value={`Yes${applicationData.section10.vaccinations.polioDate ? ` (${applicationData.section10.vaccinations.polioDate})` : ''}`} />
                  )}
                  
                  {/* Measles */}
                  {applicationData.section10.vaccinations.measles && (
                    <ViewRow label="Measles" value={`Yes${applicationData.section10.vaccinations.measlesDate ? ` (${applicationData.section10.vaccinations.measlesDate})` : ''}`} />
                  )}
                  
                  {/* Tetanus */}
                  {applicationData.section10.vaccinations.tetanus && (
                    <ViewRow label="Tetanus" value={`Yes${applicationData.section10.vaccinations.tetanusDate ? ` (${applicationData.section10.vaccinations.tetanusDate})` : ''}`} />
                  )}
                  
                  {/* Typhoid */}
                  {applicationData.section10.vaccinations.typhoid && (
                    <ViewRow label="Typhoid" value={`Yes${applicationData.section10.vaccinations.typhoidDate ? ` (${applicationData.section10.vaccinations.typhoidDate})` : ''}`} />
                  )}
                  
                  {/* Hepatitis A */}
                  {applicationData.section10.vaccinations.hepatitisA && (
                    <ViewRow label="Hepatitis A" value={`Yes${applicationData.section10.vaccinations.hepatitisADate ? ` (${applicationData.section10.vaccinations.hepatitisADate})` : ''}`} />
                  )}
                  
                  {/* Hepatitis B */}
                  {applicationData.section10.vaccinations.hepatitisB && (
                    <ViewRow label="Hepatitis B" value={`Yes${applicationData.section10.vaccinations.hepatitisBDate ? ` (${applicationData.section10.vaccinations.hepatitisBDate})` : ''}`} />
                  )}
                  
                  {/* Yellow Fever (object structure) */}
                  {applicationData.section10.vaccinations.yellowFever?.received && (
                    <ViewRow 
                      label="Yellow Fever" 
                      value={`Yes (Issue: ${applicationData.section10.vaccinations.yellowFever.dateOfIssue || 'N/A'}, Expiry: ${applicationData.section10.vaccinations.yellowFever.dateOfExpiry || 'N/A'})`} 
                    />
                  )}
                  
                  {/* COVID-19 */}
                  {applicationData.section10.vaccinations.covidVaccinated && (
                    <ViewRow 
                      label="COVID-19" 
                      value={`Yes${applicationData.section10.vaccinations.covidDoses ? ` (${applicationData.section10.vaccinations.covidDoses} doses)` : ''}${applicationData.section10.vaccinations.covidLastDoseDate ? ` - Last dose: ${applicationData.section10.vaccinations.covidLastDoseDate}` : ''}`} 
                    />
                  )}
                  
                  {/* Other Vaccinations */}
                  {applicationData.section10.vaccinations.otherVaccinations && (
                    <ViewRow label="Other Vaccinations" value={applicationData.section10.vaccinations.otherVaccinations} />
                  )}
                  
                  {/* Show message if no vaccinations */}
                  {!applicationData.section10.vaccinations.polio && 
                   !applicationData.section10.vaccinations.measles && 
                   !applicationData.section10.vaccinations.tetanus && 
                   !applicationData.section10.vaccinations.typhoid && 
                   !applicationData.section10.vaccinations.hepatitisA && 
                   !applicationData.section10.vaccinations.hepatitisB && 
                   !applicationData.section10.vaccinations.yellowFever?.received && 
                   !applicationData.section10.vaccinations.covidVaccinated && (
                    <p className="text-sm text-gray-500 italic">No vaccinations recorded</p>
                  )}
                </div>
              </div>
            )}
          </ViewSection>

          {/* Section 11: Medical History/Incident */}
          {applicationData?.section11?.medicalHistory && (
            <ViewSection title="Medical History / Incident">
              {applicationData.section11.medicalHistory.vesselName && (
                <div className="space-y-2">
                  <ViewRow label="Vessel Name" value={applicationData.section11.medicalHistory.vesselName} />
                  <ViewRow label="Description" value={applicationData.section11.medicalHistory.description} />
                  <ViewRow label="Date of Occurrence" value={applicationData.section11.medicalHistory.dateOfOccurrence} />
                  <ViewRow label="Signed Off Medical" value={applicationData.section11.medicalHistory.signedOffMedical ? 'Yes' : 'No'} />
                </div>
              )}
              {!applicationData.section11.medicalHistory.vesselName && (
                <p className="text-sm text-gray-500 italic">No medical incidents recorded</p>
              )}
            </ViewSection>
          )}

          {/* Section 12: Languages */}
          {applicationData?.section12?.languages && applicationData.section12.languages.length > 0 && (
            <ViewSection title="Languages">
              {applicationData.section12.languages.map((lang, index) => (
                <div key={index} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0">
                  <div className="space-y-2">
                    <ViewRow label="Language" value={lang.language} />
                    <ViewRow label="Proficiency Level" value={lang.level} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 13: Physical Details */}
          <ViewSection title="Physical Details & Uniform Sizes">
            <ViewRow label="Height" value={`${applicationData?.section13?.height} ${applicationData?.section13?.heightUnit || ''}`} />
            <ViewRow label="Weight" value={`${applicationData?.section13?.weight} ${applicationData?.section13?.weightUnit || ''}`} />
            <ViewRow label="Eye Color" value={applicationData?.section13?.eyeColor} />
            <ViewRow label="Hair Color" value={applicationData?.section13?.hairColor} />
            <ViewRow label="Shoe Size" value={`${applicationData?.section13?.shoeSize} ${applicationData?.section13?.shoeSizeUnit || ''}`} />
            <ViewRow label="Boiler Suit Size" value={applicationData?.section13?.boilerSuitSize} />
            <ViewRow label="Uniform Shirt Size" value={applicationData?.section13?.uniformShirtSize} />
            <ViewRow label="Uniform Trouser Size" value={applicationData?.section13?.uniformTrouserSize} />
          </ViewSection>

          {/* Section 14: Additional Courses */}
          {applicationData?.section14?.courses && applicationData.section14.courses.length > 0 && (
            <ViewSection title="Additional Courses & Training">
              {applicationData.section14.courses.map((course, index) => (
                <div key={index} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0">
                  <div className="space-y-2">
                    <ViewRow label="Course Name" value={course.courseName} />
                    <ViewRow label="IMO Model Course" value={course.imoModelCourse} />
                    <ViewRow label="Reference- Regulation" value={course.referenceRegulation} />
                    <ViewRow label="Certificate Number" value={course.certificateNumber} />
                    <ViewRow label="Date of Issue" value={course.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={course.dateOfExpiry} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 15: Endorsements */}
          {applicationData?.section15?.endorsements && applicationData.section15.endorsements.length > 0 && (
            <ViewSection title="Endorsements">
              {applicationData.section15.endorsements.map((endorsement, index) => (
                <div key={index} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0">
                  <div className="space-y-2">
                    <ViewRow label="Endorsement Type" value={endorsement.endorsementType} />
                    <ViewRow label="Endorsement Number" value={endorsement.endorsementNumber} />
                    <ViewRow label="Flag State" value={endorsement.flagState} />
                    <ViewRow label="Rank Endorsed" value={formatDisplayValue(endorsement.rankEndorsed)} />
                    <ViewRow label="Place of Issue" value={endorsement.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={endorsement.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={endorsement.dateOfExpiry} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 16: Sea Service */}
          {applicationData?.section16?.seaService && applicationData.section16.seaService.length > 0 && (
            <ViewSection title="Sea Service Experience">
              {applicationData.section16.seaService.map((service, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">{service.vesselName || `Vessel ${index + 1}`}</p>
                  <div className="space-y-2">
                    <ViewRow label="Vessel Name" value={service.vesselName} />
                    <ViewRow label="Vessel Type" value={formatDisplayValue(service.vesselType)} />
                    <ViewRow label="Flag" value={service.flag} />
                    <ViewRow label="GRT" value={service.grt} />
                    <ViewRow label="DWT" value={service.dwt} />
                    <ViewRow label="TEU" value={service.teu} />
                    <ViewRow label="Year Built" value={service.yearBuilt} />
                    <ViewRow label="Main Engine" value={service.mainEngine} />
                    <ViewRow label="Engine Family" value={service.engineFamily} />
                    <ViewRow label="Main Engine Make" value={service.mainEngineMake} />
                    <ViewRow label="Engine Power (kW)" value={service.engineKw} />
                    <ViewRow label="Rank Held" value={formatDisplayValue(service.rankHeld)} />
                    <ViewRow label="Position" value={service.position} />
                    <ViewRow label="Company" value={service.company || service.companyName} />
                    <ViewRow label="Manning" value={service.manning} />
                    <ViewRow label="Trading Area" value={service.tradingArea || service.tradeRoute} />
                    <ViewRow label="Trade Route" value={service.tradeRoute} />
                    <ViewRow label="Total mm/dd" value={service.totalMmDd} />
                    <ViewRow label="Sign On Date" value={service.signOnDate} />
                    <ViewRow label="Sign Off Date" value={service.signOffDate} />
                    {service.reasonForLeaving && <ViewRow label="Reason for Leaving" value={service.reasonForLeaving} />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 18: References */}
          {applicationData?.section18 && (
            <ViewSection title="Professional References">
              <div className="mb-6 pb-6 border-b">
                <ViewRow
                  label="Objection To Contact Last Employer"
                  value={applicationData.section18.objectionToContactLastEmployer}
                />
                <ViewRow label="Current Employer Company" value={applicationData.section18.currentEmployer?.company} />
                <ViewRow label="Current Employer Contact Person" value={applicationData.section18.currentEmployer?.contactPerson} />
                <ViewRow label="Current Employer Address" value={applicationData.section18.currentEmployer?.address} />
                <ViewRow label="Current Employer Phone" value={applicationData.section18.currentEmployer?.phoneNumber} />
              </div>
              {(applicationData.section18.references || []).map((ref, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">Reference {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Name" value={ref.name} />
                    <ViewRow label="Position" value={ref.position} />
                    <ViewRow label="Company" value={ref.company} />
                    <ViewRow label="Address" value={ref.address} />
                    <ViewRow label="Email" value={ref.email} />
                    <ViewRow label="Phone" value={ref.phoneNumber} />
                    <ViewRow label="Relationship" value={ref.relationship} />
                    <ViewRow label="Years Known" value={ref.yearsKnown} />
                    {ref.additionalNotes && <ViewRow label="Additional Notes" value={ref.additionalNotes} />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 19: Declaration & Consent */}
          <ViewSection title="Declaration & Consent">
            <ViewRow label="Full Name" value={applicationData?.section19?.fullName} />
            <ViewRow label="Place of Signing" value={applicationData?.section19?.placeOfSigning} />
            <ViewRow label="Date of Signature" value={applicationData?.section19?.signatureDate} />
            {applicationData?.section19?.preferredJoinDate && <ViewRow label="Preferred Join Date" value={applicationData.section19.preferredJoinDate} />}
            {applicationData?.section19?.noticePeriod && <ViewRow label="Notice Period" value={applicationData.section19.noticePeriod} />}
            {applicationData?.section19?.contractDuration && <ViewRow label="Contract Duration Preference" value={applicationData.section19.contractDuration} />}
            {applicationData?.section19?.salaryExpectation && <ViewRow label="Salary Expectation" value={applicationData.section19.salaryExpectation} />}
            {applicationData?.section19?.specialRequirements && (
              <ViewRow label="Special Requirements" value={applicationData.section19.specialRequirements} />
            )}
            {applicationData?.section19?.additionalInformation && (
              <ViewRow label="Additional Information" value={applicationData.section19.additionalInformation} />
            )}
            <ViewRow label="Criminal Record" value={applicationData?.section19?.criminalRecord ? 'Yes' : 'No'} />
            {applicationData?.section19?.criminalRecordDetails && (
              <ViewRow label="Criminal Record Details" value={applicationData.section19.criminalRecordDetails} />
            )}
            {applicationData?.section19?.medicalConditions && (
              <ViewRow label="Medical Conditions" value={applicationData.section19.medicalConditions} />
            )}
            <div className="mt-4 pt-4 border-t">
              <p className="font-semibold text-gray-900 mb-3">Consents & Declarations</p>
              <ViewRow label="Accuracy Declaration" value={applicationData?.section19?.accuracyDeclaration ? '✓ Confirmed' : '✗ Not confirmed'} />
              <ViewRow label="Data Processing Consent" value={applicationData?.section19?.dataProcessingConsent ? '✓ Granted' : '✗ Not granted'} />
              <ViewRow label="Background Check Consent" value={applicationData?.section19?.backgroundCheckConsent ? '✓ Granted' : '✗ Not granted'} />
              <ViewRow label="Marketing Consent" value={applicationData?.section19?.marketingConsent ? '✓ Yes' : '✗ No'} />
            </div>
          </ViewSection>
        </div>
      </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 print:mt-12">
          <p>Njordships Maritime Recruitment • recruitment@njordships.com</p>
          {application.reference_number && (
            <p className="mt-1">Reference Number: {application.reference_number}</p>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}

// Helper Components
function ViewSection({ title, children }) {
  return (
    <div className="recruiter-panel p-6 print:shadow-none print:border print:break-inside-avoid">
      <h3 className="mb-5 border-b border-gray-200 pb-3 text-lg font-semibold tracking-tight text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

function ViewRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-b-0 md:flex-row">
      <span className="w-full text-sm font-medium text-gray-500 md:w-1/3">{label}</span>
      <span className="w-full text-sm text-gray-900 md:w-2/3">{value || 'Not provided'}</span>
    </div>
  )
}
