import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'  // ADD THIS
import FormDatePicker from '../shared/FormDatePicker'
import { COUNTRIES } from '../../../utils/countryData'  // ADD THIS

export default function Section3({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    passportNumber: data.passportNumber || '',
    placeOfIssue: data.placeOfIssue || '',
    dateOfIssue: data.dateOfIssue || '',
    dateOfExpiry: data.dateOfExpiry || '',
    issuingAuthority: data.issuingAuthority || '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

// Auto-capitalize helper function - converts to Title Case
const autoCapitalize = (value) => {
  if (!value) return ''
  return value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        passportNumber: data.passportNumber || '',
        placeOfIssue: data.placeOfIssue || '',
        dateOfIssue: data.dateOfIssue || '',
        dateOfExpiry: data.dateOfExpiry || '',
        issuingAuthority: data.issuingAuthority || '',
      })
    }
  }, [data])

  const validateField = (name, value) => {
    switch (name) {
      case 'passportNumber':
        if (!value) return 'Passport number is required'
        return ''

      case 'placeOfIssue':
        if (!value) return 'Place of issue is required'
        return ''

      case 'dateOfIssue':
        if (!value) return 'Date of issue is required'
        return ''

      case 'dateOfExpiry':
        if (!value) return 'Date of expiry is required'
        if (value <= formData.dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''

      case 'issuingAuthority':
        if (!value) return 'Issuing authority is required'
        return ''

      default:
        return ''
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    const newFormData = {
      ...formData,
      [name]: value
    }
    
    setFormData(newFormData)
    setTouched(prev => ({ ...prev, [name]: true }))

    const error = validateField(name, value)
    setErrors(prev => ({ ...prev, [name]: error }))

    onUpdate({ section3: newFormData })
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Passport details</h2>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        <FormInput
          label="Passport Number"
          name="passportNumber"
          required
          value={formData.passportNumber}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.passportNumber ? errors.passportNumber : ''}
          placeholder="e.g., A12345678"
        />

<FormInput
  label="Place of Issue"
  name="placeOfIssue"
  required
  value={formData.placeOfIssue}
  onChange={(e) => {
    const capitalized = autoCapitalize(e.target.value)
    handleChange({ target: { name: 'placeOfIssue', value: capitalized } })
  }}
  onBlur={handleBlur}
  error={touched.placeOfIssue ? errors.placeOfIssue : ''}
  placeholder="e.g., Mumbai, India"
/>

<FormSelect
  label="Issuing Authority (Country)"
  name="issuingAuthority"
  required
  value={formData.issuingAuthority}
  onChange={handleChange}
  onBlur={handleBlur}
  options={COUNTRIES}
  placeholder="Select issuing country"
  error={touched.issuingAuthority ? errors.issuingAuthority : ''}
/>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormDatePicker
            label="Date of Issue"
            name="dateOfIssue"
            required
            value={formData.dateOfIssue}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.dateOfIssue ? errors.dateOfIssue : ''}
            max={new Date().toISOString().split('T')[0]}
          />

          <FormDatePicker
            label="Date of Expiry"
            name="dateOfExpiry"
            required
            value={formData.dateOfExpiry}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.dateOfExpiry ? errors.dateOfExpiry : ''}
            helpText="Must be valid at least 6 months beyond joining"
            min={formData.dateOfIssue || new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>
    </div>
  )
}
