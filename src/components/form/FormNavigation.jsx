import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { FORM_SECTION_NUMBERS } from '../../constants/formSections'

// Previous / Next under each form section. The sidebar holds the full list.
export default function FormNavigation() {
  const navigate = useNavigate()
  const { sectionId } = useParams()
  const currentSection = parseInt(sectionId) || 1
  const index = FORM_SECTION_NUMBERS.indexOf(currentSection)
  const previous = index > 0 ? FORM_SECTION_NUMBERS[index - 1] : null
  const next = index >= 0 && index < FORM_SECTION_NUMBERS.length - 1 ? FORM_SECTION_NUMBERS[index + 1] : null

  const go = (path) => {
    navigate(path)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex items-center justify-between gap-4">
      {previous ? (
        <button
          type="button"
          onClick={() => go(`/application/form/section/${previous}`)}
          className="applicant-action applicant-action--secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
      ) : <span />}

      <span className="text-xs text-fg-muted">
        Section {currentSection} of {FORM_SECTION_NUMBERS.length}
      </span>

      {next ? (
        <button
          type="button"
          onClick={() => go(`/application/form/section/${next}`)}
          className="applicant-action applicant-action--primary"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => go('/application/review')}
          className="applicant-action applicant-action--primary"
        >
          Review and submit
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
