import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function FormNavigation({ applicationData }) {
  const navigate = useNavigate()
  const { sectionId } = useParams()
  const currentSection = parseInt(sectionId) || 1

  // Check if section is completed
  const isSectionCompleted = (sectionNum) => {
    if (!applicationData) return false
    const sectionData = applicationData[`section${sectionNum}`]
    return sectionData && Object.keys(sectionData).length > 0
  }

  const handleSectionClick = (section) => {
    navigate(`/application/form/section/${section}`)
  }

  return (
    <div className="bg-white px-4 py-3 border-b overflow-x-auto">
      {/* Progress circles for mobile - Now 20 sections */}
      <div className="flex items-center gap-2 min-w-max">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((section) => {
          const isCompleted = isSectionCompleted(section)
          const isCurrent = currentSection === section

          return (
            <button
              key={section}
              onClick={() => handleSectionClick(section)}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                isCurrent
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : isCompleted
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isCompleted && !isCurrent ? (
                <CheckCircle className="w-5 h-5" />
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