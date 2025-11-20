import { useNavigate } from 'react-router-dom'

const SECTIONS = [
  { number: 1, name: 'Availability' },
  { number: 2, name: 'Personal' },
  { number: 3, name: 'Passport' },
  { number: 4, name: 'CDC' },
  { number: 5, name: 'Vaccination' },
  { number: 6, name: 'Certificates' },
  { number: 7, name: 'Tanker' },
  { number: 8, name: 'STCW' },
  { number: 9, name: 'Training' },
  { number: 10, name: 'Sea Service' },
  { number: 11, name: 'Additional' },
  { number: 12, name: 'Declaration' },
]

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
    <div className="hidden lg:block bg-white border-b border-gray-200 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop: Horizontal circles */}
        <div className="flex items-center justify-between">
          {SECTIONS.map((section, index) => {
            const isCompleted = completedSections.includes(section.number)
            const isCurrent = currentSection === section.number
            const isAccessible = isCompleted || isCurrent || section.number === 1

            return (
              <div key={section.number} className="flex items-center">
                {/* Circle */}
                <button
                  onClick={() => handleSectionClick(section.number)}
                  disabled={!isAccessible}
                  className={`relative group ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : isAccessible
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : isCurrent ? (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    ) : (
                      section.number
                    )}
                  </div>

                  {/* Tooltip */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2">
                      {section.name}
                    </div>
                  </div>
                </button>

                {/* Connector Line */}
                {index < SECTIONS.length - 1 && (
                  <div
                    className={`h-0.5 w-8 mx-1 transition-colors ${
                      completedSections.includes(section.number) ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Section Name & Progress */}
        <div className="mt-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Section {currentSection}: {SECTIONS[currentSection - 1]?.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {completedSections.length}/12 sections complete
          </p>
        </div>
      </div>
    </div>
  )
}