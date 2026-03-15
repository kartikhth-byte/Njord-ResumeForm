/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/layout/Navbar'
import ConfirmationModal from '../components/form/shared/ConfirmationModal'
import { CheckCircle, AlertCircle, Edit, Send, AlertTriangle, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { generateReferenceNumber } from '../utils/referenceGenerator' // ← ADD THIS LINE

const SECTION_NAMES = {
  1: 'Availability & Application Details',
  2: 'Personal & Contact Details',
  3: 'Passport Details',
  4: 'CDC / National Seaman\'s Book',
  5: 'Visas',
  6: 'Education Background',
  7: 'Dependents',
  8: 'National Certificates of Competency',
  9: 'GMDSS Certificates',
  10: 'Medical Fitness & Vaccination',
  11: 'Medical History',
  12: 'Foreign Languages',
  13: 'Physical & Uniform Details',
  14: 'STCW Courses & Competencies',
  15: 'Flag State Endorsements',
  16: 'Sea Service / Employment History',
  17: 'Technical Experience & Skills',
  18: 'Professional References',
  19: 'Emergency Contact Information',
  20: 'Additional Information & Declarations',
}

// Define which sections are mandatory
const MANDATORY_SECTIONS = [
  1, 2, 3, 4, 6, 8, 10, 11, 13, 14, 16, 18, 19, 20
]

export default function ReviewSubmit() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [applicationData, setApplicationData] = useState({})
  const [applicationId, setApplicationId] = useState(null)
  const [completionStatus, setCompletionStatus] = useState({})
  const [showIncompleteModal, setShowIncompleteModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [incompleteSections, setIncompleteSections] = useState([])
  const [expandedSections, setExpandedSections] = useState({})

  useEffect(() => {
    if (user) {
      loadApplicationData()
    }
  }, [user])

  const loadApplicationData = async () => {
    try {
      setLoading(true)

      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .maybeSingle()

      if (appError) throw appError

      if (!app) {
        navigate('/dashboard')
        return
      }

      setApplicationId(app.id)

      const { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('*')
        .eq('application_id', app.id)
        .maybeSingle()

      if (dataError) throw dataError

      const data = appData?.data || {}
      setApplicationData(data)
      calculateCompletionStatus(data)
    } catch (error) {
      console.error('Error loading application:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateCompletionStatus = (data) => {
    const status = {}
    
    for (let i = 1; i <= 20; i++) {
      const sectionKey = `section${i}`
      const sectionData = data[sectionKey]
      
      if (!sectionData || Object.keys(sectionData).length === 0) {
        status[i] = 'empty'
      } else {
        const hasData = Object.values(sectionData).some(value => {
          if (Array.isArray(value)) return value.length > 0
          if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0
          if (typeof value === 'boolean') return true
          return value !== '' && value !== null && value !== undefined
        })
        status[i] = hasData ? 'complete' : 'empty'
      }
    }
    
    setCompletionStatus(status)
    return status
  }

  const validateApplication = () => {
    const incomplete = []

    MANDATORY_SECTIONS.forEach(section => {
      if (completionStatus[section] !== 'complete') {
        incomplete.push(section)
      }
    })

    const section20 = applicationData.section20 || {}
    if (!section20.accuracyDeclaration || !section20.backgroundCheckConsent || !section20.dataProcessingConsent) {
      if (!incomplete.includes(20)) incomplete.push(20)
    }
    if (!section20.fullName || !section20.signatureDate || !section20.placeOfSigning) {
      if (!incomplete.includes(20)) incomplete.push(20)
    }

    return incomplete
  }

  const handleSubmitClick = () => {
    const incomplete = validateApplication()
    
    if (incomplete.length > 0) {
      setIncompleteSections(incomplete)
      setShowIncompleteModal(true)
    } else {
      setShowConfirmModal(true)
    }
  }

const handleConfirmSubmit = async () => {
  try {
    setSubmitting(true)

    // Generate reference number
    const referenceNumber = generateReferenceNumber()
    console.log('Generated reference number:', referenceNumber)

    // Get position for success page
    const position = applicationData?.section1?.appliedForRank || 'Maritime Position'
    console.log('Position:', position)

    // Ensure public_token exists (generate if null)
    const { data: currentApp, error: fetchError } = await supabase
      .from('applications')
      .select('public_token')
      .eq('id', applicationId)
      .single()

    if (fetchError) throw fetchError

    let publicToken = currentApp?.public_token
    
    // Generate public_token if it doesn't exist
    if (!publicToken) {
      publicToken = crypto.randomUUID()
      console.log('Generated new public_token:', publicToken)
    } else {
      console.log('Using existing public_token:', publicToken)
    }

   // Update application with ALL required fields
const { error: updateError } = await supabase
  .from('applications')
  .update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    reference_number: referenceNumber,
    public_token: publicToken,
    applied_rank: position  // ← ADD THIS LINE
  })
  .eq('id', applicationId)

    if (updateError) {
      console.error('Error updating application:', updateError)
      throw updateError
    }

    console.log('✅ Application updated successfully')
    console.log('Reference number:', referenceNumber)
    console.log('Public token:', publicToken)

    // Verify the update worked
    const { data: verifyApp, error: verifyError } = await supabase
      .from('applications')
      .select('reference_number, public_token')
      .eq('id', applicationId)
      .single()

    console.log('Verification - Saved values:', verifyApp)

    if (verifyError || !verifyApp?.reference_number) {
      console.error('Verification failed:', verifyError)
      throw new Error('Failed to save application data')
    }

    // Call edge function to send recruiter email
    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        'send-application-emails',
        {
          body: { applicationId }
        }
      )

      if (emailError) {
        console.error('Email function error:', emailError)
        // Don't block submission if email fails
      } else {
        console.log('Email sent successfully:', emailData)
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      // Don't block submission if email fails
    }

    // Navigate to success page with reference number
    navigate('/application/success', {
      state: {
        referenceNumber,
        position: formatDisplayValue(position)
      }
    })

  } catch (error) {
    console.error('Error submitting application:', error)
    alert('Error submitting application. Please try again.')
  } finally {
    setSubmitting(false)
    setShowConfirmModal(false)
  }
}

  const toggleSection = (sectionNum) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionNum]: !prev[sectionNum]
    }))
  }

  const renderSectionDetails = (sectionNumber) => {
    const sectionData = applicationData[`section${sectionNumber}`]
    if (!sectionData) return <p className="text-gray-500 italic">No data provided</p>

    // Helper to render key-value pairs
    const renderField = (label, value) => {
      if (value === null || value === undefined || value === '') return null
      if (typeof value === 'boolean') return (
        <div key={label} className="grid grid-cols-3 gap-4 py-2 border-b border-gray-100">
          <span className="font-medium text-gray-700">{label}:</span>
          <span className="col-span-2 text-gray-900">{value ? 'Yes' : 'No'}</span>
        </div>
      )
      return (
        <div key={label} className="grid grid-cols-3 gap-4 py-2 border-b border-gray-100">
          <span className="font-medium text-gray-700">{label}:</span>
          <span className="col-span-2 text-gray-900">{value}</span>
        </div>
      )
    }

    // Section-specific rendering
    switch (sectionNumber) {
      case 1:
        return (
          <div className="space-y-1">
            {renderField('Position Applied For', formatDisplayValue(sectionData.appliedForRank))}
            {renderField('Vessel Type', formatDisplayValue(sectionData.vesselType))}
            {renderField('Available From', sectionData.availableFrom)}
            {renderField('Available Till', sectionData.availableTill)}
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-1">
            {renderField('Full Name', `${sectionData.firstName || ''} ${sectionData.middleName || ''} ${sectionData.lastName || ''}`)}
            {renderField('Date of Birth', sectionData.dateOfBirth)}
            {renderField('Email', sectionData.email)}
            {renderField('Phone', sectionData.phoneNumber)}
            {renderField('Nationality', sectionData.nationality)}
            {renderField('City', sectionData.city)}
            {renderField('Country', sectionData.country)}
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-1">
            {renderField('Passport Number', sectionData.passportNumber)}
            {renderField('Place of Issue', sectionData.placeOfIssue)}
            {renderField('Date of Issue', sectionData.dateOfIssue)}
            {renderField('Date of Expiry', sectionData.dateOfExpiry)}
          </div>
        )

      case 5:
        if (!sectionData.visas || sectionData.visas.length === 0) {
          return <p className="text-gray-500 italic">No visas added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.visas.map((visa, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">Visa {idx + 1}</p>
                {renderField('Type', visa.type)}
                {renderField('Number', visa.number)}
                {renderField('Expiry', visa.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 8:
        if (!sectionData.certificates || sectionData.certificates.length === 0) {
          return <p className="text-gray-500 italic">No certificates added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.certificates.map((cert, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">Certificate {idx + 1}</p>
                {renderField('Grade', cert.grade)}
                {renderField('Number', cert.certificateNumber)}
                {renderField('Issuing Authority', cert.issuingAuthority)}
                {renderField('Expiry', cert.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 16:
        if (!sectionData.seaService || sectionData.seaService.length === 0) {
          return <p className="text-gray-500 italic">No sea service added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.seaService.map((service, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-semibold text-gray-900 mb-2">{service.vesselName || `Vessel ${idx + 1}`}</p>
                {renderField('Rank', formatDisplayValue(service.rankHeld))}
                {renderField('Company', service.companyName)}
                {renderField('Vessel Type', formatDisplayValue(service.vesselType))}
                {renderField('Sign On', service.signOnDate)}
                {renderField('Sign Off', service.signOffDate)}
              </div>
            ))}
          </div>
        )

      case 20:
        return (
          <div className="space-y-1">
            {renderField('Accuracy Declaration', sectionData.accuracyDeclaration)}
            {renderField('Background Check Consent', sectionData.backgroundCheckConsent)}
            {renderField('Data Processing Consent', sectionData.dataProcessingConsent)}
            {renderField('Signature Name', sectionData.fullName)}
            {renderField('Signature Date', sectionData.signatureDate)}
            {renderField('Place of Signing', sectionData.placeOfSigning)}
          </div>
        )

      default:
        // Generic rendering for other sections
        return (
          <div className="space-y-1">
            {Object.entries(sectionData).map(([key, value]) => {
              if (Array.isArray(value)) {
                return (
                  <div key={key} className="py-2">
                    <span className="font-medium text-gray-700">{key}: </span>
                    <span className="text-gray-900">{value.length} item(s)</span>
                  </div>
                )
              }
              if (typeof value === 'object' && value !== null) {
                return null // Skip complex objects
              }
              return renderField(key, value)
            })}
          </div>
        )
    }
  }

  const getSectionSummary = (sectionNumber) => {
    const sectionData = applicationData[`section${sectionNumber}`]
    if (!sectionData) return 'Not started'

    switch (sectionNumber) {
      case 1:
        return sectionData.appliedForRank ? `Applied for: ${formatDisplayValue(sectionData.appliedForRank)}` : 'Incomplete'
      case 2:
        return sectionData.firstName ? `${sectionData.firstName} ${sectionData.lastName || ''}` : 'Incomplete'
      case 3:
        return sectionData.passportNumber ? `Passport: ${sectionData.passportNumber}` : 'Not provided'
      case 4:
        return sectionData.cdcNumber ? `CDC: ${sectionData.cdcNumber}` : 'Not provided'
      case 5:
        return sectionData.visas?.length ? `${sectionData.visas.length} visa(s)` : 'No visas added'
      case 6:
        return sectionData.education?.length ? `${sectionData.education.length} qualification(s)` : 'No education added'
      case 7:
        return sectionData.dependents?.length ? `${sectionData.dependents.length} dependent(s)` : 'No dependents'
      case 8:
        return sectionData.certificates?.length ? `${sectionData.certificates.length} certificate(s)` : 'No certificates'
      case 9:
        return sectionData.gmdss?.length ? `${sectionData.gmdss.length} GMDSS certificate(s)` : 'No GMDSS'
      case 10:
        return sectionData.medicalFitness?.length ? `${sectionData.medicalFitness.length} medical certificate(s)` : 'Not provided'
      case 11:
        return sectionData.medicalHistory?.signedOffMedical ? 'Medical history provided' : 'No medical incidents'
      case 12:
        return sectionData.languages?.length ? `${sectionData.languages.length} language(s)` : 'No languages'
      case 13:
        return sectionData.height ? `Height: ${sectionData.height}, Weight: ${sectionData.weight}` : 'Incomplete'
      case 14:
        return sectionData.courses?.length ? `${sectionData.courses.length} STCW course(s)` : 'No courses'
      case 15:
        return sectionData.endorsements?.length ? `${sectionData.endorsements.length} endorsement(s)` : 'No endorsements'
      case 16:
        return sectionData.seaService?.length ? `${sectionData.seaService.length} vessel(s)` : 'No sea service'
      case 17:
        return 'Technical skills provided'
      case 18:
        return sectionData.references?.length ? `${sectionData.references.length} reference(s)` : 'No references'
      case 19:
        return sectionData.contacts?.length ? `${sectionData.contacts.length} emergency contact(s)` : 'No contacts'
      case 20:
        return sectionData.accuracyDeclaration ? 'Declarations complete' : 'Declarations incomplete'
      default:
        return 'Data provided'
    }
  }

  const completedSections = Object.values(completionStatus).filter(s => s === 'complete').length
  const totalSections = 20
  const completionPercentage = Math.round((completedSections / totalSections) * 100)
  const canSubmit = validateApplication().length === 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>

          <h1 className="text-3xl font-bold text-gray-900">Review & Submit Application</h1>
          <p className="text-gray-600 mt-2">
            Review all sections and submit your application
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Application Progress</h2>
            <span className="text-2xl font-bold text-blue-600">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {completedSections} of {totalSections} sections completed
          </p>
        </div>

        {/* Section List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Application Sections</h2>
            <p className="text-sm text-gray-600 mt-1">
              Click "Review" to expand and see details, or "Edit" to modify any section
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {Object.keys(SECTION_NAMES).map((sectionNum) => {
              const num = parseInt(sectionNum)
              const isComplete = completionStatus[num] === 'complete'
              const isMandatory = MANDATORY_SECTIONS.includes(num)
              const isExpanded = expandedSections[num]
              
              return (
                <div key={num} className="transition-colors">
                  <div className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {isComplete ? (
                          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                        ) : (
                          <AlertCircle className={`w-6 h-6 flex-shrink-0 ${isMandatory ? 'text-red-500' : 'text-amber-500'}`} />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">
                              Section {num}: {SECTION_NAMES[num]}
                            </h3>
                            {isMandatory && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                REQUIRED
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {getSectionSummary(num)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSection(num)}
                          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              <span className="text-sm font-medium">Hide</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              <span className="text-sm font-medium">Review</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => navigate(`/application/form/section/${num}`)}
                          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Section Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        {renderSectionDetails(num)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Submit Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ready to Submit?</h2>
          
          {canSubmit ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900">All Required Sections Complete!</h3>
                  <p className="text-sm text-green-800 mt-1">
                    All mandatory sections have been completed. You can now submit your application.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900">Required Sections Incomplete</h3>
                  <p className="text-sm text-red-800 mt-1">
                    Please complete all required sections before submitting. Required sections are marked with a "REQUIRED" badge above.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              By clicking "Submit Application", you confirm that all information provided is accurate and complete. Once submitted, you will receive a confirmation email and our team will review your application.
            </p>

            <button
              onClick={handleSubmitClick}
              disabled={submitting || !canSubmit}
              className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg transition-colors font-semibold text-lg ${
                canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Application
                </>
              )}
            </button>

            {!canSubmit && (
              <p className="text-xs text-center text-gray-500">
                Complete all required sections to enable submission
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Incomplete Sections Modal */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowIncompleteModal(false)}></div>
          
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
              <button
                onClick={() => setShowIncompleteModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-200">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>

                <h3 className="mt-4 text-xl font-semibold text-gray-900 text-center">
                  Required Sections Incomplete
                </h3>

                <p className="mt-2 text-sm text-gray-600 text-center">
                  Please complete the following required sections before submitting:
                </p>

                <div className="mt-4 space-y-2">
                  {incompleteSections.map(sectionNum => (
                    <button
                      key={sectionNum}
                      onClick={() => {
                        setShowIncompleteModal(false)
                        navigate(`/application/form/section/${sectionNum}`)
                      }}
                      className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-red-900">
                        Section {sectionNum}: {SECTION_NAMES[sectionNum]}
                      </span>
                      <Edit className="w-4 h-4 text-red-600" />
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowIncompleteModal(false)}
                  className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Submission"
        message={
          <div className="space-y-2">
            <p>Are you sure you want to submit your application?</p>
            <p className="font-semibold">Once submitted, you will not be able to edit your application.</p>
            <p className="text-xs">You will receive a confirmation email and our team will review your application.</p>
          </div>
        }
        type="success"
        confirmText="Submit Application"
        cancelText="Review Again"
        isLoading={submitting}
      />
    </div>
  )
}
