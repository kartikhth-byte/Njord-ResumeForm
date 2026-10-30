import { useNavigate } from 'react-router-dom'
import { FORM_SECTIONS, FORM_SECTION_NAME_MAP } from '../../constants/formSections'

const SECTIONS = FORM_SECTIONS.map((section) => ({
  number: section.id,
  name: section.shortTitle,
}))

export default function ProgressIndicator({ currentSection = 1, completedSections = [] }) {
  const navigate = useNavigate()

  const handleSectionClick = (sectionNumber) => {
    const isCompleted = completedSections.includes(sectionNumber)
    const isCurrent = currentSection === sectionNumber
    const isAccessible = isCompleted || isCurrent || sectionNumber === 1

    if (isAccessible) {
      navigate(`/application/form/section/${sectionNumber}`)
    }
  }

  return (
    <div className="applicant-progress-bar hidden lg:block">
      <div className="applicant-progress-bar__inner">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="mt-2 text-lg font-semibold text-fg">
              Section {currentSection}: {FORM_SECTION_NAME_MAP[currentSection]}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              {completedSections.length}/{SECTIONS.length} sections complete
            </p>
          </div>
        </div>

        <div className="applicant-progress-track">
          {SECTIONS.map(section => {
            const isCompleted = completedSections.includes(section.number)
            const isCurrent = currentSection === section.number
            const isAccessible = isCompleted || isCurrent || section.number === 1

            return (
              <button
                key={section.number}
                onClick={() => handleSectionClick(section.number)}
                disabled={!isAccessible}
                className={`applicant-progress-step ${isCurrent ? 'is-active' : ''} ${isCompleted ? 'is-complete' : ''} ${
                  isAccessible ? '' : 'opacity-45'
                }`}
              >
                <div className="applicant-progress-step__number">
                  {isCompleted ? 'Done' : `S${section.number}`}
                </div>
                <div className="applicant-progress-step__label">{section.name}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
