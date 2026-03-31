import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FORM_SECTIONS } from '../../constants/formSections'

const SECTIONS = FORM_SECTIONS.map((section) => ({
  number: section.id,
  name: section.title,
}))

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
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 z-50 w-80 overflow-y-auto border-r border-slate-200 bg-white shadow-xl lg:hidden">
        {/* Header */}
        <div className="border-b border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Application Sections</h2>
            <button
              onClick={onClose}
              className="rounded-2xl p-2 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Move through the profile one section at a time. Your draft stays saved as you go.
          </p>
        </div>

        <div className="p-4 space-y-2">
          {SECTIONS.map((section) => {
            const isCompleted = completedSections.includes(section.number)
            const isCurrent = currentSection === section.number

            return (
              <button
                key={section.number}
                onClick={() => handleSectionClick(section.number)}
                className={`w-full flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                  isCurrent
                    ? 'border-2 border-blue-500 bg-blue-50'
                    : isCompleted
                    ? 'border border-green-200 bg-green-50 hover:bg-green-100'
                    : 'border border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? '✓' : section.number}
                </div>

                <div className="flex-1 text-left">
                  <div
                    className={`text-sm font-medium ${
                      isCurrent
                        ? 'text-blue-900'
                        : isCompleted
                        ? 'text-green-900'
                        : 'text-gray-900'
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
                        : 'text-gray-600'
                    }`}
                  >
                    {section.name}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="text-center text-xs text-gray-500">
            {completedSections.length}/{SECTIONS.length} sections complete
          </div>
        </div>
      </div>
    </>
  )
}
