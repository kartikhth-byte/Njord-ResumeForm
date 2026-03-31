/* eslint-disable no-unused-vars, no-case-declarations */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const emptyGMDSS = {
  issuingAuthority: '',
  number: '',
  dateOfIssue: '',
  dateOfExpiry: '',
  placeOfIssue: '',
}

export default function Section9({ data = {}, onUpdate }) {
  const [gmdss, setGmdss] = useState(data.gmdss || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Array.isArray(data.gmdss)) {
      setGmdss(prevGmdss => (
        data.gmdss.length === 0 && prevGmdss.length > 0 ? prevGmdss : data.gmdss
      ))
    }
  }, [data])

  // Validation function for individual GMDSS certificate fields
  const validateGMDSSField = (index, field, value) => {
    const key = `gmdss-${index}-${field}`
    
    // Helper function to validate year in date
    const validateYear = (dateString) => {
      if (!dateString) return null
      const year = dateString.split('-')[0]
      if (year.length !== 4) return 'Year must be 4 digits'
      const yearNum = parseInt(year, 10)
      if (yearNum < 1900 || yearNum > 2100) return 'Year must be between 1900 and 2100'
      return null
    }
    
    switch (field) {
      case 'issuingAuthority':
        return !value ? 'Issuing authority is required' : ''
      case 'number':
        return !value ? 'Certificate number is required' : ''
      case 'placeOfIssue':
        return !value ? 'Place of issue is required' : ''
      case 'dateOfIssue':
        if (!value) return 'Date of issue is required'
        const issueYearError = validateYear(value)
        if (issueYearError) return issueYearError
        return ''
      case 'dateOfExpiry':
        if (!value) return 'Date of expiry is required'
        const expiryYearError = validateYear(value)
        if (expiryYearError) return expiryYearError
        if (gmdss[index]?.dateOfIssue && value <= gmdss[index].dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''
      default:
        return ''
    }
  }

  const handleAddGMDSS = () => {
    const newGmdss = [...gmdss, { ...emptyGMDSS }]
    setGmdss(newGmdss)
    onUpdate({ section9: { gmdss: newGmdss } })
  }

  const handleRemoveGMDSS = (index) => {
    const newGmdss = gmdss.filter((_, i) => i !== index)
    setGmdss(newGmdss)
    onUpdate({ section9: { gmdss: newGmdss } })
  }

  const handleGMDSSChange = (index, field, value) => {
    const newGmdss = [...gmdss]
    newGmdss[index] = {
      ...newGmdss[index],
      [field]: value
    }
    setGmdss(newGmdss)
    
    // Mark field as touched
    const key = `gmdss-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateGMDSSField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section9: { gmdss: newGmdss } })
  }

  const handleBlur = (index, field) => {
    const key = `gmdss-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate on blur
    const value = gmdss[index]?.[field]
    const error = validateGMDSSField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <p className="applicant-section-kicker">Qualifications</p>
        <h2 className="applicant-section-title">GMDSS certificates</h2>
        <p className="applicant-section-copy">
          List all your Global Maritime Distress and Safety System (GMDSS) certificates
        </p>
      </div>

      {/* GMDSS List */}
      <div className="space-y-6">
        {gmdss.length === 0 ? (
          <div className="applicant-empty-state">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="text-gray-600 mb-4">No GMDSS certificates added yet</p>
            <button
              onClick={handleAddGMDSS}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add GMDSS Certificate
            </button>
          </div>
        ) : (
          <>
            {gmdss.map((cert, index) => (
              <div key={index} className="applicant-record-card">
                {/* GMDSS Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">GMDSS Certificate {index + 1}</h3>
                    <p className="applicant-record-card__subtitle">
                      Add each GOC, ROC, or related radio communications certificate that is currently valid.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveGMDSS(index)}
                    className="applicant-action applicant-action--secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* GMDSS Fields */}
                <div className="space-y-4">
                  <FormInput
                    label="Issuing Authority"
                    name={`gmdss-${index}-issuingAuthority`}
                    required
                    value={cert.issuingAuthority}
                    onChange={(e) => handleGMDSSChange(index, 'issuingAuthority', e.target.value)}
                    onBlur={() => handleBlur(index, 'issuingAuthority')}
                    placeholder="e.g., FCC, Ofcom, WPC India"
                    helpText="Telecommunications authority that issued the certificate"
                    error={touched[`gmdss-${index}-issuingAuthority`] ? errors[`gmdss-${index}-issuingAuthority`] : ''}
                  />

                  <FormInput
                    label="Certificate Number"
                    name={`gmdss-${index}-number`}
                    required
                    value={cert.number}
                    onChange={(e) => handleGMDSSChange(index, 'number', e.target.value)}
                    onBlur={() => handleBlur(index, 'number')}
                    placeholder="e.g., GMDSS123456"
                    error={touched[`gmdss-${index}-number`] ? errors[`gmdss-${index}-number`] : ''}
                  />

                  <FormInput
                    label="Place of Issue"
                    name={`gmdss-${index}-placeOfIssue`}
                    required
                    value={cert.placeOfIssue}
                    onChange={(e) => handleGMDSSChange(index, 'placeOfIssue', e.target.value)}
                    onBlur={() => handleBlur(index, 'placeOfIssue')}
                    placeholder="e.g., Mumbai, India"
                    error={touched[`gmdss-${index}-placeOfIssue`] ? errors[`gmdss-${index}-placeOfIssue`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="Date of Issue"
                      name={`gmdss-${index}-dateOfIssue`}
                      required
                      value={cert.dateOfIssue}
                      onChange={(e) => handleGMDSSChange(index, 'dateOfIssue', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfIssue')}
                      max={new Date().toISOString().split('T')[0]}
                      error={touched[`gmdss-${index}-dateOfIssue`] ? errors[`gmdss-${index}-dateOfIssue`] : ''}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`gmdss-${index}-dateOfExpiry`}
                      required
                      value={cert.dateOfExpiry}
                      onChange={(e) => handleGMDSSChange(index, 'dateOfExpiry', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfExpiry')}
                      min={cert.dateOfIssue || new Date().toISOString().split('T')[0]}
                      error={touched[`gmdss-${index}-dateOfExpiry`] ? errors[`gmdss-${index}-dateOfExpiry`] : ''}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddGMDSS}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-slate-300"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another GMDSS Certificate</span>
            </button>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="applicant-section-card applicant-section-card--muted">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">About GMDSS</h3>
            <p className="text-sm text-blue-800">
              GMDSS certificates are mandatory for deck officers working on vessels equipped with GMDSS equipment. Common types include GOC (General Operator Certificate) and ROC (Restricted Operator Certificate).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
