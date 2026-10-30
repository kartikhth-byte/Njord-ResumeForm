import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'

export default function Section4({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    cdcNumber: data.cdcNumber || '',
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
        cdcNumber: data.cdcNumber || '',
        placeOfIssue: data.placeOfIssue || '',
        dateOfIssue: data.dateOfIssue || '',
        dateOfExpiry: data.dateOfExpiry || '',
        issuingAuthority: data.issuingAuthority || '',
      })
    }
  }, [data])

  const validateField = (name, value) => {
    switch (name) {
      case 'cdcNumber':
        if (!value) return 'CDC/Seaman\'s book number is required'
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

    onUpdate({ section4: newFormData })
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">CDC / National Seaman&apos;s Book</h2>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        <FormInput
          label="CDC / Seaman's Book Number"
          name="cdcNumber"
          required
          value={formData.cdcNumber}
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.cdcNumber ? errors.cdcNumber : ''}
          placeholder="e.g., CDC123456 or SB789012"
          helpText="Your CDC or Seaman's Book identification number"
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
  helpText="City and country where CDC/Seaman's Book was issued"
/>

<FormInput
  label="Issuing Authority"
  name="issuingAuthority"
  required
  value={formData.issuingAuthority}
  onChange={(e) => {
    const capitalized = autoCapitalize(e.target.value)
    handleChange({ target: { name: 'issuingAuthority', value: capitalized } })
  }}
  onBlur={handleBlur}
  error={touched.issuingAuthority ? errors.issuingAuthority : ''}
  placeholder="e.g., DG Shipping India, UK MCA, USCG"
  helpText="Government maritime authority that issued the document"
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
            helpText="When the CDC was issued"
          />

          <FormDatePicker
            label="Date of Expiry"
            name="dateOfExpiry"
            required
            value={formData.dateOfExpiry}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.dateOfExpiry ? errors.dateOfExpiry : ''}
            min={formData.dateOfIssue || new Date().toISOString().split('T')[0]}
            helpText="When the CDC expires"
          />
        </div>
      </div>
    </div>
  )
}
