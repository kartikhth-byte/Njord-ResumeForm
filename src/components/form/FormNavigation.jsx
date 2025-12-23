import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Circle } from 'lucide-react'
import { validateSection } from '../../utils/sectionValidation'

const MANDATORY_SECTIONS = [1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19, 20]

export default function FormNavigation({ applicationData }) {
  const navigate = useNavigate()
  const { sectionId } = useParams()
  const currentSection = parseInt(sectionId) || 1

  // Get section status using validation
  const getSectionStatus = (sectionNum) => {
    if (!applicationData) return 'empty'
    
    const sectionData = applicationData[`section${sectionNum}`]
    const isMandatory = MANDATORY_SECTIONS.includes(sectionNum)
    
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
    <div className="bg-white px-4 py-3 border-b overflow-x-auto">
      {/* Progress circles for mobile - Now 20 sections */}
      <div className="flex items-center gap-2 min-w-max">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((section) => {
          const status = getSectionStatus(section)
          const isCurrent = currentSection === section

          return (
            <button
              key={section}
              onClick={() => handleSectionClick(section)}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                isCurrent
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : status === 'complete'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : status === 'incomplete'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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
        <p className="text-xs text-gray-500">
          Section {currentSection} of 20
        </p>
      </div>
    </div>
  )
}