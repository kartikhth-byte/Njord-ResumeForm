import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'
import FormTextArea from '../shared/FormTextArea'
import FormCheckbox from '../shared/FormCheckbox'

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
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Medical history</h2>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Main Question */}
        <div className="applicant-section-card applicant-section-card--muted">
          <FormCheckbox
            label="Have you ever been signed off from a vessel due to medical reasons?"
            name="signedOffMedical"
            checked={formData.signedOffMedical}
            onChange={handleChange}
            helpText="This includes illness, injury, or any medical condition that required you to leave the vessel before the end of your contract."
          />
        </div>

        {/* Conditional Fields */}
        {formData.signedOffMedical && (
          <div className="space-y-5 pl-4 border-l-4 border-accent">
            <FormInput
              label="Vessel Name"
              name="vesselName"
              required={formData.signedOffMedical}
              value={formData.vesselName}
              onChange={handleChange}
              onBlur={() => handleBlur('vesselName')}
              placeholder="e.g., MV Atlantic Explorer"
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
              error={touched.dateOfOccurrence ? errors.dateOfOccurrence : ''}
            />

            <FormTextArea
              label="Description of Medical Condition"
              name="description"
              value={formData.description}
              onChange={handleChange}
              onBlur={() => handleBlur('description')}
              rows={5}
              required={formData.signedOffMedical}
              placeholder="Please provide details about the medical condition, treatment received, and current health status..."
              error={touched.description ? errors.description : ''}
            />
          </div>
        )}

      </div>
    </div>
  )
}
