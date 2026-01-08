import { useNavigate, useParams } from 'react-router-dom'
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
  AlertCircle,
  Circle
} from 'lucide-react'
import { validateSection } from '../../utils/sectionValidation'

const MANDATORY_SECTIONS = [1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19, 20]

const SECTIONS = [
  { id: 1, title: 'Availability & Application', icon: Calendar, shortTitle: 'Availability' },
  { id: 2, title: 'Personal & Contact Details', icon: User, shortTitle: 'Personal' },
  { id: 3, title: 'Passport Details', icon: FileCheck, shortTitle: 'Passport' },
  { id: 4, title: 'CDC / Seaman\'s Book', icon: Briefcase, shortTitle: 'CDC' },
  { id: 5, title: 'Visas', icon: Globe, shortTitle: 'Visas' },
  { id: 6, title: 'Education Background', icon: GraduationCap, shortTitle: 'Education' },
  { id: 7, title: 'Dependents', icon: Users, shortTitle: 'Dependents' },
  { id: 8, title: 'Certificates of Competency', icon: Award, shortTitle: 'Certificates' },
  { id: 9, title: 'GMDSS Certificates', icon: Shield, shortTitle: 'GMDSS' },
  { id: 10, title: 'Medical & Vaccination', icon: Heart, shortTitle: 'Medical' },
  { id: 11, title: 'Medical History', icon: Activity, shortTitle: 'Med History' },
  { id: 12, title: 'Foreign Languages', icon: Languages, shortTitle: 'Languages' },
  { id: 13, title: 'Physical & Uniform Details', icon: Ruler, shortTitle: 'Physical' },
  { id: 14, title: 'STCW & Marine Courses', icon: Book, shortTitle: 'STCW' },
  { id: 15, title: 'Flag State Documents', icon: Flag, shortTitle: 'Flag State' },
  { id: 16, title: 'Sea Service', icon: Anchor, shortTitle: 'Sea Service' },
  { id: 17, title: 'Experience Summary', icon: BarChart3, shortTitle: 'Experience' },
  { id: 18, title: 'References', icon: MessageSquare, shortTitle: 'References' },
{ id: 19, title: 'Emergency Contact', icon: Users, shortTitle: 'Emergency' },
  { id: 20, title: 'Declaration & Consent', icon: FileText, shortTitle: 'Declaration' },
]

export default function FormSidebar({ applicationData }) {
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

  // Calculate overall progress based on validation
  const calculateProgress = () => {
    if (!applicationData) return 0
    const completed = SECTIONS.filter(section => getSectionStatus(section.id) === 'complete').length
    return Math.round((completed / SECTIONS.length) * 100)
  }

  const handleSectionClick = (sectionId) => {
    navigate(`/application/form/section/${sectionId}`)
  }

  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
        
        <h1 className="text-xl font-bold text-gray-900 mb-1">Application Form</h1>
        <p className="text-sm text-gray-600">Complete all 20 sections</p>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Overall Progress</span>
            <span className="text-xs font-bold text-blue-600">{calculateProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-md'
                    : status === 'complete'
                    ? 'bg-green-50 text-green-900 hover:bg-green-100'
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
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{section.id}</span>
                    </div>
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
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
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-sm flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Review & Submit
        </button>
      </div>
    </aside>
  )
}