import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/auth/AuthContext'
import { Loader2, AlertCircle, Printer, ArrowLeft } from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { usePermissions } from '../hooks/usePermissions'
import RejectionHistory from '../components/recruiter/RejectionHistory'
import ReopenApplicationButton from '../components/recruiter/ReopenApplicationButton'

// Add this style tag to hide browser print headers/footers
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @page {
      margin: 0.5cm;
    }
    @media print {
      @page {
        margin-top: 0.5cm;
        margin-bottom: 0.5cm;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
  `
  document.head.appendChild(style)
}

export default function ViewApplication() {
  const { publicToken } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role, loading: permLoading } = usePermissions(user)
  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState(null)
  const [applicationData, setApplicationData] = useState(null)
  const [error, setError] = useState(null)
  const [copiedRef, setCopiedRef] = useState(false)

  useEffect(() => {
    loadApplication()
  }, [publicToken])

  const loadApplication = async () => {
    try {
      setLoading(true)

      const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('public_token', publicToken)
        .not('submitted_at', 'is', null)  // Only show submitted applications
        .single()

      if (appError) {
        setError('Application not found or not yet submitted')
        return
      }

      setApplication(app)

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

  const refreshApplication = async () => {
  // Reload application data
  const { data, error } = await supabase
    .from('applications')
    .select('*, application_data(data)')
    .eq('id', applicationId)
    .single()
  
  if (!error && data) {
    setApplication(data)
  }
}

  const handlePrint = () => {
    window.print()
  }

const handleBack = () => {
  navigate(-1) // Always go back to previous page
}

  // Helper to parse JSON strings safely
  const parseJSON = (str) => {
    if (!str) return null
    if (typeof str === 'object') return str
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  // Helper to get photo URL from storage path
  const getPhotoUrl = (storagePath) => {
    if (!storagePath) return null
    
    // If it's already a full URL, return it
    if (storagePath.startsWith('http')) {
      return storagePath
    }
    
    // Otherwise, construct public URL from storage path
    const { data } = supabase.storage
      .from('application-photos')
      .getPublicUrl(storagePath)
    
    return data.publicUrl
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

  // Parse nextOfKin and emergencyContact
  const nextOfKin = parseJSON(applicationData?.section2?.nextOfKin)
  const emergencyContact = parseJSON(applicationData?.section2?.emergencyContact)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Hide on print */}
      <div className="bg-white border-b shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
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
<div className="flex items-center gap-3">
  {/* Reopen button for rejected or withdrawn applications */}
  {(application.status === 'rejected' || application.status === 'withdrawn') && (
    <ReopenApplicationButton 
      application={application}
      onReopened={() => {
        loadApplication()
      }}
    />
  )}
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
        {/* Rejection History - Shows warning for rejected/reopened applications */}
        <RejectionHistory application={application} />
        
        {/* Application Header - BLUE GRADIENT */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg border border-blue-800 p-6 mb-6 print:shadow-none print:border-2 print:bg-white">
         <div className="flex items-center justify-between">
  {/* Left side: Reference number and status */}
  <div className="flex items-center gap-3">
    <span className="text-2xl font-bold">{application.reference_number}</span>
    <StatusBadge status={application.status} />
  </div>

  {/* Right side: Reopen button (only shows for rejected applications) */}
  <ReopenApplicationButton 
    application={application} 
    onReopened={refreshApplication}
  />
</div>
          {/* Reference Number - Prominent Display */}
          {application.reference_number && (
            <div className="mb-4 pb-4 border-b border-blue-500 print:border-gray-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-100 font-medium print:text-gray-600">Application Reference:</span>
                  <span className="text-2xl font-bold font-mono text-white print:text-gray-900 tracking-wider">
                    {application.reference_number}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(application.reference_number)
                      setCopiedRef(true)
                      setTimeout(() => setCopiedRef(false), 2000)
                    }}
                    className="p-2 hover:bg-blue-500 rounded transition-colors print:hidden"
                    title="Copy reference number"
                  >
                    {copiedRef ? (
                      <svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Submitted
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Photo */}
              {applicationData?.section2?.photoStoragePath && (
                <img 
                  src={getPhotoUrl(applicationData.section2.photoStoragePath)} 
                  alt={`${applicationData?.section2?.firstName} ${applicationData?.section2?.surname}`}
                  className="w-24 h-24 rounded-lg object-cover border-4 border-white shadow-lg print:border-2 print:border-gray-300"
                  onError={(e) => {
                    console.error('Photo failed to load:', e.target.src)
                    e.target.style.display = 'none'
                  }}
                />
              )}
              
              {/* Name and Position */}
              <div>
                <h2 className="text-2xl font-bold text-white print:text-gray-900">
                  {applicationData?.section2?.firstName} {applicationData?.section2?.middleName} {applicationData?.section2?.surname}
                </h2>
                <p className="text-blue-100 mt-1 print:text-gray-600">
                  Applied for: {formatDisplayValue(applicationData?.section1?.appliedForRank) || 'Not specified'}
                </p>
                <p className="text-xs text-blue-200 mt-2 print:text-gray-500">
                  Submitted: {new Date(application.submitted_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Sections */}
        <div className="space-y-6">
          {/* Section 1: Availability & Position */}
          <ViewSection title="Availability & Position Applied For">
            <ViewRow label="Applied For Rank" value={formatDisplayValue(applicationData?.section1?.appliedForRank)} />
            <ViewRow label="Preferred Vessel Type" value={formatDisplayValue(applicationData?.section1?.vesselType)} />
            <ViewRow label="Available From" value={applicationData?.section1?.availableFrom} />
            <ViewRow label="Available Till" value={applicationData?.section1?.availableTill || 'Open'} />
            <ViewRow label="Recommended By" value={applicationData?.section1?.recommendedBy} />
            {applicationData?.section1?.mediaAdvertisement && (
              <ViewRow label="Found Via Advertisement" value={applicationData.section1.mediaAdvertisementDetails || 'Yes'} />
            )}
            {applicationData?.section1?.professionalRecommendation && (
              <ViewRow label="Professional Recommendation" value="Yes" />
            )}
          </ViewSection>

          {/* Section 2: Personal & Contact Details */}
          <ViewSection title="Personal & Contact Details">
            <ViewRow label="Full Name" value={`${applicationData?.section2?.firstName || ''} ${applicationData?.section2?.middleName || ''} ${applicationData?.section2?.surname || ''}`} />
            {applicationData?.section2?.knownAs && <ViewRow label="Known As" value={applicationData.section2.knownAs} />}
            {applicationData?.section2?.otherNames && <ViewRow label="Other Names" value={applicationData.section2.otherNames} />}
            <ViewRow label="Date of Birth" value={applicationData?.section2?.dateOfBirth} />
            <ViewRow label="Age" value={applicationData?.section2?.age} />
            <ViewRow label="Gender" value={applicationData?.section2?.gender} />
            <ViewRow label="Nationality" value={applicationData?.section2?.nationality} />
            <ViewRow label="Place of Birth" value={applicationData?.section2?.placeOfBirth} />
            <ViewRow label="Marital Status" value={applicationData?.section2?.maritalStatus} />
            <ViewRow label="Email" value={applicationData?.section2?.email} />
            <ViewRow label="Phone" value={`+${applicationData?.section2?.phoneCountryCode || ''} ${applicationData?.section2?.phoneNumber || ''}`} />
            <ViewRow label="Address" value={applicationData?.section2?.address} />
            <ViewRow label="City" value={applicationData?.section2?.city} />
            <ViewRow label="State" value={applicationData?.section2?.state} />
            <ViewRow label="Country" value={applicationData?.section2?.country} />
            <ViewRow label="Postal Code" value={applicationData?.section2?.postalCode} />
            {applicationData?.section2?.domesticAirport && <ViewRow label="Nearest Domestic Airport" value={applicationData.section2.domesticAirport} />}
            {applicationData?.section2?.internationalAirport && <ViewRow label="Nearest International Airport" value={applicationData.section2.internationalAirport} />}
            
            {/* Emergency Contact - Parsed from JSON */}
            {emergencyContact && (
              <div className="mt-6 pt-6 border-t">
                <p className="font-semibold text-gray-900 mb-3">Emergency Contact</p>
                <div className="space-y-2">
                  <ViewRow label="Name" value={emergencyContact.name} />
                  <ViewRow label="Relationship" value={emergencyContact.relationship} />
                  <ViewRow label="Phone" value={emergencyContact.phone} />
                  {emergencyContact.mobile && <ViewRow label="Mobile" value={emergencyContact.mobile} />}
                  <ViewRow label="Address" value={emergencyContact.address} />
                </div>
              </div>
            )}

            {/* Next of Kin - Parsed from JSON */}
            {nextOfKin && (
              <div className="mt-6 pt-6 border-t">
                <p className="font-semibold text-gray-900 mb-3">Next of Kin</p>
                <div className="space-y-2">
                  <ViewRow label="Name" value={nextOfKin.name} />
                  <ViewRow label="Relationship" value={nextOfKin.relationship} />
                  {nextOfKin.phone && <ViewRow label="Phone" value={nextOfKin.phone} />}
                  {nextOfKin.address && <ViewRow label="Address" value={nextOfKin.address} />}
                </div>
              </div>
            )}
          </ViewSection>

          {/* Section 3: Passport */}
          <ViewSection title="Passport Details">
            <ViewRow label="Passport Number" value={applicationData?.section3?.passportNumber} />
            <ViewRow label="Issuing Authority" value={applicationData?.section3?.issuingAuthority} />
            <ViewRow label="Place of Issue" value={applicationData?.section3?.placeOfIssue} />
            <ViewRow label="Date of Issue" value={applicationData?.section3?.dateOfIssue} />
            <ViewRow label="Date of Expiry" value={applicationData?.section3?.dateOfExpiry} />
          </ViewSection>

          {/* Section 4: CDC */}
          <ViewSection title="CDC (Continuous Discharge Certificate)">
            <ViewRow label="CDC Number" value={applicationData?.section4?.cdcNumber} />
            <ViewRow label="Issuing Authority" value={applicationData?.section4?.issuingAuthority} />
            <ViewRow label="Place of Issue" value={applicationData?.section4?.placeOfIssue} />
            <ViewRow label="Date of Issue" value={applicationData?.section4?.dateOfIssue} />
            <ViewRow label="Date of Expiry" value={applicationData?.section4?.dateOfExpiry} />
          </ViewSection>

          {/* Section 5: Visas */}
          {applicationData?.section5?.visas && applicationData.section5.visas.length > 0 && (
            <ViewSection title="Visas">
              {applicationData.section5.visas.map((visa, index) => {
                // Skip empty visas
                if (!visa.type && !visa.number && !visa.dateOfIssue) return null
                return (
                  <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                    <p className="font-semibold text-gray-900 mb-3">Visa {index + 1}</p>
                    <div className="space-y-2">
                      <ViewRow label="Type" value={visa.type} />
                      <ViewRow label="Number" value={visa.number} />
                      <ViewRow label="Place of Issue" value={visa.placeOfIssue} />
                      <ViewRow label="Date of Issue" value={visa.dateOfIssue} />
                      <ViewRow label="Date of Expiry" value={visa.dateOfExpiry} />
                    </div>
                  </div>
                )
              })}
            </ViewSection>
          )}

          {/* Section 6: Education */}
          {applicationData?.section6?.education && applicationData.section6.education.length > 0 && (
            <ViewSection title="Education">
              {applicationData.section6.education.map((edu, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">{edu.institution || `Education ${index + 1}`}</p>
                  <div className="space-y-2">
                    <ViewRow label="Institution" value={edu.institution} />
                    <ViewRow label="Qualification" value={edu.qualification} />
                    <ViewRow label="From" value={edu.from} />
                    <ViewRow label="To" value={edu.to} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 8: Certificates */}
          {applicationData?.section8?.certificates && applicationData.section8.certificates.length > 0 && (
            <ViewSection title="Certificates of Competency">
              {applicationData.section8.certificates.map((cert, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">Certificate {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Certificate Number" value={cert.certificateNumber} />
                    <ViewRow label="Grade" value={formatDisplayValue(cert.grade)} />
                    <ViewRow label="Issuing Authority" value={cert.issuingAuthority} />
                    <ViewRow label="Place of Issue" value={cert.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={cert.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={cert.dateOfExpiry} />
                    {cert.dateRevalidated && <ViewRow label="Date Revalidated" value={cert.dateRevalidated} />}
                    {cert.dateRevalidationExpiry && <ViewRow label="Revalidation Expiry" value={cert.dateRevalidationExpiry} />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 9: GMDSS */}
          {applicationData?.section9?.gmdss && applicationData.section9.gmdss.length > 0 && (
            <ViewSection title="GMDSS Certificates">
              {applicationData.section9.gmdss.map((gmdss, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">GMDSS Certificate {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Certificate Number" value={gmdss.number} />
                    <ViewRow label="Issuing Authority" value={gmdss.issuingAuthority} />
                    <ViewRow label="Place of Issue" value={gmdss.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={gmdss.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={gmdss.dateOfExpiry} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 10: Medical & Vaccinations */}
          <ViewSection title="Medical Fitness & Vaccinations">
            {applicationData?.section10?.medicalFitness && applicationData.section10.medicalFitness.length > 0 && (
              <div className="mb-4">
                <p className="font-semibold text-gray-900 mb-3">Medical Fitness Certificates</p>
                {applicationData.section10.medicalFitness.map((cert, index) => (
                  <div key={index} className="mb-4 last:mb-0 space-y-2">
                    <ViewRow label="Type" value={cert.type} />
                    <ViewRow label="Date of Issue" value={cert.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={cert.dateOfExpiry} />
                  </div>
                ))}
              </div>
            )}
            
            {applicationData?.section10?.vaccinations && (
              <div className="mt-4 pt-4 border-t">
                <p className="font-semibold text-gray-900 mb-3">Vaccinations</p>
                <div className="space-y-2">
                  {/* Polio */}
                  {applicationData.section10.vaccinations.polio && (
                    <ViewRow label="Polio" value={`Yes${applicationData.section10.vaccinations.polioDate ? ` (${applicationData.section10.vaccinations.polioDate})` : ''}`} />
                  )}
                  
                  {/* Measles */}
                  {applicationData.section10.vaccinations.measles && (
                    <ViewRow label="Measles" value={`Yes${applicationData.section10.vaccinations.measlesDate ? ` (${applicationData.section10.vaccinations.measlesDate})` : ''}`} />
                  )}
                  
                  {/* Tetanus */}
                  {applicationData.section10.vaccinations.tetanus && (
                    <ViewRow label="Tetanus" value={`Yes${applicationData.section10.vaccinations.tetanusDate ? ` (${applicationData.section10.vaccinations.tetanusDate})` : ''}`} />
                  )}
                  
                  {/* Typhoid */}
                  {applicationData.section10.vaccinations.typhoid && (
                    <ViewRow label="Typhoid" value={`Yes${applicationData.section10.vaccinations.typhoidDate ? ` (${applicationData.section10.vaccinations.typhoidDate})` : ''}`} />
                  )}
                  
                  {/* Hepatitis A */}
                  {applicationData.section10.vaccinations.hepatitisA && (
                    <ViewRow label="Hepatitis A" value={`Yes${applicationData.section10.vaccinations.hepatitisADate ? ` (${applicationData.section10.vaccinations.hepatitisADate})` : ''}`} />
                  )}
                  
                  {/* Hepatitis B */}
                  {applicationData.section10.vaccinations.hepatitisB && (
                    <ViewRow label="Hepatitis B" value={`Yes${applicationData.section10.vaccinations.hepatitisBDate ? ` (${applicationData.section10.vaccinations.hepatitisBDate})` : ''}`} />
                  )}
                  
                  {/* Yellow Fever (object structure) */}
                  {applicationData.section10.vaccinations.yellowFever?.received && (
                    <ViewRow 
                      label="Yellow Fever" 
                      value={`Yes (Issue: ${applicationData.section10.vaccinations.yellowFever.dateOfIssue || 'N/A'}, Expiry: ${applicationData.section10.vaccinations.yellowFever.dateOfExpiry || 'N/A'})`} 
                    />
                  )}
                  
                  {/* COVID-19 */}
                  {applicationData.section10.vaccinations.covidVaccinated && (
                    <ViewRow 
                      label="COVID-19" 
                      value={`Yes${applicationData.section10.vaccinations.covidDoses ? ` (${applicationData.section10.vaccinations.covidDoses} doses)` : ''}${applicationData.section10.vaccinations.covidLastDoseDate ? ` - Last dose: ${applicationData.section10.vaccinations.covidLastDoseDate}` : ''}`} 
                    />
                  )}
                  
                  {/* Other Vaccinations */}
                  {applicationData.section10.vaccinations.otherVaccinations && (
                    <ViewRow label="Other Vaccinations" value={applicationData.section10.vaccinations.otherVaccinations} />
                  )}
                  
                  {/* Show message if no vaccinations */}
                  {!applicationData.section10.vaccinations.polio && 
                   !applicationData.section10.vaccinations.measles && 
                   !applicationData.section10.vaccinations.tetanus && 
                   !applicationData.section10.vaccinations.typhoid && 
                   !applicationData.section10.vaccinations.hepatitisA && 
                   !applicationData.section10.vaccinations.hepatitisB && 
                   !applicationData.section10.vaccinations.yellowFever?.received && 
                   !applicationData.section10.vaccinations.covidVaccinated && (
                    <p className="text-sm text-gray-500 italic">No vaccinations recorded</p>
                  )}
                </div>
              </div>
            )}
          </ViewSection>

          {/* Section 11: Medical History/Incident */}
          {applicationData?.section11?.medicalHistory && (
            <ViewSection title="Medical History / Incident">
              {applicationData.section11.medicalHistory.vesselName && (
                <div className="space-y-2">
                  <ViewRow label="Vessel Name" value={applicationData.section11.medicalHistory.vesselName} />
                  <ViewRow label="Description" value={applicationData.section11.medicalHistory.description} />
                  <ViewRow label="Date of Occurrence" value={applicationData.section11.medicalHistory.dateOfOccurrence} />
                  <ViewRow label="Signed Off Medical" value={applicationData.section11.medicalHistory.signedOffMedical ? 'Yes' : 'No'} />
                </div>
              )}
              {!applicationData.section11.medicalHistory.vesselName && (
                <p className="text-sm text-gray-500 italic">No medical incidents recorded</p>
              )}
            </ViewSection>
          )}

          {/* Section 12: Languages */}
          {applicationData?.section12?.languages && applicationData.section12.languages.length > 0 && (
            <ViewSection title="Languages">
              {applicationData.section12.languages.map((lang, index) => (
                <div key={index} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0">
                  <div className="space-y-2">
                    <ViewRow label="Language" value={lang.language} />
                    <ViewRow label="Proficiency Level" value={lang.level} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 13: Physical Details */}
          <ViewSection title="Physical Details & Uniform Sizes">
            <ViewRow label="Height" value={`${applicationData?.section13?.height} ${applicationData?.section13?.heightUnit || ''}`} />
            <ViewRow label="Weight" value={`${applicationData?.section13?.weight} ${applicationData?.section13?.weightUnit || ''}`} />
            <ViewRow label="Eye Color" value={applicationData?.section13?.eyeColor} />
            <ViewRow label="Hair Color" value={applicationData?.section13?.hairColor} />
            <ViewRow label="Shoe Size" value={`${applicationData?.section13?.shoeSize} ${applicationData?.section13?.shoeSizeUnit || ''}`} />
            <ViewRow label="Boiler Suit Size" value={applicationData?.section13?.boilerSuitSize} />
            <ViewRow label="Uniform Shirt Size" value={applicationData?.section13?.uniformShirtSize} />
            <ViewRow label="Uniform Trouser Size" value={applicationData?.section13?.uniformTrouserSize} />
          </ViewSection>

          {/* Section 14: Additional Courses */}
          {applicationData?.section14?.courses && applicationData.section14.courses.length > 0 && (
            <ViewSection title="Additional Courses & Training">
              {applicationData.section14.courses.map((course, index) => (
                <div key={index} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0">
                  <div className="space-y-2">
                    <ViewRow label="Course Name" value={course.courseName} />
                    <ViewRow label="Certificate Number" value={course.certificateNumber} />
                    <ViewRow label="Issuing Authority" value={course.issuingAuthority} />
                    <ViewRow label="Place of Issue" value={course.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={course.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={course.dateOfExpiry} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 15: Endorsements */}
          {applicationData?.section15?.endorsements && applicationData.section15.endorsements.length > 0 && (
            <ViewSection title="Endorsements">
              {applicationData.section15.endorsements.map((endorsement, index) => (
                <div key={index} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0">
                  <div className="space-y-2">
                    <ViewRow label="Endorsement Type" value={endorsement.endorsementType} />
                    <ViewRow label="Endorsement Number" value={endorsement.endorsementNumber} />
                    <ViewRow label="Flag State" value={endorsement.flagState} />
                    <ViewRow label="Rank Endorsed" value={formatDisplayValue(endorsement.rankEndorsed)} />
                    <ViewRow label="Place of Issue" value={endorsement.placeOfIssue} />
                    <ViewRow label="Date of Issue" value={endorsement.dateOfIssue} />
                    <ViewRow label="Date of Expiry" value={endorsement.dateOfExpiry} />
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 16: Sea Service */}
          {applicationData?.section16?.seaService && applicationData.section16.seaService.length > 0 && (
            <ViewSection title="Sea Service Experience">
              {applicationData.section16.seaService.map((service, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">{service.vesselName || `Vessel ${index + 1}`}</p>
                  <div className="space-y-2">
                    <ViewRow label="Vessel Name" value={service.vesselName} />
                    <ViewRow label="Vessel Type" value={formatDisplayValue(service.vesselType)} />
                    <ViewRow label="Flag" value={service.flag} />
                    <ViewRow label="GRT" value={service.grt} />
                    <ViewRow label="DWT" value={service.dwt} />
                    <ViewRow label="Main Engine" value={service.mainEngine} />
                    <ViewRow label="Engine Power (kW)" value={service.engineKw} />
                    <ViewRow label="Rank Held" value={formatDisplayValue(service.rankHeld)} />
                    <ViewRow label="Company" value={service.companyName} />
                    <ViewRow label="Trade Route" value={service.tradeRoute} />
                    <ViewRow label="Sign On Date" value={service.signOnDate} />
                    <ViewRow label="Sign Off Date" value={service.signOffDate} />
                    {service.reasonForLeaving && <ViewRow label="Reason for Leaving" value={service.reasonForLeaving} />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 18: References */}
          {applicationData?.section18?.references && applicationData.section18.references.length > 0 && (
            <ViewSection title="Professional References">
              {applicationData.section18.references.map((ref, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">Reference {index + 1}</p>
                  <div className="space-y-2">
                    <ViewRow label="Name" value={ref.name} />
                    <ViewRow label="Position" value={ref.position} />
                    <ViewRow label="Company" value={ref.company} />
                    <ViewRow label="Email" value={ref.email} />
                    <ViewRow label="Phone" value={ref.phoneNumber} />
                    <ViewRow label="Relationship" value={ref.relationship} />
                    <ViewRow label="Years Known" value={ref.yearsKnown} />
                    {ref.additionalNotes && <ViewRow label="Additional Notes" value={ref.additionalNotes} />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 19: Emergency Contacts */}
          {applicationData?.section19?.contacts && applicationData.section19.contacts.length > 0 && (
            <ViewSection title="Emergency Contacts">
              {applicationData.section19.contacts.map((contact, index) => (
                <div key={index} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-b-0">
                  <p className="font-semibold text-gray-900 mb-3">{contact.fullName || `Contact ${index + 1}`}</p>
                  <div className="space-y-2">
                    <ViewRow label="Full Name" value={contact.fullName} />
                    <ViewRow label="Relationship" value={contact.relationship} />
                    <ViewRow label="Phone" value={contact.phoneNumber} />
                    {contact.alternatePhone && <ViewRow label="Alternate Phone" value={contact.alternatePhone} />}
                    <ViewRow label="Email" value={contact.email} />
                    <ViewRow label="Address" value={contact.address} />
                    <ViewRow label="City" value={contact.city} />
                    {contact.state && <ViewRow label="State" value={contact.state} />}
                    <ViewRow label="Country" value={contact.country} />
                    {contact.postalCode && <ViewRow label="Postal Code" value={contact.postalCode} />}
                    {contact.isPrimary && <ViewRow label="Primary Contact" value="Yes" />}
                  </div>
                </div>
              ))}
            </ViewSection>
          )}

          {/* Section 20: Declaration & Consent */}
          <ViewSection title="Declaration & Consent">
            <ViewRow label="Full Name" value={applicationData?.section20?.fullName} />
            <ViewRow label="Place of Signing" value={applicationData?.section20?.placeOfSigning} />
            <ViewRow label="Date of Signature" value={applicationData?.section20?.signatureDate} />
            {applicationData?.section20?.preferredJoinDate && <ViewRow label="Preferred Join Date" value={applicationData.section20.preferredJoinDate} />}
            {applicationData?.section20?.noticePeriod && <ViewRow label="Notice Period" value={applicationData.section20.noticePeriod} />}
            {applicationData?.section20?.contractDuration && <ViewRow label="Contract Duration Preference" value={applicationData.section20.contractDuration} />}
            {applicationData?.section20?.salaryExpectation && <ViewRow label="Salary Expectation" value={applicationData.section20.salaryExpectation} />}
            {applicationData?.section20?.specialRequirements && (
              <ViewRow label="Special Requirements" value={applicationData.section20.specialRequirements} />
            )}
            {applicationData?.section20?.additionalInformation && (
              <ViewRow label="Additional Information" value={applicationData.section20.additionalInformation} />
            )}
            <ViewRow label="Criminal Record" value={applicationData?.section20?.criminalRecord ? 'Yes' : 'No'} />
            {applicationData?.section20?.criminalRecordDetails && (
              <ViewRow label="Criminal Record Details" value={applicationData.section20.criminalRecordDetails} />
            )}
            {applicationData?.section20?.medicalConditions && (
              <ViewRow label="Medical Conditions" value={applicationData.section20.medicalConditions} />
            )}
            <div className="mt-4 pt-4 border-t">
              <p className="font-semibold text-gray-900 mb-3">Consents & Declarations</p>
              <ViewRow label="Accuracy Declaration" value={applicationData?.section20?.accuracyDeclaration ? '✓ Confirmed' : '✗ Not confirmed'} />
              <ViewRow label="Data Processing Consent" value={applicationData?.section20?.dataProcessingConsent ? '✓ Granted' : '✗ Not granted'} />
              <ViewRow label="Background Check Consent" value={applicationData?.section20?.backgroundCheckConsent ? '✓ Granted' : '✗ Not granted'} />
              <ViewRow label="Marketing Consent" value={applicationData?.section20?.marketingConsent ? '✓ Yes' : '✗ No'} />
            </div>
          </ViewSection>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 print:mt-12">
          <p>Njordships Maritime Recruitment • recruitment@njordships.com</p>
          {application.reference_number && (
            <p className="mt-1">Reference Number: {application.reference_number}</p>
          )}
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