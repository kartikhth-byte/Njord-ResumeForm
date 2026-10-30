import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormTextArea from '../shared/FormTextArea'
import FormCheckbox from '../shared/FormCheckbox'

export default function Section19({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    additionalInformation: data.additionalInformation || '',
    specialRequirements: data.specialRequirements || '',
    medicalConditions: data.medicalConditions || '',
    criminalRecord: data.criminalRecord || false,
    criminalRecordDetails: data.criminalRecordDetails || '',
    noticePeriod: data.noticePeriod || '',
    preferredJoinDate: data.preferredJoinDate || '',
    contractDuration: data.contractDuration || '',
    salaryExpectation: data.salaryExpectation || '',
    accuracyDeclaration: data.accuracyDeclaration || false,
    backgroundCheckConsent: data.backgroundCheckConsent || false,
    dataProcessingConsent: data.dataProcessingConsent || false,
    marketingConsent: data.marketingConsent || false,
    fullName: data.fullName || '',
    signatureDate: data.signatureDate || new Date().toISOString().split('T')[0],
    placeOfSigning: data.placeOfSigning || '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        additionalInformation: data.additionalInformation || '',
        specialRequirements: data.specialRequirements || '',
        medicalConditions: data.medicalConditions || '',
        criminalRecord: data.criminalRecord || false,
        criminalRecordDetails: data.criminalRecordDetails || '',
        noticePeriod: data.noticePeriod || '',
        preferredJoinDate: data.preferredJoinDate || '',
        contractDuration: data.contractDuration || '',
        salaryExpectation: data.salaryExpectation || '',
        accuracyDeclaration: data.accuracyDeclaration || false,
        backgroundCheckConsent: data.backgroundCheckConsent || false,
        dataProcessingConsent: data.dataProcessingConsent || false,
        marketingConsent: data.marketingConsent || false,
        fullName: data.fullName || '',
        signatureDate: data.signatureDate || new Date().toISOString().split('T')[0],
        placeOfSigning: data.placeOfSigning || '',
      })
    }
  }, [data])

  const validateYear = (dateString) => {
    if (!dateString) return null
    const year = dateString.split('-')[0]
    if (year.length !== 4) return 'Year must be 4 digits'
    const yearNum = parseInt(year, 10)
    if (yearNum < 1900 || yearNum > 2100) return 'Year must be between 1900 and 2100'
    return null
  }

  const validateField = (name, value) => {
    switch (name) {
      case 'accuracyDeclaration':
        return !value ? 'You must accept the declaration of accuracy' : ''
      case 'backgroundCheckConsent':
        return !value ? 'You must consent to background checks' : ''
      case 'dataProcessingConsent':
        return !value ? 'You must consent to data processing' : ''
      case 'criminalRecordDetails':
        if (formData.criminalRecord && !value) {
          return 'Please provide details about your criminal record'
        }
        if (formData.criminalRecord && value && value.trim().length < 10) {
          return 'Please provide more detail (at least 10 characters)'
        }
        return ''
      case 'fullName':
        return !value ? 'Full name is required for signature' : ''
      case 'signatureDate':
        if (!value) return 'Signature date is required'
        return validateYear(value) || ''
      case 'placeOfSigning':
        return !value ? 'Place of signing is required' : ''
      default:
        return ''
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value

    const newFormData = {
      ...formData,
      [name]: fieldValue,
      ...(name === 'criminalRecord' && !checked ? { criminalRecordDetails: '' } : {})
    }

    if (name === 'criminalRecord' && !checked) {
      setErrors((prev) => ({ ...prev, criminalRecordDetails: '' }))
    }

    setFormData(newFormData)
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, fieldValue) }))

    if (name === 'criminalRecord' && checked) {
      setErrors((prev) => ({
        ...prev,
        criminalRecordDetails: validateField('criminalRecordDetails', newFormData.criminalRecordDetails)
      }))
    }

    onUpdate({ section19: newFormData })
  }

  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, formData[name]) }))
  }

  const allDeclarationsChecked =
    formData.accuracyDeclaration &&
    formData.backgroundCheckConsent &&
    formData.dataProcessingConsent

  return (
    <div className="space-y-8">
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Additional information and declarations</h2>
      </div>

      <div className="applicant-section-card space-y-5">
        <h3 className="text-lg font-semibold text-fg border-b pb-2">Additional Information</h3>

        <FormTextArea
          label="Additional Information About Your Application"
          name="additionalInformation"
          value={formData.additionalInformation}
          onChange={handleChange}
          rows={4}
          placeholder="Share any additional information that might be relevant to your application, such as special skills, achievements, or career goals..."
          helpText="Optional - Use this space to highlight anything not covered in previous sections"
        />

        <FormTextArea
          label="Special Requirements or Accommodations"
          name="specialRequirements"
          value={formData.specialRequirements}
          onChange={handleChange}
          rows={3}
          placeholder="Any dietary requirements, religious observances, or other special needs we should be aware of..."
          helpText="Optional - We respect all cultural and personal requirements"
        />

        <FormTextArea
          label="Medical Conditions or Disabilities"
          name="medicalConditions"
          value={formData.medicalConditions}
          onChange={handleChange}
          rows={3}
          placeholder="Any ongoing medical conditions or disabilities that may require accommodation..."
          helpText="Optional - This information is kept confidential and used only for safety and accommodation purposes"
        />

        <div className="space-y-3">
          <FormCheckbox
            label="I have a criminal record or pending criminal charges"
            name="criminalRecord"
            checked={formData.criminalRecord}
            onChange={handleChange}
            helpText="Check this box if you have any criminal convictions or pending charges"
          />

          {formData.criminalRecord && (
            <div className="ml-7">
              <FormTextArea
                label="Please Provide Details"
                name="criminalRecordDetails"
                value={formData.criminalRecordDetails}
                onChange={handleChange}
                onBlur={() => handleBlur('criminalRecordDetails')}
                rows={3}
                required={formData.criminalRecord}
                placeholder="Please provide details of the offense, date, and outcome..."
                helpText="Honesty is appreciated. This will not automatically disqualify you."
                error={touched.criminalRecordDetails ? errors.criminalRecordDetails : ''}
              />
            </div>
          )}
        </div>
      </div>

      <div className="applicant-section-card space-y-5">
        <h3 className="text-lg font-semibold text-fg border-b pb-2">Availability & Preferences</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Notice Period"
            name="noticePeriod"
            value={formData.noticePeriod}
            onChange={handleChange}
            placeholder="e.g., Immediate, 2 weeks, 1 month"
            helpText="How soon can you join?"
          />

          <FormInput
            label="Preferred Join Date"
            name="preferredJoinDate"
            type="date"
            value={formData.preferredJoinDate}
            onChange={handleChange}
            min={new Date().toISOString().split('T')[0]}
            helpText="Earliest date you can join"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Preferred Contract Duration"
            name="contractDuration"
            value={formData.contractDuration}
            onChange={handleChange}
            placeholder="e.g., 4-6 months, 6-9 months"
            helpText="Your preferred contract length"
          />

          <FormInput
            label="Salary Expectation"
            name="salaryExpectation"
            value={formData.salaryExpectation}
            onChange={handleChange}
            placeholder="e.g., USD 5,000/month"
            helpText="Optional compensation expectation"
          />
        </div>
      </div>

      <div className="applicant-section-card space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-fg">Declaration & consent</h3>
          <p className="mt-1 text-sm text-fg-secondary">
            These confirmations are mandatory before you can submit your application.
          </p>
        </div>

        <div className="space-y-3 rounded-card border border-line bg-raised/80 p-4">
          <FormCheckbox
            label="I declare that the information provided in this application is true, complete, and accurate to the best of my knowledge."
            name="accuracyDeclaration"
            checked={formData.accuracyDeclaration}
            onChange={handleChange}
            onBlur={() => handleBlur('accuracyDeclaration')}
            required
            error={touched.accuracyDeclaration ? errors.accuracyDeclaration : ''}
          />

          <FormCheckbox
            label="I consent to background checks, verification of certificates, and reference checks as part of the recruitment process."
            name="backgroundCheckConsent"
            checked={formData.backgroundCheckConsent}
            onChange={handleChange}
            onBlur={() => handleBlur('backgroundCheckConsent')}
            required
            error={touched.backgroundCheckConsent ? errors.backgroundCheckConsent : ''}
          />

          <FormCheckbox
            label="I consent to the processing of my personal data for recruitment, compliance, and placement activities."
            name="dataProcessingConsent"
            checked={formData.dataProcessingConsent}
            onChange={handleChange}
            onBlur={() => handleBlur('dataProcessingConsent')}
            required
            error={touched.dataProcessingConsent ? errors.dataProcessingConsent : ''}
          />

          <FormCheckbox
            label="I agree to receive relevant updates about future maritime opportunities."
            name="marketingConsent"
            checked={formData.marketingConsent}
            onChange={handleChange}
          />
        </div>

        <div className="rounded-card border border-line bg-accent-soft/70 p-5">
          <h4 className="text-base font-semibold text-fg">Electronic signature</h4>
          <p className="mt-1 text-sm text-fg-secondary">
            Entering your details below acts as your confirmation that the declarations above are accepted.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              onBlur={() => handleBlur('fullName')}
              required
              error={touched.fullName ? errors.fullName : ''}
            />

            <FormInput
              label="Signature Date"
              name="signatureDate"
              type="date"
              value={formData.signatureDate}
              onChange={handleChange}
              onBlur={() => handleBlur('signatureDate')}
              required
              error={touched.signatureDate ? errors.signatureDate : ''}
            />
          </div>

          <div className="mt-4">
            <FormInput
              label="Place of Signing"
              name="placeOfSigning"
              value={formData.placeOfSigning}
              onChange={handleChange}
              onBlur={() => handleBlur('placeOfSigning')}
              required
              error={touched.placeOfSigning ? errors.placeOfSigning : ''}
              placeholder="City and country where you are signing this application"
            />
          </div>
        </div>

        {allDeclarationsChecked && formData.fullName && formData.signatureDate && formData.placeOfSigning && (
          <div className="rounded-card border border-success-line bg-success-soft p-5 text-success">
            <p className="text-xl font-semibold">Section 19 Complete!</p>
            <p className="mt-2 text-base">
              Declarations complete.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
