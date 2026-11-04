/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import FormSidebar from '../components/form/FormSidebar'
import ConfirmationModal from '../components/form/shared/ConfirmationModal'
import { CheckCircle, AlertCircle, Edit, Send, ChevronUp, Eye } from 'lucide-react'
import { formatDisplayValue } from '../utils/formatUtils'
import { generateReferenceNumber } from '../utils/referenceGenerator'
import PageHeader from '../components/ui/PageHeader'
import { clearActiveDraftId, getActiveDraftId, markActiveDraftExplicit, setActiveDraftId } from '../utils/draftSession'
import { FORM_SECTION_NAME_MAP, MANDATORY_SECTION_NUMBERS } from '../constants/formSections'
import { getBlockingSections, getSectionStatuses } from '../utils/applicationProgress'

const SECTION_NAMES = FORM_SECTION_NAME_MAP

function isReferenceNumberConflict(error) {
  const message = error?.message || ''
  const details = error?.details || ''
  return message.includes('reference_number') || details.includes('reference_number')
}

function isUniqueUserPositionConflict(error) {
  const message = error?.message || ''
  const details = error?.details || ''
  return message.includes('unique_user_position') || details.includes('unique_user_position')
}

function isSingleActiveApplicationError(error) {
  const message = error?.message || ''
  const details = error?.details || ''
  return message.includes('unique_active_application_per_user') || details.includes('unique_active_application_per_user')
}

export default function ReviewSubmit() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [applicationData, setApplicationData] = useState({})
  const [applicationId, setApplicationId] = useState(null)
  const [completionStatus, setCompletionStatus] = useState({})
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [expandedSections, setExpandedSections] = useState({})

  useEffect(() => {
    if (user) {
      loadApplicationData()
    }
  }, [user])

  const loadApplicationData = async () => {
    try {
      setLoading(true)

      const persistedDraftId = getActiveDraftId()
      let app = null

      if (persistedDraftId) {
        const { data: persistedApp, error: persistedError } = await supabase
          .from('applications')
          .select('*')
          .eq('id', persistedDraftId)
          .eq('user_id', user.id)
          .eq('status', 'new')
          .is('submitted_at', null)
          .maybeSingle()

        if (persistedError && persistedError.code !== 'PGRST116') throw persistedError
        app = persistedApp
      }

      if (!app) {
        const { data: latestApp, error: appError } = await supabase
          .from('applications')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'new')
          .is('submitted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (appError) throw appError
        app = latestApp
      }

      if (!app) {
        clearActiveDraftId()
        navigate('/dashboard')
        return
      }

      setApplicationId(app.id)
      setActiveDraftId(app.id)
      markActiveDraftExplicit(false)

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
    const status = getSectionStatuses(data)
    setCompletionStatus(status)
    return status
  }

  const findAvailableReferenceNumber = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateReferenceNumber()
      const { data, error } = await supabase
        .from('applications')
        .select('id')
        .eq('reference_number', candidate)
        .neq('id', applicationId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      if (!data) return candidate
    }

    throw new Error('Failed to generate a unique reference number after multiple attempts')
  }

  const validateApplication = () => {
    const incomplete = getBlockingSections(applicationData)

    const section19 = applicationData.section19 || {}
    if (!section19.accuracyDeclaration || !section19.backgroundCheckConsent || !section19.dataProcessingConsent) {
      if (!incomplete.includes(19)) incomplete.push(19)
    }
    if (!section19.fullName || !section19.signatureDate || !section19.placeOfSigning) {
      if (!incomplete.includes(19)) incomplete.push(19)
    }

    return incomplete
  }

  const handleSubmitClick = () => {
    if (validateApplication().length === 0) setShowConfirmModal(true)
  }

