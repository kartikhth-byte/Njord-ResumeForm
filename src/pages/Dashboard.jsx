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
import { calculateDraftProgress, hasMeaningfulDraftData, isDraftSectionComplete } from '../utils/applicationProgress'
import { badgeClassesForStatus } from '../constants/statusTones'

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
  return badgeClassesForStatus(status)
}

const TERMINAL_APPLICATION_STATUSES = ['hired', 'rejected', 'withdrawn']

function isSingleActiveApplicationError(error) {
  const message = error?.message || ''
  const details = error?.details || ''
  return message.includes('unique_active_application_per_user') || details.includes('unique_active_application_per_user')
}

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
      if (isSingleActiveApplicationError(error)) {
        alert('You already have an application in progress with the recruitment team. A new application can be started only after the current process is completed.')
        return
      }
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
    return calculateDraftProgress(applicationData, FORM_SECTION_NUMBERS)
  }

  const isSectionCompleted = (sectionId) => {
    if (!applicationData) return false
    const sectionData = applicationData[`section${sectionId}`]
    return isDraftSectionComplete(sectionId, sectionData)
  }

  const completedSectionCount = SECTION_INFO.filter(section => isSectionCompleted(section.id)).length
  const hasActivePipelineApplication = applications.some(
    (app) => !TERMINAL_APPLICATION_STATUSES.includes(app.status)
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-accent" />
          <p className="text-fg-secondary">Loading your applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="applicant-shell">
      <header className="sticky top-0 z-50 border-b border-line bg-surface/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <BrandLockup compact />
          <div className="flex items-center gap-3">
            <p className="hidden max-w-[16rem] truncate text-sm text-fg-secondary sm:block">
              {user?.user_metadata?.full_name || user?.email}
            </p>
            <button onClick={handleSignOut} className="applicant-action applicant-action--secondary whitespace-nowrap">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <PageHeader
              title="Your application"
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

          {draftApplication ? (
            <div className="applicant-stat-grid">
              <div className="applicant-stat">
                <p className="applicant-stat__label">Draft progress</p>
                <p className="applicant-stat__value">{`${calculateProgress()}%`}</p>
              </div>
              <div className="applicant-stat">
                <p className="applicant-stat__label">Sections complete</p>
                <p className="applicant-stat__value">{completedSectionCount}</p>
              </div>
            </div>
          ) : null}

          {!draftApplication && applications.length === 0 && (
            <div className="applicant-panel p-12 text-center">
              <div className="mx-auto max-w-md">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
                  <FileText className="h-10 w-10 text-accent-text" />
                </div>
                <h3 className="mb-3 text-2xl font-semibold text-fg">Ready to apply for a maritime position?</h3>
                <button onClick={handleStartApplication} className="applicant-action applicant-action--primary">
                  Apply now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {showStartOptions && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-10">
              <div className="applicant-panel w-full max-w-2xl p-6 md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="mt-2 text-2xl font-semibold text-fg">Choose how you want to begin</h3>
                  </div>
                  <button
                    onClick={() => setShowStartOptions(false)}
                    className="rounded-full border border-line px-3 py-1 text-sm text-fg-muted transition hover:border-line-input hover:text-fg-secondary"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {draftApplication && (
                    <button
                      onClick={handleContinueDraft}
                      className="rounded-card border border-accent/40 bg-accent-soft p-5 text-left transition hover:border-accent hover:bg-accent-soft"
                    >
                      <p className="text-sm font-semibold text-accent-text">Continue existing draft</p>
                    </button>
                  )}

                  <button
                    onClick={() => handleDiscardDraftAndCreate('blank')}
                    disabled={isCreatingApplication}
                    className="rounded-card border border-line bg-surface p-5 text-left transition hover:border-line-input hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <p className="text-sm font-semibold text-fg">Start blank</p>
                  </button>

                  {applications.length > 0 && (
                    <button
                      onClick={() => handleDiscardDraftAndCreate('reuse')}
                      disabled={isCreatingApplication}
                      className="rounded-card border border-line bg-surface p-5 text-left transition hover:border-line-input hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                    >
                      <p className="text-sm font-semibold text-fg">Reuse previous data</p>
                    </button>
                  )}
                </div>

                {draftApplication ? (
                  <p className="mt-5 text-xs text-fg-muted">This replaces your current draft.</p>
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
                        <span className="text-sm text-fg-muted">Autosave enabled</span>
                      </div>
                      <h3 className="text-2xl font-semibold tracking-tight text-fg">Your application is underway</h3>
                    </div>
                    <button onClick={handleDiscardDraft} className="text-sm text-danger hover:text-danger hover:underline">
                      Discard draft
                    </button>
                  </div>

                  <div className="mt-6 rounded-card border border-line bg-raised p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-fg-secondary">Progress</span>
                      <span className="text-sm font-semibold text-accent-text">{calculateProgress()}% complete</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-line">
                      <div className="h-3 rounded-full bg-accent-fill transition-all duration-300" style={{ width: `${calculateProgress()}%` }} />
                    </div>
                    <p className="mt-3 text-sm text-fg-secondary">Last saved: {new Date(draftApplication.updated_at).toLocaleString()}</p>
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
                  <h3 className="mt-2 text-xl font-semibold text-fg">Prepare for final review</h3>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-card border border-line bg-surface p-4">
                      <p className="text-sm font-semibold text-fg">What happens next</p>
                    </div>
                    <div className="rounded-card border border-dashed border-line bg-raised p-4">
                      <p className="text-sm font-semibold text-fg">Useful tip</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="applicant-panel p-6">
                <h3 className="mb-6 text-lg font-semibold text-fg">Application Sections</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {SECTION_INFO.map(section => {
                    const Icon = section.icon
                    const isCompleted = isSectionCompleted(section.id)
                    return (
                      <button
                        key={section.id}
                        onClick={() => navigate(`/application/form/section/${section.id}`)}
                        className="group flex items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-all hover:border-accent hover:bg-accent-soft"
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isCompleted ? 'bg-success-soft text-success' : 'bg-raised text-fg-muted'}`}>
                          {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-fg group-hover:text-accent-text">Section {section.id}</p>
                          <p className="truncate text-xs text-fg-secondary">{section.title}</p>
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
                <h3 className="text-base font-semibold text-fg">Applications</h3>
                {!draftApplication && !hasActivePipelineApplication ? (
                  <button onClick={handleStartApplication} className="applicant-action applicant-action--primary">
                    Create new application
                  </button>
                ) : null}
              </div>

              {hasActivePipelineApplication ? (
                <div className="mb-4 rounded-control border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning">
                  A new application can be started only after your current recruitment process is completed.
                </div>
              ) : null}

              <div className="space-y-4">
                {applications.map(app => (
                  <div key={app.id} className="rounded-card border border-line p-5 transition-colors hover:border-accent">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getApplicantStatusTone(app.status)}`}>
                            {getApplicantStatusLabel(app.status)}
                          </span>
                          <span className="text-sm text-fg-muted">Application record</span>
                        </div>

                        {app.reference_number ? (
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs text-fg-muted">Ref:</span>
                            <span className="text-sm font-mono font-semibold text-accent-text">{app.reference_number}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(app.reference_number)
                                setCopiedRef(app.reference_number)
                                setTimeout(() => setCopiedRef(null), 2000)
                              }}
                              className="rounded p-1 transition-colors hover:bg-raised"
                              title="Copy reference number"
                            >
                              {copiedRef === app.reference_number ? (
                                <CheckCircle className="h-4 w-4 text-success" />
                              ) : (
                                <FileText className="h-4 w-4 text-fg-muted" />
                              )}
                            </button>
                          </div>
                        ) : null}

                        <p className="text-sm font-medium text-fg">
                          {formatDisplayValue(app.application_data?.data?.section1?.appliedForRank || app.applied_rank) || 'Position not specified'}
                        </p>
                        <p className="mt-1 text-xs text-fg-muted">
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
