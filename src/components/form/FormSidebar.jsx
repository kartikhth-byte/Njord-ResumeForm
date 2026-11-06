import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, FileText } from 'lucide-react'
import { calculateApplicationProgress, getSectionStatus as sectionStatus } from '../../utils/applicationProgress'
import ApplicantSidebar from '../applicant/ApplicantSidebar'
import { FORM_SECTIONS } from '../../constants/formSections'

const SECTIONS = FORM_SECTIONS

// Applicant sidebar for the form and the review page: progress + the 19 sections.
// mode="review": no section is current, and section links return to review.
export default function FormSidebar({ applicationData, mode = 'form' }) {
  const navigate = useNavigate()
  const { sectionId } = useParams()
  const [searchParams] = useSearchParams()
  const onReview = mode === 'review'
  const currentSection = onReview ? null : parseInt(sectionId) || 1
  const returnToReview = onReview || searchParams.get('return') === 'review'

  const getSectionStatus = (sectionNum) => (
    sectionStatus(sectionNum, applicationData?.[`section${sectionNum}`])
  )

  const handleSectionClick = (sectionId) => {
    const suffix = returnToReview ? '?return=review' : ''
    navigate(`/application/form/section/${sectionId}${suffix}`)
  }

  const progress = calculateApplicationProgress(applicationData)

  const footer = onReview ? null : (
    <button
      onClick={() => navigate('/application/review')}
      className="applicant-action applicant-action--primary w-full"
    >
      <FileText className="w-4 h-4" />
      {returnToReview ? 'Return to review' : 'Review & submit'}
    </button>
  )

  return (
    <ApplicantSidebar footer={footer}>
      <div className="flex flex-col gap-2 px-1.5">
        <div className="flex items-center justify-between text-xs text-fg-secondary">
          <span>Progress</span>
          <span className="font-semibold text-accent-text">{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent-fill transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        {SECTIONS.map((section) => {
          const status = getSectionStatus(section.id)
          const isCurrent = currentSection === section.id
          // "Fix" only once a section has been started; untouched sections stay neutral.
          const started = Boolean(applicationData?.[`section${section.id}`]) &&
            Object.keys(applicationData[`section${section.id}`]).length > 0
          const state = status === 'complete' ? 'done' : status === 'incomplete' && started ? 'fix' : 'todo'
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSectionClick(section.id)}
              className={`recruiter-sidebar__item applicant-step-item ${isCurrent ? 'is-active' : ''}`}
              data-state={state}
              aria-current={isCurrent ? 'step' : undefined}
              title={section.title}
            >
              <span className="applicant-step-num" aria-hidden="true">
                {state === 'done' && !isCurrent ? <CheckCircle className="h-3.5 w-3.5" /> : section.id}
              </span>
              <span className="min-w-0 flex-1 truncate">{section.shortTitle}</span>
              {state === 'fix' && !isCurrent ? <span className="text-[11px] font-medium text-danger">Fix</span> : null}
              <span className="sr-only">
                {state === 'done' ? '(complete)' : state === 'fix' ? '(needs attention)' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </ApplicantSidebar>
  )
}
