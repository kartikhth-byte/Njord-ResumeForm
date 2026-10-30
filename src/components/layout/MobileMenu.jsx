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
        className="fixed inset-0 z-40 bg-accent-fill/50 lg:hidden"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 z-50 w-80 overflow-y-auto border-r border-line bg-surface shadow-overlay lg:hidden">
        {/* Header */}
        <div className="border-b border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">Application Sections</h2>
            <button
              onClick={onClose}
              className="rounded-card p-2 text-fg-muted transition-colors hover:bg-raised"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {SECTIONS.map((section) => {
            const isCompleted = completedSections.includes(section.number)
            const isCurrent = currentSection === section.number

            return (
              <button
                key={section.number}
                onClick={() => handleSectionClick(section.number)}
                className={`w-full flex items-center gap-3 rounded-card p-3 transition-colors ${
 isCurrent
 ? 'border-2 border-accent bg-accent-soft'
 : isCompleted
 ? 'border border-success-line bg-success-soft hover:bg-success-soft'
 : 'border border-line bg-raised hover:bg-raised'
 }`}
              >
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium ${
 isCurrent
 ? 'bg-accent-fill text-bg'
 : isCompleted
 ? 'bg-success text-bg'
 : 'bg-line-strong text-fg-secondary'
 }`}
                >
                  {isCompleted ? '✓' : section.number}
                </div>

                <div className="flex-1 text-left">
                  <div
                    className={`text-sm font-medium ${
 isCurrent
 ? 'text-accent-text'
 : isCompleted
 ? 'text-success'
 : 'text-fg'
 }`}
                  >
                    Section {section.number}
                  </div>
                  <div
                    className={`text-xs ${
 isCurrent
 ? 'text-accent-text'
 : isCompleted
 ? 'text-success'
 : 'text-fg-secondary'
 }`}
                  >
                    {section.name}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-line p-4">
          <div className="text-center text-xs text-fg-muted">
            {completedSections.length}/{SECTIONS.length} sections complete
          </div>
        </div>
      </div>
    </>
  )
}
