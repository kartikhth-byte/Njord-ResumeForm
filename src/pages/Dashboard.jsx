/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { CheckCircle, Copy } from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import PageHeader from '../components/ui/PageHeader'
import ApplicantSidebar from '../components/applicant/ApplicantSidebar'
import { clearActiveDraftId, isActiveDraftExplicit, markActiveDraftExplicit, setActiveDraftId } from '../utils/draftSession'
import { calculateApplicationProgress, firstIncompleteSection, hasMeaningfulDraftData } from '../utils/applicationProgress'
import StatusBadge from '../components/StatusBadge'

const TERMINAL_APPLICATION_STATUSES = ['hired', 'rejected', 'withdrawn']

function isSingleActiveApplicationError(error) {
  const message = error?.message || ''
  const details = error?.details || ''
  return message.includes('unique_active_application_per_user') || details.includes('unique_active_application_per_user')
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState([])
  const [draftApplication, setDraftApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [copiedRef, setCopiedRef] = useState(null)
  const [isCreatingApplication, setIsCreatingApplication] = useState(false)
  const [claims, setClaims] = useState([])
  const [selectedProspectId, setSelectedProspectId] = useState('')

  useEffect(() => {
    if (user) {
      fetchApplications()
    }
  }, [user])

  const fetchApplications = async () => {
    try {
      setLoading(true)

      const { data: applicantClaims, error: claimsError } = await supabase.rpc('get_applicant_claims')
      if (claimsError) throw claimsError
      const availableClaims = Array.isArray(applicantClaims) ? applicantClaims : []
      setClaims(availableClaims)
      let lastClaimedId = null
      try {
        lastClaimedId = window.sessionStorage.getItem('njord-applicant-prospect-id')
      } catch {
        // A private browser may block storage; the first eligible claim still works.
      }
      setSelectedProspectId((current) => {
        const preferred = availableClaims.find((claim) => claim.prospect_id === lastClaimedId)
          || availableClaims.find((claim) => claim.prospect_id === current)
          || availableClaims[0]
        return preferred?.prospect_id || ''
      })

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

  const createApplicationDraft = async () => {
    try {
      setIsCreatingApplication(true)

      // A new application starts from the latest one, so the applicant only
      // updates what changed. Declarations, consents, the signature and the
      // availability date are never carried over.
      let previousData = {}
      if (applications.length > 0) {
        const latestApp = applications[0]
        const { data: prevAppData, error: prevDataError } = await supabase
          .from('application_data')
          .select('data')
          .eq('application_id', latestApp.id)
          .single()

        if (!prevDataError && prevAppData) {
          const { section19: _previousDeclarations, ...reusable } = prevAppData.data || {}
          void _previousDeclarations
          if (reusable.section1) {
            const { availableFrom: _previousAvailability, ...section1 } = reusable.section1
            void _previousAvailability
            reusable.section1 = section1
          }
          previousData = reusable
        }
      }

      if (!selectedProspectId) throw new Error('A recruiter invitation is required to start an application.')

      const { data: newAppId, error: appError } = await supabase.rpc('start_claimed_application', {
        p_prospect_id: selectedProspectId,
        p_initial_data: previousData,
      })

      if (appError) throw appError

      setActiveDraftId(newAppId)
      markActiveDraftExplicit(true)
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

  const handleContinueApplication = () => {
    if (draftApplication?.id) {
      setActiveDraftId(draftApplication.id)
    }
    const next = firstIncompleteSection(applicationData)
    navigate(next ? `/application/form/section/${next}` : '/application/review')
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

  const progress = calculateApplicationProgress(applicationData)
  const readyToSubmit = draftApplication && firstIncompleteSection(applicationData) === null
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
      <ApplicantSidebar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <PageHeader
            title="Your application"
            actions={
              !draftApplication && !hasActivePipelineApplication && claims.length > 0 ? (
                <button
                  onClick={createApplicationDraft}
                  disabled={isCreatingApplication}
                  className="applicant-action applicant-action--primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {applications.length > 0 ? 'New application' : 'Start application'}
                </button>
              ) : null
            }
          />

          {!draftApplication && !hasActivePipelineApplication && claims.length === 0 ? (
            <p className="text-sm text-fg-secondary">A recruiter invitation is required before you can start an application.</p>
          ) : null}
          {!draftApplication && !hasActivePipelineApplication && claims.length > 1 ? (
            <label className="block text-sm text-fg-secondary">
              Recruiting organization
              <select
                className="mt-2 block rounded-lg border border-line bg-surface px-3 py-2 text-fg"
                value={selectedProspectId}
                onChange={(event) => setSelectedProspectId(event.target.value)}
              >
                {claims.map((claim) => (
                  <option key={claim.prospect_id} value={claim.prospect_id}>{claim.organization_name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {draftApplication && (
            <div className="applicant-panel p-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-fg-secondary">Draft</span>
                <span className="text-sm font-semibold text-accent-text">{progress}% complete</span>
              </div>
              <div className="h-3 w-full rounded-full bg-line">
                <div className="h-3 rounded-full bg-accent-fill transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-3 text-sm text-fg-secondary">Last saved: {new Date(draftApplication.updated_at).toLocaleString()}</p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {readyToSubmit ? (
                  <button onClick={handleReviewAndSubmit} className="applicant-action applicant-action--primary">
                    Review and submit
                  </button>
                ) : (
                  <>
                    <button onClick={handleContinueApplication} className="applicant-action applicant-action--primary">
                      Continue
                    </button>
                    <button onClick={handleReviewAndSubmit} className="applicant-action applicant-action--secondary">
                      Review
                    </button>
                  </>
                )}
                <button onClick={handleDiscardDraft} className="ml-auto text-sm text-danger hover:underline">
                  Discard draft
                </button>
              </div>
            </div>
          )}

          {applications.length > 0 && (
            <div className="applicant-panel p-6">
              <h3 className="mb-4 text-base font-semibold text-fg">Applications</h3>

              <div className="space-y-4">
                {applications.map(app => (
                  <div key={app.id} className="rounded-card border border-line p-5 transition-colors hover:border-accent">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <StatusBadge status={app.status} />
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
                                <Copy className="h-4 w-4 text-fg-muted" />
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
