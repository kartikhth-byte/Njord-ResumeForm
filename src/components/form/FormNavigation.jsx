import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Circle } from 'lucide-react'
import { validateSection } from '../../utils/sectionValidation'
import { FORM_SECTION_NUMBERS, MANDATORY_SECTION_NUMBERS } from '../../constants/formSections'

export default function FormNavigation({ applicationData }) {
  const navigate = useNavigate()
  const { sectionId } = useParams()
  const currentSection = parseInt(sectionId) || 1

  // Get section status using validation
  const getSectionStatus = (sectionNum) => {
    if (!applicationData) return 'empty'
    
    const sectionData = applicationData[`section${sectionNum}`]
    const isMandatory = MANDATORY_SECTION_NUMBERS.includes(sectionNum)
    
    // Empty section
    if (!sectionData || Object.keys(sectionData).length === 0) {
      return isMandatory ? 'incomplete' : 'empty'
    }
    
    // Validate section
    const validation = validateSection(sectionNum, sectionData)
    
    if (validation.isValid) {
      return 'complete'
    } else {
      return 'incomplete'
    }
  }

  const handleSectionClick = (section) => {
    navigate(`/application/form/section/${section}`)
  }

  return (
    <div className="bg-surface px-4 py-3 border-b overflow-x-auto">
      {/* Progress circles for mobile */}
      <div className="flex items-center gap-2 min-w-max">
        {FORM_SECTION_NUMBERS.map((section) => {
          const status = getSectionStatus(section)
          const isCurrent = currentSection === section

          return (
            <button
              key={section}
              onClick={() => handleSectionClick(section)}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
 isCurrent
 ? 'bg-accent-fill text-on-accent ring-4 ring-accent/30'
 : status === 'complete'
 ? 'bg-success-soft text-success hover:bg-success-soft'
 : status === 'incomplete'
 ? 'bg-danger-soft text-danger hover:bg-danger-soft'
 : 'bg-raised text-fg-muted hover:bg-line'
 }`}
            >
              {status === 'complete' && !isCurrent ? (
                <CheckCircle className="w-5 h-5" />
              ) : status === 'incomplete' && !isCurrent ? (
                <AlertCircle className="w-5 h-5" />
              ) : !isCurrent ? (
                <Circle className="w-5 h-5" />
              ) : (
                section
              )}
            </button>
          )
        })}
      </div>

      {/* Section title */}
      <div className="mt-2">
        <p className="text-xs text-fg-muted">
          Section {currentSection} of {FORM_SECTION_NUMBERS.length}
        </p>
      </div>
    </div>
  )
}
