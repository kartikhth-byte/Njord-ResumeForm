import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'

export default function Section20({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    // Additional Information
    additionalInformation: data.additionalInformation || '',
    specialRequirements: data.specialRequirements || '',
    medicalConditions: data.medicalConditions || '',
    criminalRecord: data.criminalRecord || false,
    criminalRecordDetails: data.criminalRecordDetails || '',
    
    // Availability & Preferences
    noticePeriod: data.noticePeriod || '',
    preferredJoinDate: data.preferredJoinDate || '',
    contractDuration: data.contractDuration || '',
    salaryExpectation: data.salaryExpectation || '',
    
    // Declarations
    accuracyDeclaration: data.accuracyDeclaration || false,
    backgroundCheckConsent: data.backgroundCheckConsent || false,
    dataProcessingConsent: data.dataProcessingConsent || false,
    marketingConsent: data.marketingConsent || false,
    
    // Signature
    fullName: data.fullName || '',
    signatureDate: data.signatureDate || new Date().toISOString().split('T')[0],
    placeOfSigning: data.placeOfSigning || '',
  })

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value
    
    let newFormData = {
      ...formData,
      [name]: fieldValue
    }

    // Clear criminal record details if checkbox is unchecked
    if (name === 'criminalRecord' && !checked) {
      newFormData.criminalRecordDetails = ''
    }
    
    setFormData(newFormData)
    onUpdate({ section20: newFormData })
  }

  const allDeclarationsChecked = 
    formData.accuracyDeclaration && 
    formData.backgroundCheckConsent && 
    formData.dataProcessingConsent

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Section 20: Additional Information & Declarations</h2>
        <p className="text-gray-600 mt-1">
          Provide any additional information and complete the mandatory declarations
        </p>
      </div>

      {/* Additional Information */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Additional Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Information About Your Application
          </label>
          <textarea
            name="additionalInformation"
            value={formData.additionalInformation}
            onChange={handleChange}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Share any additional information that might be relevant to your application, such as special skills, achievements, or career goals..."
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional - Use this space to highlight anything not covered in previous sections
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Special Requirements or Accommodations
          </label>
          <textarea
            name="specialRequirements"
            value={formData.specialRequirements}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Any dietary requirements, religious observances, or other special needs we should be aware of..."
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional - We respect all cultural and personal requirements
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Medical Conditions or Disabilities
          </label>
          <textarea
            name="medicalConditions"
            value={formData.medicalConditions}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Any ongoing medical conditions or disabilities that may require accommodation..."
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional - This information is kept confidential and used only for safety and accommodation purposes
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="criminalRecord"
              name="criminalRecord"
              checked={formData.criminalRecord}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="criminalRecord" className="ml-3 block">
              <span className="text-sm font-medium text-gray-900">
                I have a criminal record or pending criminal charges
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Check this box if you have any criminal convictions or pending charges
              </p>
            </label>
          </div>

          {formData.criminalRecord && (
            <div className="ml-7">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Please Provide Details
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                name="criminalRecordDetails"
                value={formData.criminalRecordDetails}
                onChange={handleChange}
                rows={3}
                required={formData.criminalRecord}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Please provide details of the offense, date, and outcome..."
              />
              <p className="mt-1 text-sm text-gray-500">
                Full disclosure is required. Non-disclosure may result in disqualification.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Availability & Preferences */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Availability & Preferences</h3>
        
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
            label="Salary Expectation (USD/month)"
            name="salaryExpectation"
            type="number"
            value={formData.salaryExpectation}
            onChange={handleChange}
            placeholder="e.g., 5000"
            helpText="Optional - Your expected monthly salary"
          />
        </div>
      </div>

      {/* Declarations */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Declarations & Consent
          <span className="text-red-500 ml-1">*</span>
        </h3>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            Please read carefully and check all required declarations below. All declarations are mandatory for submission.
          </p>
        </div>

        <div className="space-y-4">
          {/* Accuracy Declaration */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="accuracyDeclaration"
                name="accuracyDeclaration"
                checked={formData.accuracyDeclaration}
                onChange={handleChange}
                required
                className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="accuracyDeclaration" className="ml-3 block">
                <span className="text-sm font-semibold text-gray-900">
                  Declaration of Accuracy
                  <span className="text-red-500 ml-1">*</span>
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  I hereby declare that all information provided in this application is true, complete, and accurate to the best of my knowledge. I understand that any false information or omission may result in disqualification from employment or termination if discovered after employment.
                </p>
              </label>
            </div>
          </div>

          {/* Background Check Consent */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="backgroundCheckConsent"
                name="backgroundCheckConsent"
                checked={formData.backgroundCheckConsent}
                onChange={handleChange}
                required
                className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="backgroundCheckConsent" className="ml-3 block">
                <span className="text-sm font-semibold text-gray-900">
                  Background Check Consent
                  <span className="text-red-500 ml-1">*</span>
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  I authorize the company to conduct background checks, verify my employment history, contact my references, and verify all certificates and documents provided. I understand this may include criminal background checks where permitted by law.
                </p>
              </label>
            </div>
          </div>

          {/* Data Processing Consent */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="dataProcessingConsent"
                name="dataProcessingConsent"
                checked={formData.dataProcessingConsent}
                onChange={handleChange}
                required
                className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="dataProcessingConsent" className="ml-3 block">
                <span className="text-sm font-semibold text-gray-900">
                  Data Processing Consent
                  <span className="text-red-500 ml-1">*</span>
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  I consent to the processing of my personal data for recruitment purposes in accordance with applicable data protection laws. I understand my data will be stored securely and used only for employment-related purposes. I have the right to access, correct, or request deletion of my data at any time.
                </p>
              </label>
            </div>
          </div>

          {/* Marketing Consent (Optional) */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="marketingConsent"
                name="marketingConsent"
                checked={formData.marketingConsent}
                onChange={handleChange}
                className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="marketingConsent" className="ml-3 block">
                <span className="text-sm font-semibold text-gray-900">
                  Marketing Communications (Optional)
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  I consent to receive job opportunities, industry news, and other relevant communications via email or SMS. I can unsubscribe at any time.
                </p>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Signature */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Digital Signature
          <span className="text-red-500 ml-1">*</span>
        </h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            By providing your name and date below, you are electronically signing this application. This electronic signature has the same legal effect as a handwritten signature.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Full Name (as signature)"
            name="fullName"
            required
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Type your full legal name"
            helpText="This serves as your electronic signature"
          />

          <FormInput
            label="Date of Signing"
            name="signatureDate"
            type="date"
            required
            value={formData.signatureDate}
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <FormInput
          label="Place of Signing"
          name="placeOfSigning"
          required
          value={formData.placeOfSigning}
          onChange={handleChange}
          placeholder="e.g., Mumbai, India"
          helpText="City and country where you are signing this application"
        />
      </div>

      {/* Final Status Box */}
      {allDeclarationsChecked && formData.fullName && formData.signatureDate && formData.placeOfSigning ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900">
                Application Complete!
              </h3>
              <p className="text-sm text-green-800 mt-1">
                You have completed all mandatory declarations and provided your digital signature. Please proceed to review and submit your application.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900">
                Please Complete All Required Fields
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                You must check all mandatory declarations and provide your digital signature before you can submit this application.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Final Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Next Steps
            </h3>
            <p className="text-sm text-blue-800">
              After completing this section, click the "Next" button below to proceed to the Review & Submit page where you can review all your information before final submission. You can still go back and edit any section if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}