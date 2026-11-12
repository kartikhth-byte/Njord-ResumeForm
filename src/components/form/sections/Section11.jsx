import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'
import FormTextArea from '../shared/FormTextArea'
import { validateSection11Field } from '../../../utils/sectionValidation'

export default function Section11({ data = {}, onUpdate }) {
  // Fix: Read from data.medicalHistory to match what we're saving
  const medicalHistory = data.medicalHistory || {}
  
  const [formData, setFormData] = useState({
    signedOffMedical: medicalHistory.signedOffMedical ?? null,
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
        signedOffMedical: medicalHistory.signedOffMedical ?? null,
        vesselName: medicalHistory.vesselName || '',
        dateOfOccurrence: medicalHistory.dateOfOccurrence || '',
        description: medicalHistory.description || '',
      })
    }
  }, [data])

  const validateField = (name, value, values = formData) => validateSection11Field(name, value, values)

  const handleChange = (e) => {
    const { name, value } = e.target
    const fieldValue = name === 'signedOffMedical' ? value === 'yes' : value
    
    let newFormData = {
      ...formData,
      [name]: fieldValue
    }

    if (name === 'signedOffMedical') {
      if (fieldValue === false) {
        newFormData = { ...newFormData, vesselName: '', dateOfOccurrence: '', description: '' }
      }
      setErrors({})
      setTouched({ signedOffMedical: true })
    } else {
      setTouched(prev => ({ ...prev, [name]: true }))
      setErrors(prev => ({ ...prev, [name]: validateField(name, fieldValue, newFormData) }))
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
          <fieldset aria-describedby="medical-history-help">
            <legend className="font-medium">Have you ever been signed off from a vessel due to medical reasons? <span className="text-danger">*</span></legend>
            <p id="medical-history-help" className="mt-2 text-sm text-fg-secondary">This includes illness, injury, or any medical condition that required you to leave the vessel before the end of your contract. Select Yes or No.</p>
            <div className="mt-3 flex gap-6">
              {[['yes', true, 'Yes'], ['no', false, 'No']].map(([value, answer, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="signedOffMedical" value={value} required
                    checked={formData.signedOffMedical === answer} onChange={handleChange} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Conditional Fields */}
        {formData.signedOffMedical === true && (
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
