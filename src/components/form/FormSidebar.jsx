import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { 
  Calendar,
  User,
  FileCheck,
  Briefcase,
  Globe,
  GraduationCap,
  Users,
  Award,
  Shield,
  Heart,
  Activity,
  Languages,
  Ruler,
  Book,
  Flag,
  Anchor,
  BarChart3,
  MessageSquare,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { validateSection } from '../../utils/sectionValidation'
import { FORM_SECTIONS, MANDATORY_SECTION_NUMBERS } from '../../constants/formSections'

const SECTION_ICONS = {
  1: Calendar,
  2: User,
  3: FileCheck,
  4: Briefcase,
  5: Globe,
  6: GraduationCap,
  7: Users,
  8: Award,
  9: Shield,
  10: Heart,
  11: Activity,
  12: Languages,
  13: Ruler,
  14: Book,
  15: Flag,
  16: Anchor,
  17: BarChart3,
  18: MessageSquare,
  19: FileText,
}

const SECTIONS = FORM_SECTIONS.map((section) => ({
  ...section,
  icon: SECTION_ICONS[section.id],
}))

export default function FormSidebar({ applicationData }) {
  const navigate = useNavigate()
  const { sectionId } = useParams()
  const [searchParams] = useSearchParams()
  const currentSection = parseInt(sectionId) || 1
  const returnToReview = searchParams.get('return') === 'review'

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

  // Calculate overall progress based on validation
  const calculateProgress = () => {
    if (!applicationData) return 0
    const completed = SECTIONS.filter(section => getSectionStatus(section.id) === 'complete').length
    return Math.round((completed / SECTIONS.length) * 100)
  }

  const handleSectionClick = (sectionId) => {
    const suffix = returnToReview ? '?return=review' : ''
    navigate(`/application/form/section/${sectionId}${suffix}`)
  }

  return (
    <aside className="w-80 border-r border-gray-200 bg-white/90 backdrop-blur flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <button
          onClick={() => navigate(returnToReview ? '/application/review' : '/dashboard')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">{returnToReview ? 'Back to Review' : 'Back to Dashboard'}</span>
        </button>
        
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Resume Application</p>
        <h1 className="mt-2 text-xl font-bold text-gray-900 mb-1">Complete your profile</h1>
        <p className="text-sm text-gray-600">Work through the guided sections, then review everything before submitting.</p>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Overall Progress</span>
            <span className="text-xs font-bold text-blue-600">{calculateProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sections List */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            const status = getSectionStatus(section.id)
            const isCurrent = currentSection === section.id

            return (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={`applicant-step w-full text-left ${
                  isCurrent
                    ? 'is-current'
                    : status === 'complete'
                    ? 'is-complete text-green-900 hover:bg-green-100'
                    : status === 'incomplete'
                    ? 'bg-red-50 text-red-900 hover:bg-red-100'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {/* Icon/Status */}
                <div className={`flex-shrink-0 ${isCurrent ? 'text-white' : ''}`}>
                  {status === 'complete' && !isCurrent ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : status === 'incomplete' && !isCurrent ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : isCurrent ? (
                    <div className="applicant-step__number">
                      <span className="text-xs font-bold">{section.id}</span>
                    </div>
                  ) : (
                    <div className="applicant-step__number">
                      <span className="text-xs font-bold">{section.id}</span>
                    </div>
                  )}
                </div>

                {/* Section Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${
                      isCurrent 
                        ? 'text-white' 
                        : status === 'complete' 
                        ? 'text-green-600' 
                        : status === 'incomplete'
                        ? 'text-red-600'
                        : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium truncate ${
                      isCurrent ? 'text-white' : ''
                    }`}>
                      {section.shortTitle}
                    </span>
                  </div>
                </div>

                {/* Section Number Badge (for non-current) */}
                {!isCurrent && (
                  <span className={`text-xs font-semibold ${
                    status === 'complete' 
                      ? 'text-green-700' 
                      : status === 'incomplete'
                      ? 'text-red-700'
                      : 'text-gray-400'
                  }`}>
                    {section.id}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/application/review')}
          className="applicant-action applicant-action--primary w-full"
        >
          <FileText className="w-4 h-4" />
          {returnToReview ? 'Return to Review' : 'Review & Submit'}
        </button>
      </div>
    </aside>
  )
}
