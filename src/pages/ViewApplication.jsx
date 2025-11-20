import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, AlertCircle, Printer, ArrowLeft } from 'lucide-react'

export default function ViewApplication() {
  const { publicToken } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadApplication()
  }, [publicToken])

  const loadApplication = async () => {
    try {
      setLoading(true)

      // Get application by public token
      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('public_token', publicToken)
        .eq('status', 'submitted')
        .single()

      if (appError) {
        setError('Application not found or not yet submitted')
        return
      }

      setApplication(app)

      // Get application data
      const { data: appData, error: dataError } = await supabase
        .from('application_data')
        .select('*')
        .eq('application_id', app.id)
        .single()

      if (dataError) {
        setError('Application data not found')
        return
      }

      setApplicationData(appData?.data || {})
    } catch (error) {
      console.error('Error loading application:', error)
      setError('Failed to load application')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Hide on print */}
      <div className="bg-white border-b shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Njordships Maritime Recruitment</h1>
                <p className="text-sm text-gray-600">Application View</p>
              </div>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block bg-white p-8 border-b">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Njordships Maritime Recruitment</h1>
          <p className="text-gray-600">Seafarer Application</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 print:p-8">
        {/* Application Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6 print:shadow-none print:border-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {applicationData?.section2?.firstName} {applicationData?.section2?.lastName}
              </h2>
              <p className="text-gray-600 mt-1">
                Applied for: {applicationData?.section1?.appliedForRank || 'Not specified'}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Submitted
              </span>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(application.submitted_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Application Sections */}
        <div className="space-y-6">
          {/* Section 1: Availability */}
          <ViewSection title="Availability Details">
            <ViewRow label="Present Rank" value={applicationData?.section1?.presentRank} />
            <ViewRow label="Applied For Rank" value={applicationData?.section1?.appliedForRank} />
            <ViewRow label="Available From" value={applicationData?.section1?.availableFrom} />
            <ViewRow label="Available Till" value={applicationData?.section1?.availableTill || 'Not specified'} />
          </ViewSection>

          {/* Section 2: Personal Details */}
          <ViewSection title="Personal & Contact Details">
            <ViewRow label="Full Name" value={`${applicationData?.section2?.firstName || ''} ${applicationData?.section2?.middleName || ''} ${applicationData?.section2?.lastName || ''}`} />
            <ViewRow label="Date of Birth" value={applicationData?.section2?.dateOfBirth} />
            <ViewRow label="Gender" value={applicationData?.section2?.gender} />
            <ViewRow label="Nationality" value={applicationData?.section2?.nationality} />
            <ViewRow label="Email" value={applicationData?.section2?.email} />
            <ViewRow label="Phone" value={`+${applicationData?.section2?.phoneCountryCode || ''} ${applicationData?.section2?.phoneNumber || ''}`} />
            <ViewRow label="Address" value={applicationData?.section2?.address} />
            <ViewRow label="City" value={applicationData?.section2?.city} />
            <ViewRow label="State" value={applicationData?.section2?.state} />
            <ViewRow label="Country" value={applicationData?.section2?.country} />
            <ViewRow label="Postal Code" value={applicationData?.section2?.postalCode} />
            <ViewRow label="Marital Status" value={applicationData?.section2?.maritalStatus} />
          </ViewSection>

          {/* Section 3: Passport */}
          <ViewSection title="Passport Details">
            <ViewRow label="Passport Number" value={applicationData?.section3?.passportNumber} />
            <ViewRow label="Country of Issue" value={applicationData?.section3?.countryOfIssue} />
            <ViewRow label="Place of Issue" value={applicationData?.section3?.placeOfIssue} />
            <ViewRow label="Date of Issue" value={applicationData?.section3?.dateOfIssue} />
            <ViewRow label="Date of Expiry" value={applicationData?.section3?.dateOfExpiry} />
            <ViewRow label="Place of Birth" value={applicationData?.section3?.placeOfBirth} />
          </ViewSection>

          {/* Section 4: CDC */}
          <ViewSection title="CDC Details">
            <ViewRow label="CDC Number" value={applicationData?.section4?.cdcNumber} />
            <ViewRow label="Country of Issue" value={applicationData?.section4?.countryOfIssue} />
            <ViewRow label="Date of Issue" value={applicationData?.section4?.dateOfIssue} />
            <ViewRow label="Date of Expiry" value={applicationData?.section4?.dateOfExpiry} />
          </ViewSection>

          {/* Section 5: Vaccination */}
          <ViewSection title="Vaccination Status">
            <ViewRow label="COVID-19" value={applicationData?.section5?.covidVaccinated ? `Yes (${applicationData?.section5?.covidDoses} doses, last: ${applicationData?.section5?.covidLastDoseDate})` : 'No'} />
            <ViewRow label="Yellow Fever" value={applicationData?.section5?.yellowFever ? `Yes (${applicationData?.section5?.yellowFeverDate})` : 'No'} />
            <ViewRow label="Hepatitis A" value={applicationData?.section5?.hepatitisA ? `Yes (${applicationData?.section5?.hepatitisADate})` : 'No'} />
            <ViewRow label="Hepatitis B" value={applicationData?.section5?.hepatitisB ? `Yes (${applicationData?.section5?.hepatitisBDate})` : 'No'} />
            <ViewRow label="Typhoid" value={applicationData?.section5?.typhoid ? `Yes (${applicationData?.section5?.typhoidDate})` : 'No'} />
            <ViewRow label="Tetanus" value={applicationData?.section5?.tetanus ? `Yes (${applicationData?.section5?.tetanusDate})` : 'No'} />
            <ViewRow label="Measles" value={applicationData?.section5?.measles ? `Yes (${applicationData?.section5?.measlesDate})` : 'No'} />
            <ViewRow label="Polio" value={applicationData?.section5?.polio ? `Yes (${applicationData?.section5?.polioDate})` : 'No'} />
            <ViewRow label="Other Vaccinations" value={applicationData?.section5?.otherVaccinations || 'None'} />
          </ViewSection>

          {/* Section 6: Certificates */}
          <ViewSection title="Certificates of Competency">
            {applicationData?.section6?.certificates?.length > 0 ? (
              applicationData.section6.certificates.map((cert, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">Certificate {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Type" value={cert.certificateType} />
                    <ViewRow label="Number" value={cert.certificateNumber} />
                    <ViewRow label="Issuing Authority" value={cert.issuingAuthority} />
                    <ViewRow label="Country" value={cert.countryOfIssue} />
                    <ViewRow label="Date of Issue" value={cert.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={cert.dateOfExpiry} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No certificates added</p>
            )}
          </ViewSection>

          {/* Section 7: Tanker Experience */}
          <ViewSection title="Tanker Experience">
            <ViewRow label="Has Tanker Experience" value={applicationData?.section7?.hasTankerExperience ? 'Yes' : 'No'} />
            {applicationData?.section7?.hasTankerExperience && (
              <>
                <ViewRow label="Total Months" value={applicationData?.section7?.totalMonthsTanker} />
                <ViewRow label="Oil Tanker" value={applicationData?.section7?.oilTanker ? 'Yes' : 'No'} />
                <ViewRow label="Chemical Tanker" value={applicationData?.section7?.chemicalTanker ? 'Yes' : 'No'} />
                <ViewRow label="LPG Tanker" value={applicationData?.section7?.lpgTanker ? 'Yes' : 'No'} />
                <ViewRow label="LNG Tanker" value={applicationData?.section7?.lngTanker ? 'Yes' : 'No'} />
                {applicationData?.section7?.tankerDetails && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Details:</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{applicationData.section7.tankerDetails}</p>
                  </div>
                )}
              </>
            )}
          </ViewSection>

          {/* Section 8: STCW */}
          <ViewSection title="STCW Courses">
            {applicationData?.section8?.courses && Object.keys(applicationData.section8.courses).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(applicationData.section8.courses).map(([courseId, courseData], index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <span className="text-sm text-gray-900">{courseId.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="text-xs text-gray-500">
                      {courseData.completionDate || 'Date not provided'} 
                      {courseData.certificateNumber && ` • ${courseData.certificateNumber}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No STCW courses added</p>
            )}
          </ViewSection>

          {/* Section 9: Additional Training */}
          <ViewSection title="Additional Training">
            {applicationData?.section9?.courses && Object.keys(applicationData.section9.courses).length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(applicationData.section9.courses).map((courseId, index) => (
                  <div key={index} className="text-sm text-gray-700">
                    • {courseId.replace(/_/g, ' ').toUpperCase()}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No additional training</p>
            )}
            {applicationData?.section9?.otherTraining && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Other Training:</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{applicationData.section9.otherTraining}</p>
              </div>
            )}
          </ViewSection>

          {/* Section 10: Sea Service */}
          <ViewSection title="Sea Service">
            {applicationData?.section10?.vessels?.length > 0 ? (
              applicationData.section10.vessels.map((vessel, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">{vessel.vesselName || `Vessel ${index + 1}`}</p>
                  <div className="space-y-2">
                    <ViewRow label="Type" value={vessel.vesselType} />
                    <ViewRow label="IMO Number" value={vessel.imoNumber} />
                    <ViewRow label="Flag" value={vessel.flag} />
                    <ViewRow label="GRT" value={vessel.grt} />
                    <ViewRow label="Rank Held" value={vessel.rankHeld} />
                    <ViewRow label="Sign On" value={vessel.signOnDate} />
                    <ViewRow label="Sign Off" value={vessel.signOffDate} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No vessels added</p>
            )}
          </ViewSection>

          {/* Section 11: Additional Information */}
          <ViewSection title="Additional Information">
            <ViewRow label="Additional Information" value={applicationData?.section11?.additionalInfo || 'Not provided'} />
            <ViewRow label="Special Skills" value={applicationData?.section11?.specialSkills || 'Not provided'} />
            
            {applicationData?.section11?.reference1Name && (
              <div className="mt-6">
                <p className="font-semibold text-gray-900 mb-3">Reference 1</p>
                <div className="space-y-2">
                  <ViewRow label="Name" value={applicationData.section11.reference1Name} />
                  <ViewRow label="Position" value={applicationData.section11.reference1Position} />
                  <ViewRow label="Company" value={applicationData.section11.reference1Company} />
                  <ViewRow label="Contact" value={applicationData.section11.reference1Contact} />
                </div>
              </div>
            )}

            {applicationData?.section11?.reference2Name && (
              <div className="mt-6">
                <p className="font-semibold text-gray-900 mb-3">Reference 2</p>
                <div className="space-y-2">
                  <ViewRow label="Name" value={applicationData.section11.reference2Name} />
                  <ViewRow label="Position" value={applicationData.section11.reference2Position} />
                  <ViewRow label="Company" value={applicationData.section11.reference2Company} />
                  <ViewRow label="Contact" value={applicationData.section11.reference2Contact} />
                </div>
              </div>
            )}
          </ViewSection>

          {/* Section 12: Declaration */}
          <ViewSection title="Declaration & Consent">
            <ViewRow label="Privacy Policy" value={applicationData?.section12?.privacyPolicyAccepted ? '✓ Accepted' : '✗ Not accepted'} />
            <ViewRow label="Terms & Conditions" value={applicationData?.section12?.termsAccepted ? '✓ Accepted' : '✗ Not accepted'} />
            <ViewRow label="Information Accurate" value={applicationData?.section12?.informationAccurate ? '✓ Confirmed' : '✗ Not confirmed'} />
            <ViewRow label="Background Check" value={applicationData?.section12?.backgroundCheckConsent ? '✓ Consented' : '✗ Not consented'} />
            <ViewRow label="Communication Consent" value={applicationData?.section12?.communicationConsent ? '✓ Yes' : '✗ No'} />
          </ViewSection>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 print:mt-12">
          <p>Njordships Maritime Recruitment • recruitment@njordships.com</p>
          <p className="mt-1">Application ID: {application.public_token}</p>
        </div>
      </div>
    </div>
  )
}

// Helper Components
function ViewSection({ title, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 print:shadow-none print:border print:break-inside-avoid">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">{title}</h3>
      {children}
    </div>
  )
}

function ViewRow({ label, value }) {
  return (
    <div className="flex py-2 border-b last:border-b-0">
      <span className="text-sm font-medium text-gray-600 w-1/3">{label}:</span>
      <span className="text-sm text-gray-900 w-2/3">{value || 'Not provided'}</span>
    </div>
  )
}