import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  { number: 1, name: 'Availability Details' },
  { number: 2, name: 'Personal & Contact Details' },
  { number: 3, name: 'Passport Details' },
  { number: 4, name: 'CDC Details' },
  { number: 5, name: 'Vaccination Status' },
  { number: 6, name: 'Certificates of Competency' },
  { number: 7, name: 'Tanker Experience' },
  { number: 8, name: 'STCW Courses' },
  { number: 9, name: 'Additional Training' },
  { number: 10, name: 'Sea Service' },
  { number: 11, name: 'Additional Information' },
  { number: 12, name: 'Declaration' },
]

export default function MobileMenu({ isOpen, onClose, currentSection = 1, completedSections = [] }) {
  const navigate = useNavigate()

  const handleSectionClick = (sectionNumber) => {
    navigate(`/application/form/section/${sectionNumber}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Slide-in Menu */}
      <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-xl z-50 lg:hidden overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Application Sections</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sections List */}
        <div className="p-4 space-y-2">
          {SECTIONS.map((section) => {
            const isCompleted = completedSections.includes(section.number)
            const isCurrent = currentSection === section.number
            const isAccessible = isCompleted || isCurrent || section.number === 1

            return (
              <button
                key={section.number}
                onClick={() => isAccessible && handleSectionClick(section.number)}
                disabled={!isAccessible}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : isCompleted
                    ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                    : isAccessible
                    ? 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    : 'bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed'
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? '✓' : isCurrent ? '⏳' : '○'}
                </div>

                {/* Text */}
                <div className="flex-1 text-left">
                  <div
                    className={`text-sm font-medium ${
                      isCurrent
                        ? 'text-blue-900'
                        : isCompleted
                        ? 'text-green-900'
                        : isAccessible
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }`}
                  >
                    Section {section.number}
                  </div>
                  <div
                    className={`text-xs ${
                      isCurrent
                        ? 'text-blue-600'
                        : isCompleted
                        ? 'text-green-600'
                        : isAccessible
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {section.name}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            {completedSections.length}/12 sections complete
          </div>
        </div>
      </div>
    </>
  )
}