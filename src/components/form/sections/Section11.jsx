import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'

export default function Section11({ data = {}, onUpdate }) {
  // Fix: Read from data.medicalHistory to match what we're saving
  const medicalHistory = data.medicalHistory || {}
  
  const [formData, setFormData] = useState({
    signedOffMedical: medicalHistory.signedOffMedical || false,
    vesselName: medicalHistory.vesselName || '',
    dateOfOccurrence: medicalHistory.dateOfOccurrence || '',
    description: medicalHistory.description || '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.medicalHistory) {
      const medicalHistory = data.medicalHistory
      setFormData({
        signedOffMedical: medicalHistory.signedOffMedical || false,
        vesselName: medicalHistory.vesselName || '',
        dateOfOccurrence: medicalHistory.dateOfOccurrence || '',
        description: medicalHistory.description || '',
      })
    }
  }, [data])

  // Helper function to validate year in date
  const validateYear = (dateString) => {
    if (!dateString) return null
    const year = dateString.split('-')[0]
    if (year.length !== 4) return 'Year must be 4 digits'
    const yearNum = parseInt(year, 10)
    if (yearNum < 1900 || yearNum > 2100) return 'Year must be between 1900 and 2100'
    return null
  }

  // Validation function
  const validateField = (name, value) => {
    // Only validate if checkbox is checked
    if (!formData.signedOffMedical) return ''
    
    switch (name) {
      case 'vesselName':
        if (formData.signedOffMedical && !value) {
          return 'Vessel name is required when medical history is reported'
        }
        return ''
      case 'dateOfOccurrence':
        if (formData.signedOffMedical && !value) {
          return 'Date of occurrence is required when medical history is reported'
        }
        if (value) {
          const yearError = validateYear(value)
          if (yearError) return yearError
        }
        return ''
      case 'description':
        if (formData.signedOffMedical && !value) {
          return 'Description is required when medical history is reported'
        }
        if (formData.signedOffMedical && value && value.trim().length < 10) {
          return 'Please provide a more detailed description (at least 10 characters)'
        }
        return ''
      default:
        return ''
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value
    
    let newFormData = {
      ...formData,
      [name]: fieldValue
    }

    // Clear fields if checkbox is unchecked
    if (name === 'signedOffMedical' && !checked) {
      newFormData = {
        ...newFormData,
        vesselName: '',
        dateOfOccurrence: '',
        description: '',
      }
      // Clear all errors when unchecked
      setErrors({})
    } else if (name === 'signedOffMedical' && checked) {
      // When checkbox is checked, validate all conditional fields
      const vesselError = validateField('vesselName', newFormData.vesselName)
      const dateError = validateField('dateOfOccurrence', newFormData.dateOfOccurrence)
      const descError = validateField('description', newFormData.description)
      setErrors({
        vesselName: vesselError,
        dateOfOccurrence: dateError,
        description: descError
      })
    } else {
      // Validate individual field
      setTouched(prev => ({ ...prev, [name]: true }))
      const error = validateField(name, fieldValue)
      setErrors(prev => ({ ...prev, [name]: error }))
    }
    
    setFormData(newFormData)
    onUpdate({ section11: { medicalHistory: newFormData } })
  }

  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    const error = validateField(name, formData[name])
    setErrors(prev => ({ ...prev, [name]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 11: Medical History</h2>
        <p className="text-gray-600 mt-1">
          Provide information about any medical-related incidents at sea
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Main Question */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="signedOffMedical"
              name="signedOffMedical"
              checked={formData.signedOffMedical}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="signedOffMedical" className="ml-3 block">
              <span className="text-sm font-medium text-gray-900">
                Have you ever been signed off from a vessel due to medical reasons?
              </span>
              <p className="text-xs text-gray-500 mt-1">
                This includes illness, injury, or any medical condition that required you to leave the vessel before the end of your contract
              </p>
            </label>
          </div>
        </div>

        {/* Conditional Fields */}
        {formData.signedOffMedical && (
          <div className="space-y-5 pl-4 border-l-4 border-blue-500">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Please provide details about the incident below. This information is treated confidentially and is used only for safety and assessment purposes.
              </p>
            </div>

            <FormInput
              label="Vessel Name"
              name="vesselName"
              required={formData.signedOffMedical}
              value={formData.vesselName}
              onChange={handleChange}
              onBlur={() => handleBlur('vesselName')}
              placeholder="e.g., MV Atlantic Explorer"
              helpText="Name of the vessel you were signed off from"
              error={touched.vesselName ? errors.vesselName : ''}
            />

            <FormDatePicker
              label="Date of Occurrence"
              name="dateOfOccurrence"
              required={formData.signedOffMedical}
              value={formData.dateOfOccurrence}
              onChange={handleChange}
              onBlur={() => handleBlur('dateOfOccurrence')}
              max={new Date().toISOString().split('T')[0]}
              helpText="Approximate date when the incident occurred"
              error={touched.dateOfOccurrence ? errors.dateOfOccurrence : ''}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description of Medical Condition
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                onBlur={() => handleBlur('description')}
                rows={5}
                className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                  touched.description && errors.description
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="Please provide details about the medical condition, treatment received, and current health status..."
                required={formData.signedOffMedical}
              />
              {!touched.description || !errors.description ? (
                <p className="mt-1 text-sm text-gray-500">
                  Include the nature of the condition, any treatment you received, and your current health status
                </p>
              ) : (
                <p className="mt-1 text-sm text-red-600 flex items-start gap-1">
                  <span className="text-red-500">⚠</span>
                  <span>{errors.description}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* No Medical History Message */}
        {!formData.signedOffMedical && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-900 mb-1">
                  ✓ No Medical History Reported
                </h3>
                <p className="text-sm text-green-800">
                  You have indicated that you have not been signed off from a vessel due to medical reasons.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">
              🏥 Confidentiality Notice
            </h3>
            <p className="text-sm text-amber-800">
              All medical information is kept strictly confidential and is used solely for the purpose of ensuring the safety and well-being of seafarers. This information helps us provide appropriate support and assess fitness for duty.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}