const handleConfirmSubmit = async () => {
  try {
    setSubmitting(true)

    // Get position for success page
    const position = applicationData?.section1?.appliedForRank || 'Maritime Position'

    // Reuse existing identifiers when present to avoid uniqueness conflicts on resubmission.
    const { data: currentApp, error: fetchError } = await supabase
      .from('applications')
      .select('public_token, reference_number')
      .eq('id', applicationId)
      .single()

    if (fetchError) throw fetchError

    let referenceNumber = currentApp?.reference_number
    if (!referenceNumber) {
      referenceNumber = await findAvailableReferenceNumber()
    }

    const publicToken = currentApp?.public_token || crypto.randomUUID()

    const updatePayload = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reference_number: referenceNumber,
      public_token: publicToken,
      applied_rank: position,
    }

    let { error: updateError } = await supabase
      .from('applications')
      .update(updatePayload)
      .eq('id', applicationId)

    if ((updateError?.code === '23505' || updateError?.status === 409) && isReferenceNumberConflict(updateError)) {
      referenceNumber = await findAvailableReferenceNumber()

      ;({ error: updateError } = await supabase
        .from('applications')
        .update({
          ...updatePayload,
          reference_number: referenceNumber,
        })
        .eq('id', applicationId))
    }

    if (isUniqueUserPositionConflict(updateError)) {
      ;({ error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reference_number: referenceNumber,
          public_token: publicToken,
        })
        .eq('id', applicationId))
    }

    if (updateError) {
      console.error('Error updating application:', updateError)
      throw updateError
    }

    // Verify the update worked
    const { data: verifyApp, error: verifyError } = await supabase
      .from('applications')
      .select('reference_number, public_token')
      .eq('id', applicationId)
      .single()

    if (verifyError || !verifyApp?.reference_number) {
      console.error('Verification failed:', verifyError)
      throw new Error('Failed to save application data')
    }

    // Call edge function to send recruiter email
    try {
      const { error: emailError } = await supabase.functions.invoke(
        'send-application-emails',
        {
          body: { applicationId }
        }
      )

      if (emailError) {
        console.error('Email function error:', emailError)
        // Don't block submission if email fails
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError)
      // Don't block submission if email fails
    }

    // Navigate to success page with reference number
    markActiveDraftExplicit(false)
    clearActiveDraftId()
    // Confirmation is shown on the read-only application (reference in a banner).
    navigate(`/application/view/${publicToken}?submitted=1`, { replace: true })

  } catch (error) {
    console.error('Error submitting application:', error)
    if (isSingleActiveApplicationError(error)) {
      alert('You already have another active application in the recruitment pipeline. A new submission can only proceed after the current process is completed.')
      return
    }
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
    if (!sectionData) return <p className="text-fg-muted italic">No data provided</p>

    // Helper to render key-value pairs
    const renderField = (label, value) => {
      if (value === null || value === undefined || value === '') return null
      if (typeof value === 'boolean') return (
        <div key={label} className="grid grid-cols-3 gap-4 py-2 border-b border-line">
          <span className="font-medium text-fg-secondary">{label}:</span>
          <span className="col-span-2 text-fg">{value ? 'Yes' : 'No'}</span>
        </div>
      )
      return (
        <div key={label} className="grid grid-cols-3 gap-4 py-2 border-b border-line">
          <span className="font-medium text-fg-secondary">{label}:</span>
          <span className="col-span-2 text-fg">{value}</span>
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
            {renderField('Full Name', `${sectionData.firstName || ''} ${sectionData.middleName || ''} ${sectionData.surname || ''}`.trim())}
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
          return <p className="text-fg-muted italic">No visas added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.visas.map((visa, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Visa {idx + 1}</p>
                {renderField('Type', visa.type)}
                {renderField('Number', visa.number)}
                {renderField('Expiry', visa.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 6:
        if (!sectionData.education || sectionData.education.length === 0) {
          return <p className="text-fg-muted italic">No education added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.education.map((entry, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Education {idx + 1}</p>
                {renderField('Institution', entry.institution)}
                {renderField('Qualification', entry.qualification)}
                {renderField('From', entry.from)}
                {renderField('To', entry.to)}
              </div>
            ))}
          </div>
        )

      case 7:
        if (!sectionData.dependents || sectionData.dependents.length === 0) {
          return <p className="text-fg-muted italic">No dependents added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.dependents.map((dependent, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">{dependent.name || `Dependent ${idx + 1}`}</p>
                {renderField('Relationship', dependent.relationship)}
                {renderField('Gender', dependent.gender)}
                {renderField('Date of Birth', dependent.dateOfBirth)}
                {renderField('Age', dependent.age)}
              </div>
            ))}
          </div>
        )

      case 8:
        if (!sectionData.certificates || sectionData.certificates.length === 0) {
          return <p className="text-fg-muted italic">No certificates added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.certificates.map((cert, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Certificate {idx + 1}</p>
                {renderField('Grade', cert.grade)}
                {renderField('Number', cert.certificateNumber)}
                {renderField('Issuing Authority', cert.issuingAuthority)}
                {renderField('Expiry', cert.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 9:
        if (!sectionData.gmdss || sectionData.gmdss.length === 0) {
          return <p className="text-fg-muted italic">No GMDSS certificates added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.gmdss.map((entry, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">GMDSS Certificate {idx + 1}</p>
                {renderField('Issuing Authority', entry.issuingAuthority)}
                {renderField('Number', entry.number)}
                {renderField('Place of Issue', entry.placeOfIssue)}
                {renderField('Date of Issue', entry.dateOfIssue)}
                {renderField('Date of Expiry', entry.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 10:
        return (
          <div className="space-y-3">
            {sectionData.medicalFitness?.length ? (
              sectionData.medicalFitness.map((entry, idx) => (
                <div key={idx} className="bg-raised p-3 rounded border border-line">
                  <p className="font-semibold text-fg mb-2">Medical Certificate {idx + 1}</p>
                  {renderField('Type', entry.type)}
                  {renderField('Date of Issue', entry.dateOfIssue)}
                  {renderField('Date of Expiry', entry.dateOfExpiry)}
                </div>
              ))
            ) : (
              <p className="text-fg-muted italic">No medical certificates added</p>
            )}
            {sectionData.vaccinations && (
              <div className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Vaccinations</p>
                {renderField('Yellow Fever Received', sectionData.vaccinations.yellowFever?.received)}
                {renderField('Yellow Fever Date of Issue', sectionData.vaccinations.yellowFever?.dateOfIssue)}
                {renderField('Yellow Fever Date of Expiry', sectionData.vaccinations.yellowFever?.dateOfExpiry)}
                {renderField('Yellow Fever Lifetime Validity', sectionData.vaccinations.yellowFever?.lifetimeValidity)}
                {renderField('COVID Vaccinated', sectionData.vaccinations.covidVaccinated)}
                {renderField('COVID Doses', sectionData.vaccinations.covidDoses)}
                {renderField('COVID Last Dose Date', sectionData.vaccinations.covidLastDoseDate)}
                {renderField('Other Vaccinations', sectionData.vaccinations.otherVaccinations)}
              </div>
            )}
          </div>
        )

      case 11:
        return (
          <div className="space-y-1">
            {renderField('Signed Off Medical', sectionData.medicalHistory?.signedOffMedical)}
            {renderField('Vessel Name', sectionData.medicalHistory?.vesselName)}
            {renderField('Date of Occurrence', sectionData.medicalHistory?.dateOfOccurrence)}
            {renderField('Description', sectionData.medicalHistory?.description)}
          </div>
        )

      case 12:
        if (!sectionData.languages || sectionData.languages.length === 0) {
          return <p className="text-fg-muted italic">No languages added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.languages.map((entry, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Language {idx + 1}</p>
                {renderField('Language', entry.language)}
                {renderField('Level', entry.level)}
              </div>
            ))}
          </div>
        )

      case 14:
        if (!sectionData.courses || sectionData.courses.length === 0) {
          return <p className="text-fg-muted italic">No STCW courses added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.courses.map((course, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">{course.courseName || `Course ${idx + 1}`}</p>
                {renderField('IMO Model Course', course.imoModelCourse)}
                {renderField('Reference - Regulation', course.referenceRegulation)}
                {renderField('Certificate Number', course.certificateNumber)}
                {renderField('Date of Issue', course.dateOfIssue)}
                {renderField('Date of Expiry', course.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 15:
        if (!sectionData.endorsements || sectionData.endorsements.length === 0) {
          return <p className="text-fg-muted italic">No endorsements added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.endorsements.map((entry, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Endorsement {idx + 1}</p>
                {renderField('Flag State', entry.flagState)}
                {renderField('Endorsement Type', entry.endorsementType)}
                {renderField('Rank Endorsed', entry.rankEndorsed)}
                {renderField('Endorsement Number', entry.endorsementNumber)}
                {renderField('Place of Issue', entry.placeOfIssue)}
                {renderField('Date of Issue', entry.dateOfIssue)}
                {renderField('Date of Expiry', entry.dateOfExpiry)}
              </div>
            ))}
          </div>
        )

      case 16:
        if (!sectionData.seaService || sectionData.seaService.length === 0) {
          return <p className="text-fg-muted italic">No sea service added</p>
        }
        return (
          <div className="space-y-3">
            {sectionData.seaService.map((service, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">{service.vesselName || `Vessel ${idx + 1}`}</p>
                {renderField('Rank', formatDisplayValue(service.rankHeld))}
                {renderField('Position', service.position)}
                {renderField('Company', service.company || service.companyName)}
                {renderField('Manning', service.manning)}
                {renderField('Trading Area', service.tradingArea || service.tradeRoute)}
                {renderField('Vessel Type', formatDisplayValue(service.vesselType))}
                {renderField('TEU', service.teu)}
                {renderField('Year Built', service.yearBuilt)}
                {renderField('Engine Family', service.engineFamily)}
                {renderField('Main Engine Make', service.mainEngineMake)}
                {renderField('Total mm/dd', service.totalMmDd)}
                {renderField('Sign On', service.signOnDate)}
                {renderField('Sign Off', service.signOffDate)}
              </div>
            ))}
          </div>
        )

      case 17: {
        const buildSkillList = (items) => items
          .filter((item) => Boolean(item.enabled || item.value))
          .map((item) => {
            if (item.value) {
              return `${item.label}: ${item.value}`
            }
            return item.label
          })

        const navigationSkills = buildSkillList([
          { label: 'ECDIS', enabled: sectionData.ecdis, value: sectionData.ecdisTypes },
          { label: 'Radar Navigation', enabled: sectionData.radar, value: sectionData.radarTypes },
          { label: 'ARPA', enabled: sectionData.arpa },
          { label: 'GPS / GNSS', enabled: sectionData.gps },
          { label: 'Gyro Compass', enabled: sectionData.gyroCompass },
          { label: 'Autopilot Systems', enabled: sectionData.autopilot },
          { label: 'VHF / GMDSS Equipment', enabled: sectionData.vhf },
        ])

        const cargoSkills = buildSkillList([
          { label: 'Cargo Computer Systems', enabled: sectionData.cargoComputers, value: sectionData.cargoComputerTypes },
          { label: 'Loadmaster / Loading Instruments', enabled: sectionData.loadmaster, value: sectionData.loadmasterTypes },
          { label: 'Inert Gas System', enabled: sectionData.inertGasSystem },
          { label: 'Cargo Pump Operations', enabled: sectionData.cargoPumps },
          { label: 'Ballast System Operations', enabled: sectionData.ballastSystem },
        ])

        const engineSkills = buildSkillList([
          { label: 'Main Engine Experience', value: sectionData.mainEngineExperience },
          { label: 'Auxiliary Engine Experience', value: sectionData.auxiliaryEngineExperience },
          { label: 'Boiler Operations & Maintenance', enabled: sectionData.boilerExperience },
          { label: 'Purifiers', enabled: sectionData.purifierExperience },
          { label: 'Air Compressors', enabled: sectionData.compressorExperience },
          { label: 'Refrigeration Systems', enabled: sectionData.refrigerationExperience },
          { label: 'Pneumatic Control Systems', enabled: sectionData.pneumaticControls },
          { label: 'Hydraulic Systems', enabled: sectionData.hydraulicSystems },
        ])

        const electricalSkills = buildSkillList([
          { label: 'Electrical Systems Experience', enabled: sectionData.electricalExperience, value: sectionData.electricalVoltage },
          { label: 'Generator Operations & Maintenance', enabled: sectionData.generatorExperience },
          { label: 'High Voltage Systems', enabled: sectionData.highVoltageExperience },
          { label: 'PLC Experience', enabled: sectionData.plcExperience },
        ])

        const softwareSkills = buildSkillList([
          { label: 'Microsoft Office', enabled: sectionData.msOffice, value: sectionData.msOfficeLevel },
          { label: 'Maintenance Software', enabled: sectionData.maintenanceSoftware, value: sectionData.maintenanceSoftwareTypes },
          { label: 'Weather Routing Software', enabled: sectionData.weatherSoftware, value: sectionData.weatherSoftwareTypes },
        ])

        const specialSkills = buildSkillList([
          { label: 'Welding', enabled: sectionData.welding, value: sectionData.weldingTypes },
          { label: 'Rigging & Lifting Operations', enabled: sectionData.rigging },
          { label: 'Crane Operation', enabled: sectionData.craneOperation, value: sectionData.craneTypes },
          { label: 'ROV', enabled: sectionData.rov },
          { label: 'Dynamic Positioning', enabled: sectionData.dynamicPositioning, value: sectionData.dpLevel },
        ])

        const skillGroups = [
          { title: 'Navigation Equipment', items: navigationSkills },
          { title: 'Cargo Operations', items: cargoSkills },
          { title: 'Engine Room Equipment', items: engineSkills },
          { title: 'Electrical Systems', items: electricalSkills },
          { title: 'Software & Computer Skills', items: softwareSkills },
          { title: 'Special Skills & Qualifications', items: specialSkills },
        ].filter((group) => group.items.length > 0)

        if (skillGroups.length === 0 && !sectionData.additionalSkills) {
          return <p className="text-fg-muted italic">No technical skills added</p>
        }

        return (
          <div className="space-y-3">
            {skillGroups.map((group) => (
              <div key={group.title} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">{group.title}</p>
                <ul className="space-y-1 text-fg">
                  {group.items.map((item) => (
                    <li key={item} className="border-b border-line py-2 last:border-b-0">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {sectionData.additionalSkills && (
              <div className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">Additional Skills & Experience</p>
                <p className="text-fg whitespace-pre-wrap">{sectionData.additionalSkills}</p>
              </div>
            )}
          </div>
        )
      }

      case 18:
        return (
          <div className="space-y-3">
            <div className="bg-raised p-3 rounded border border-line">
              {renderField(
                'Objection To Contact Last Employer',
                sectionData.objectionToContactLastEmployer
                  ? sectionData.objectionToContactLastEmployer.toUpperCase()
                  : ''
              )}
              {renderField('Current Employer Company', sectionData.currentEmployer?.company)}
              {renderField('Current Employer Contact Person', sectionData.currentEmployer?.contactPerson)}
              {renderField('Current Employer Address', sectionData.currentEmployer?.address)}
              {renderField('Current Employer Phone Number', sectionData.currentEmployer?.phoneNumber)}
            </div>
            {(!sectionData.references || sectionData.references.length === 0) && (
              <p className="text-fg-muted italic">No references added</p>
            )}
            {(sectionData.references || []).map((entry, idx) => (
              <div key={idx} className="bg-raised p-3 rounded border border-line">
                <p className="font-semibold text-fg mb-2">{entry.name || `Reference ${idx + 1}`}</p>
                {renderField('Position', entry.position)}
                {renderField('Company', entry.company)}
                {renderField('Address', entry.address)}
                {renderField('Relationship', entry.relationship)}
                {renderField('Phone Number', entry.phoneNumber)}
                {renderField('Email', entry.email)}
                {renderField('Years Known', entry.yearsKnown)}
                {renderField('Additional Notes', entry.additionalNotes)}
              </div>
            ))}
          </div>
        )

      case 19:
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
                    <span className="font-medium text-fg-secondary">{key}: </span>
                    <span className="text-fg">{value.length} item(s)</span>
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
        return sectionData.firstName ? [sectionData.firstName, sectionData.surname].filter(Boolean).join(' ') : 'Incomplete'
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
        return sectionData.accuracyDeclaration ? 'Declarations complete' : 'Declarations incomplete'
      default:
        return 'Data provided'
    }
  }

  const blockingSections = validateApplication()
  const canSubmit = blockingSections.length === 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-raised">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-fg-secondary">Loading application...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="applicant-shell">
      <FormSidebar applicationData={applicationData} mode="review" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="applicant-hero mb-8">
          <PageHeader title="Review and submit" />
        </div>

        {/* Section List */}
        <div className="applicant-panel mb-6">
          <div className="p-6 border-b border-line">
            <h2 className="text-xl font-semibold text-fg">Application Sections</h2>
          </div>

          <div className="divide-y divide-line">
            {Object.keys(SECTION_NAMES).map((sectionNum) => {
              const num = parseInt(sectionNum)
              const isComplete = completionStatus[num] === 'complete'
              const isMandatory = MANDATORY_SECTION_NUMBERS.includes(num)
              const isExpanded = expandedSections[num]
              
              return (
                <div key={num} className="transition-colors">
                  <div className="p-4">
                    <div className={`applicant-review-row ${!isComplete && isMandatory ? 'is-incomplete' : ''}`}>
                      <div className="flex items-center gap-3 flex-1">
                        {isComplete ? (
                          <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
                        ) : (
                          <AlertCircle className={`w-6 h-6 flex-shrink-0 ${isMandatory ? 'text-danger' : 'text-warning'}`} />
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium text-fg">
                            {num}. {SECTION_NAMES[num]}
                          </h3>
                          <p className="text-sm text-fg-secondary mt-1">
                            {getSectionSummary(num)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSection(num)}
                          className="flex items-center gap-2 px-4 py-2 text-accent-text hover:bg-accent-soft rounded-lg transition-colors"
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
                          onClick={() => navigate(`/application/form/section/${num}?return=review`)}
                          className="flex items-center gap-2 px-4 py-2 text-fg-secondary hover:bg-raised rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Section Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-raised">
                      <div className="rounded-card border border-line bg-surface p-4">
                        {renderSectionDetails(num)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="applicant-panel p-6">
          {!canSubmit && (
            <p className="mb-4 text-sm text-fg-secondary">
              To submit, complete:{' '}
              {blockingSections.map((num, index) => (
                <span key={num}>
                  {index > 0 ? ', ' : ''}
                  <button
                    type="button"
                    onClick={() => navigate(`/application/form/section/${num}?return=review`)}
                    className="font-medium text-accent-text hover:underline"
                  >
                    {SECTION_NAMES[num]}
                  </button>
                </span>
              ))}
            </p>
          )}

          <button
            onClick={handleSubmitClick}
            disabled={submitting || !canSubmit}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-control transition-colors font-semibold text-lg bg-accent-fill text-on-accent hover:bg-accent-fill-hover disabled:bg-line-strong disabled:text-fg-muted disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-line border-t-transparent rounded-full animate-spin"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit application
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Submission"
        message={
          <div className="space-y-2">
            <p>Are you sure you want to submit your application?</p>
            <p className="font-semibold">You can’t edit it after submitting.</p>
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
