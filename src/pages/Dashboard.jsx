/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import {
  CheckCircle,
  Calendar,
  User,
  FileCheck,
  Briefcase,
  Heart,
  Award,
  Shield,
  Book,
  Anchor,
  MessageSquare,
  FileText,
  Globe,
  GraduationCap,
  Users,
  Languages,
  Activity,
  Ruler,
  Flag,
  BarChart3,
  ArrowRight
} from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import PageHeader from '../components/ui/PageHeader'
import BrandLockup from '../components/ui/BrandLockup'
import { clearActiveDraftId, isActiveDraftExplicit, markActiveDraftExplicit, setActiveDraftId } from '../utils/draftSession'
import { FORM_SECTION_NUMBERS } from '../constants/formSections'

const SECTION_INFO = [
  { id: 1, title: 'Availability & Application', icon: Calendar },
  { id: 2, title: 'Personal & Contact Details', icon: User },
  { id: 3, title: 'Passport Details', icon: FileCheck },
  { id: 4, title: 'CDC / Seaman\'s Book', icon: Briefcase },
  { id: 5, title: 'Visas', icon: Globe },
  { id: 6, title: 'Education Background', icon: GraduationCap },
  { id: 7, title: 'Dependents', icon: Users },
  { id: 8, title: 'Certificates of Competency', icon: Award },
  { id: 9, title: 'GMDSS Certificates', icon: Shield },
  { id: 10, title: 'Medical & Vaccination', icon: Heart },
  { id: 11, title: 'Medical History', icon: Activity },
  { id: 12, title: 'Foreign Languages', icon: Languages },
  { id: 13, title: 'Physical & Uniform Details', icon: Ruler },
  { id: 14, title: 'STCW & Marine Courses', icon: Book },
  { id: 15, title: 'Flag State Documents', icon: Flag },
  { id: 16, title: 'Sea Service', icon: Anchor },
  { id: 17, title: 'Experience Summary', icon: BarChart3 },
  { id: 18, title: 'References', icon: MessageSquare },
  { id: 19, title: 'Declaration & Consent', icon: FileText }
]

function getApplicantStatusLabel(status) {
  const labels = {
    new: 'New',
    under_review: 'Under Review',
    test_scheduled: 'Test Scheduled',
    test_passed: 'Test Passed',
    interview_scheduled: 'Interview Scheduled',
    interview_passed: 'Interview Passed',
    offered: 'Offer Received',
    offer_accepted: 'Offer Accepted',
    documents_pending: 'Documents Pending',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  }
  return labels[status] || 'Submitted'
}

function getApplicantStatusTone(status) {
  const tones = {
    under_review: 'bg-blue-100 text-blue-800',
    test_scheduled: 'bg-orange-100 text-orange-800',
    test_passed: 'bg-teal-100 text-teal-800',
    interview_scheduled: 'bg-purple-100 text-purple-800',
    interview_passed: 'bg-indigo-100 text-indigo-800',
    offered: 'bg-emerald-100 text-emerald-800',
    offer_accepted: 'bg-emerald-100 text-emerald-800',
    documents_pending: 'bg-amber-100 text-amber-800',
    hired: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    withdrawn: 'bg-gray-100 text-gray-800'
  }
  return tones[status] || 'bg-slate-100 text-slate-800'
}

function hasMeaningfulDraftData(data) {
  if (!data || typeof data !== 'object') return false

  return Object.values(data).some((value) => {
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object' && value !== null) {
      return hasMeaningfulDraftData(value)
    }
    if (typeof value === 'boolean') return value
    return value !== '' && value !== null && value !== undefined
  })
}

