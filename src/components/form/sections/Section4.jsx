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
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 4: CDC / National Seaman's Book</h2>
        <p className="text-gray-600 mt-1">
          Provide your Continuous Discharge Certificate or Seaman's Book details
        </p>
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
          onChange={handleChange}
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
          onChange={handleChange}
          onBlur={handleBlur}
          error={touched.issuingAuthority ? errors.issuingAuthority : ''}
          placeholder="e.g., USCG, Indian DG Shipping, UK MCA"
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

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">
              ⚠️ Note
            </h3>
            <p className="text-sm text-amber-800">
              Also known as "Continuous Discharge Certificate" (CDC) or "Seaman's Book" depending on your country. This is a mandatory document for all seafarers. Ensure it is valid and up-to-date.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}