const TERMINAL_APPLICATION_STATUSES = ['hired', 'rejected', 'withdrawn']

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])
  const [draftApplication, setDraftApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [copiedRef, setCopiedRef] = useState(null)
  const [showStartOptions, setShowStartOptions] = useState(false)
  const [isCreatingApplication, setIsCreatingApplication] = useState(false)

  useEffect(() => {
    if (user) {
      fetchApplications()
    }
  }, [user])

  const fetchApplications = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          application_data (
            data
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const inProgress = data?.find(app => app.status === 'new' && !app.submitted_at)
      const submitted = data?.filter(app => app.submitted_at !== null || (app.status !== 'new' && app.status !== null)) || []

      if (inProgress) {
        const { data: appData, error: dataError } = await supabase
          .from('application_data')
          .select('*')
          .eq('application_id', inProgress.id)
          .single()

        if (dataError) throw dataError

        const draftData = appData?.data || {}
        const explicitDraft = isActiveDraftExplicit()
        const isStaleEmptyDraft =
          submitted.length > 0 &&
          !hasMeaningfulDraftData(draftData) &&
          !explicitDraft

        if (isStaleEmptyDraft) {
          await supabase
            .from('application_data')
            .delete()
            .eq('application_id', inProgress.id)

          await supabase
            .from('applications')
            .delete()
            .eq('id', inProgress.id)

          clearActiveDraftId()
          setDraftApplication(null)
          setApplicationData(null)
          setApplications(submitted)
          return
        }

        setDraftApplication(inProgress)
        setApplications(submitted)
        setApplicationData(draftData)
        setActiveDraftId(inProgress.id)
        if (hasMeaningfulDraftData(draftData)) {
          markActiveDraftExplicit(false)
        }
        return
      }

      setDraftApplication(null)
      setApplications(submitted)
      setApplicationData(null)
      clearActiveDraftId()
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const createApplicationDraft = async (mode = 'blank') => {
    try {
      setIsCreatingApplication(true)

      const hasActivePipelineApplication = applications.some(
        (app) => !TERMINAL_APPLICATION_STATUSES.includes(app.status)
      )
      if (hasActivePipelineApplication) {
        alert('You already have an application in progress with the recruitment team. A new application can be started only after the current process is completed.')
        return
      }

      let previousData = {}
      if (mode === 'reuse' && applications.length > 0) {
        const latestApp = applications[0]
        const { data: prevAppData, error: prevDataError } = await supabase
          .from('application_data')
          .select('data')
          .eq('application_id', latestApp.id)
          .single()

        if (!prevDataError && prevAppData) {
          previousData = prevAppData.data || {}
        }
      }

      const { data: newApp, error: appError } = await supabase
        .from('applications')
        .insert([{
          user_id: user.id,
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (appError) throw appError

      const { error: dataError } = await supabase
        .from('application_data')
        .insert([{ application_id: newApp.id, data: previousData }])

      if (dataError) throw dataError

      if (mode === 'reuse' && Object.keys(previousData).length > 0) {
        alert('New draft created with data from your previous application. Review and update as needed.')
      }

      setActiveDraftId(newApp.id)
      markActiveDraftExplicit(true)
      setShowStartOptions(false)
      navigate('/application/form/section/1')
    } catch (error) {
      console.error('Error creating application:', error)
      alert(`Failed to create application: ${error.message}`)
    } finally {
      setIsCreatingApplication(false)
    }
  }

  const handleStartApplication = async () => {
    const hasActivePipelineApplication = applications.some(
      (app) => !TERMINAL_APPLICATION_STATUSES.includes(app.status)
    )
    if (hasActivePipelineApplication && !draftApplication) {
      alert('You already have an application in progress with the recruitment team. A new application can be started only after the current process is completed.')
      return
    }

    if (!draftApplication && applications.length === 0) {
      await createApplicationDraft('blank')
      return
    }

    setShowStartOptions(true)
  }

  const handleContinueDraft = () => {
    setShowStartOptions(false)
    if (draftApplication?.id) {
      setActiveDraftId(draftApplication.id)
    }
    navigate('/application/form/section/1')
  }

  const handleDiscardDraftAndCreate = async (mode = 'blank') => {
    if (!draftApplication) {
      await createApplicationDraft(mode)
      return
    }

    const confirmMessage = mode === 'reuse'
      ? 'Discard your current draft and create a new application using data from your last submitted application?'
      : 'Discard your current draft and start a completely blank application?'

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setIsCreatingApplication(true)

      const { error: dataError } = await supabase
        .from('application_data')
        .delete()
        .eq('application_id', draftApplication.id)

      if (dataError) throw dataError

      const { error: appError } = await supabase
        .from('applications')
        .delete()
        .eq('id', draftApplication.id)

      if (appError) throw appError

      setDraftApplication(null)
      setApplicationData(null)
      clearActiveDraftId()
      await fetchApplications()
      await createApplicationDraft(mode)
    } catch (error) {
      console.error('Error resetting draft:', error)
      alert(`Failed to reset draft: ${error.message}`)
    }
  }

  const handleContinueApplication = () => {
    if (draftApplication?.id) {
      setActiveDraftId(draftApplication.id)
    }
    navigate('/application/form/section/1')
  }
  const handleReviewAndSubmit = () => {
    if (draftApplication?.id) {
      setActiveDraftId(draftApplication.id)
    }
    navigate('/application/review')
  }

  const handleDiscardDraft = async () => {
    if (!window.confirm('Are you sure you want to discard this draft? This cannot be undone.')) {
      return
    }

    try {
      const { error: dataError } = await supabase
        .from('application_data')
        .delete()
        .eq('application_id', draftApplication.id)
      if (dataError) throw dataError

      const { error: appError } = await supabase
        .from('applications')
        .delete()
        .eq('id', draftApplication.id)
      if (appError) throw appError

      setDraftApplication(null)
      setApplicationData(null)
      clearActiveDraftId()
      await fetchApplications()
    } catch (error) {
      console.error('Error in handleDiscardDraft:', error)
      alert(`Failed to delete draft: ${error.message}`)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const calculateProgress = () => {
    if (!applicationData) return 0
    const sections = FORM_SECTION_NUMBERS.map((sectionNumber) => `section${sectionNumber}`)
    const completedSections = sections.filter(section => {
      const sectionData = applicationData[section]
      return sectionData && Object.keys(sectionData).length > 0
    })
    return Math.round((completedSections.length / sections.length) * 100)
  }

  const isSectionCompleted = (sectionId) => {
    if (!applicationData) return false
    const sectionData = applicationData[`section${sectionId}`]
    return sectionData && Object.keys(sectionData).length > 0
  }

  const completedSectionCount = SECTION_INFO.filter(section => isSectionCompleted(section.id)).length
  const hasActivePipelineApplication = applications.some(
    (app) => !TERMINAL_APPLICATION_STATUSES.includes(app.status)
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading your applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="applicant-shell">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <BrandLockup compact />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.user_metadata?.full_name || user?.email}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button onClick={handleSignOut} className="applicant-action applicant-action--secondary">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="applicant-hero">
            <PageHeader
              eyebrow="Applicant Dashboard"
              title="Manage your maritime application journey"
              description="Track your active draft, understand what happens next after submission, and return to each section without losing context."
              actions={(
                draftApplication ? (
                  <button onClick={handleStartApplication} className="applicant-action applicant-action--primary">
                    Resume draft
                  </button>
                ) : !hasActivePipelineApplication ? (
                  <button onClick={handleStartApplication} className="applicant-action applicant-action--primary">
                    {applications.length > 0 ? 'Create new application' : 'Start application'}
                  </button>
                ) : null
              )}
            />
          </div>

          <div className="applicant-stat-grid">
            <div className="applicant-stat">
              <p className="applicant-stat__label">Submitted Applications</p>
              <p className="applicant-stat__value">{applications.length}</p>
              <p className="applicant-stat__hint">Applications already sent to recruiters.</p>
            </div>
            <div className="applicant-stat">
              <p className="applicant-stat__label">Draft Progress</p>
              <p className="applicant-stat__value">{draftApplication ? `${calculateProgress()}%` : '0%'}</p>
              <p className="applicant-stat__hint">Completion level of your current draft.</p>
            </div>
            <div className="applicant-stat">
              <p className="applicant-stat__label">Completed Sections</p>
              <p className="applicant-stat__value">{draftApplication ? completedSectionCount : 0}</p>
              <p className="applicant-stat__hint">Sections with saved information.</p>
            </div>
            <div className="applicant-stat">
              <p className="applicant-stat__label">Next Best Action</p>
              <p className="applicant-stat__value text-[1.3rem] leading-tight">{draftApplication ? 'Continue draft' : applications.length > 0 ? 'Track status' : 'Begin application'}</p>
              <p className="applicant-stat__hint">The clearest step forward right now.</p>
            </div>
          </div>

          {!draftApplication && applications.length === 0 && (
            <div className="applicant-panel p-12 text-center">
              <div className="mx-auto max-w-md">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                  <FileText className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-gray-900">Ready to apply for a maritime position?</h3>
                <p className="mb-8 text-gray-600">Start your application now. Progress is saved automatically, and you can return anytime.</p>
                <button onClick={handleStartApplication} className="applicant-action applicant-action--primary">
                  Apply now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {showStartOptions && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-10 backdrop-blur-sm">
              <div className="applicant-panel w-full max-w-2xl p-6 md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Application Start Options</p>
                    <h3 className="mt-2 text-2xl font-semibold text-gray-900">Choose how you want to begin</h3>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      Start from a clean application or reuse information from a previous submission. If you already have a draft, you can continue it instead of replacing it.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowStartOptions(false)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {draftApplication && (
                    <button
                      onClick={handleContinueDraft}
                      className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      <p className="text-sm font-semibold text-blue-800">Continue existing draft</p>
                      <p className="mt-2 text-sm leading-6 text-blue-900/80">
                        Resume the draft you already started and keep all current progress.
                      </p>
                    </button>
                  )}

                  <button
                    onClick={() => handleDiscardDraftAndCreate('blank')}
                    disabled={isCreatingApplication}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-sm font-semibold text-gray-900">Start blank</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      Begin a completely empty application and enter every section from scratch.
                    </p>
                  </button>

                  {applications.length > 0 && (
                    <button
                      onClick={() => handleDiscardDraftAndCreate('reuse')}
                      disabled={isCreatingApplication}
                      className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                    >
                      <p className="text-sm font-semibold text-gray-900">Reuse previous data</p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        Create a new draft prefilled from your most recent submitted application, then update only what has changed.
                      </p>
                    </button>
                  )}
                </div>

                {draftApplication ? (
                  <p className="mt-5 text-xs leading-5 text-gray-500">
                    Starting a new application will replace your current draft so you do not end up with multiple active drafts.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {draftApplication && (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
                <div className="applicant-panel p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="applicant-chip">Draft in progress</span>
                        <span className="text-sm text-gray-500">Autosave enabled</span>
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight text-gray-900">Your application is underway</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        Continue from where you left off. You can jump directly into any section below and return for review when you are ready to submit.
                      </p>
                    </div>
                    <button onClick={handleDiscardDraft} className="text-sm text-red-600 hover:text-red-700 hover:underline">
                      Discard draft
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Progress</span>
                      <span className="text-sm font-semibold text-blue-700">{calculateProgress()}% complete</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200">
                      <div className="h-3 rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${calculateProgress()}%` }} />
                    </div>
                    <p className="mt-3 text-sm text-gray-600">Last saved: {new Date(draftApplication.updated_at).toLocaleString()}</p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button onClick={handleContinueApplication} className="applicant-action applicant-action--primary">
                      Continue application
                    </button>
                    <button onClick={handleReviewAndSubmit} className="applicant-action applicant-action--secondary">
                      Review before submit
                    </button>
                  </div>
                </div>

                <div className="applicant-panel p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Submission Readiness</p>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">Prepare for final review</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Before submission, confirm your identity documents, certificates, medical data, and sea-service history are complete and up to date.
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-900">What happens next</p>
                      <p className="mt-2 text-sm text-gray-600">After submission you will receive a reference number and be able to track the application from this dashboard.</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-900">Useful tip</p>
                      <p className="mt-2 text-sm text-gray-600">Use the review step to catch missing dates, incomplete declarations, or outdated document entries before sending your application.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="applicant-panel p-6">
                <h3 className="mb-6 text-lg font-semibold text-gray-900">Application Sections</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {SECTION_INFO.map(section => {
                    const Icon = section.icon
                    const isCompleted = isSectionCompleted(section.id)
                    return (
                      <button
                        key={section.id}
                        onClick={() => navigate(`/application/form/section/${section.id}`)}
                        className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50"
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                          {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 group-hover:text-blue-600">Section {section.id}</p>
                          <p className="truncate text-xs text-gray-600">{section.title}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {applications.length > 0 && (
            <div className="applicant-panel p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Your Applications</h3>
                {!draftApplication && !hasActivePipelineApplication ? (
                  <button onClick={handleStartApplication} className="applicant-action applicant-action--primary">
                    Create new application
                  </button>
                ) : null}
              </div>

              {hasActivePipelineApplication ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  A new application can be started only after your current recruitment process is completed.
                </div>
              ) : null}

              <div className="space-y-4">
                {applications.map(app => (
                  <div key={app.id} className="rounded-2xl border border-gray-200 p-5 transition-colors hover:border-blue-300">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getApplicantStatusTone(app.status)}`}>
                            {getApplicantStatusLabel(app.status)}
                          </span>
                          <span className="text-sm text-gray-500">Application record</span>
                        </div>

                        {app.reference_number ? (
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Ref:</span>
                            <span className="text-sm font-mono font-semibold text-blue-600">{app.reference_number}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(app.reference_number)
                                setCopiedRef(app.reference_number)
                                setTimeout(() => setCopiedRef(null), 2000)
                              }}
                              className="rounded p-1 transition-colors hover:bg-gray-100"
                              title="Copy reference number"
                            >
                              {copiedRef === app.reference_number ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <FileText className="h-4 w-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                        ) : null}

                        <p className="text-sm font-medium text-gray-900">
                          {formatDisplayValue(app.application_data?.data?.section1?.appliedForRank || app.applied_rank) || 'Position not specified'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Submitted: {new Date(app.submitted_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>

                      <button onClick={() => navigate(`/application/view/${app.public_token}`)} className="applicant-action applicant-action--secondary">
                        View application
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
