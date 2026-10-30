/* eslint-disable no-unused-vars, no-case-declarations */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const emptyCertificate = {
  grade: '',
  issuingAuthority: '',
  certificateNumber: '',
  dateOfIssue: '',
  dateOfExpiry: '',
  placeOfIssue: '',
  dateRevalidated: '',
  dateRevalidationExpiry: '',
}

export default function Section8({ data = {}, onUpdate }) {
  const [certificates, setCertificates] = useState(data.certificates || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Array.isArray(data.certificates)) {
      setCertificates(prevCertificates => (
        data.certificates.length === 0 && prevCertificates.length > 0 ? prevCertificates : data.certificates
      ))
    }
  }, [data])

  // Validation function for individual certificate fields
  const validateCertificateField = (index, field, value) => {
    const key = `cert-${index}-${field}`
    
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
      case 'grade':
        return !value ? 'Grade/rank is required' : ''
      case 'issuingAuthority':
        return !value ? 'Issuing authority is required' : ''
      case 'certificateNumber':
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
        if (certificates[index]?.dateOfIssue && value <= certificates[index].dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''
      case 'dateRevalidated':
        // Optional field - but validate year if provided
        if (value) {
          const revalidYearError = validateYear(value)
          if (revalidYearError) return revalidYearError
        }
        return ''
      case 'dateRevalidationExpiry':
        // Optional, but if dateRevalidated exists, should be after it
        if (value) {
          const revalidExpiryYearError = validateYear(value)
          if (revalidExpiryYearError) return revalidExpiryYearError
          if (certificates[index]?.dateRevalidated && value <= certificates[index].dateRevalidated) {
            return 'Revalidation expiry must be after revalidation date'
          }
        }
        return ''
      default:
        return ''
    }
  }

  const handleAddCertificate = () => {
    const newCertificates = [...certificates, { ...emptyCertificate }]
    setCertificates(newCertificates)
    onUpdate({ section8: { certificates: newCertificates } })
  }

  const handleRemoveCertificate = (index) => {
    const newCertificates = certificates.filter((_, i) => i !== index)
    setCertificates(newCertificates)
    onUpdate({ section8: { certificates: newCertificates } })
  }

  const handleCertificateChange = (index, field, value) => {
    const newCertificates = [...certificates]
    newCertificates[index] = {
      ...newCertificates[index],
      [field]: value
    }
    setCertificates(newCertificates)
    
    // Mark field as touched
    const key = `cert-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateCertificateField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section8: { certificates: newCertificates } })
  }

  const handleBlur = (index, field) => {
    const key = `cert-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate on blur
    const value = certificates[index]?.[field]
    const error = validateCertificateField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">National certificates of competency</h2>
      </div>

      {/* Certificates List */}
      <div className="space-y-6">
        {certificates.length === 0 ? (
          <div className="applicant-empty-state">
            <svg
              className="w-12 h-12 text-fg-muted mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            <p className="text-fg-secondary mb-4">No certificates added yet</p>
            <button
              onClick={handleAddCertificate}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add Certificate
            </button>
          </div>
        ) : (
          <>
            {certificates.map((cert, index) => (
              <div key={index} className="applicant-record-card">
                {/* Certificate Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">Certificate {index + 1}</h3>
                  </div>
                  <button
                    onClick={() => handleRemoveCertificate(index)}
                    className="applicant-action applicant-action--secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Certificate Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Grade"
                      name={`cert-${index}-grade`}
                      required
                      value={cert.grade}
                      onChange={(e) => handleCertificateChange(index, 'grade', e.target.value)}
                      onBlur={() => handleBlur(index, 'grade')}
                      placeholder="e.g., Master Unlimited, Chief Officer"
                      helpText="Certificate grade/rank"
                      error={touched[`cert-${index}-grade`] ? errors[`cert-${index}-grade`] : ''}
                    />

                    <FormInput
                      label="Issuing Authority"
                      name={`cert-${index}-issuingAuthority`}
                      required
                      value={cert.issuingAuthority}
                      onChange={(e) => handleCertificateChange(index, 'issuingAuthority', e.target.value)}
                      onBlur={() => handleBlur(index, 'issuingAuthority')}
                      placeholder="e.g., USCG, Indian DG Shipping, UK MCA"
                      error={touched[`cert-${index}-issuingAuthority`] ? errors[`cert-${index}-issuingAuthority`] : ''}
                    />
                  </div>

                  <FormInput
                    label="Certificate Number"
                    name={`cert-${index}-certificateNumber`}
                    required
                    value={cert.certificateNumber}
                    onChange={(e) => handleCertificateChange(index, 'certificateNumber', e.target.value)}
                    onBlur={() => handleBlur(index, 'certificateNumber')}
                    placeholder="e.g., COC123456"
                    error={touched[`cert-${index}-certificateNumber`] ? errors[`cert-${index}-certificateNumber`] : ''}
                  />

                  <FormInput
                    label="Place of Issue"
                    name={`cert-${index}-placeOfIssue`}
                    required
                    value={cert.placeOfIssue}
                    onChange={(e) => handleCertificateChange(index, 'placeOfIssue', e.target.value)}
                    onBlur={() => handleBlur(index, 'placeOfIssue')}
                    placeholder="e.g., Mumbai, India"
                    error={touched[`cert-${index}-placeOfIssue`] ? errors[`cert-${index}-placeOfIssue`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="Date of Issue"
                      name={`cert-${index}-dateOfIssue`}
                      required
                      value={cert.dateOfIssue}
                      onChange={(e) => handleCertificateChange(index, 'dateOfIssue', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfIssue')}
                      max={new Date().toISOString().split('T')[0]}
                      error={touched[`cert-${index}-dateOfIssue`] ? errors[`cert-${index}-dateOfIssue`] : ''}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`cert-${index}-dateOfExpiry`}
                      required
                      value={cert.dateOfExpiry}
                      onChange={(e) => handleCertificateChange(index, 'dateOfExpiry', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfExpiry')}
                      min={cert.dateOfIssue || new Date().toISOString().split('T')[0]}
                      error={touched[`cert-${index}-dateOfExpiry`] ? errors[`cert-${index}-dateOfExpiry`] : ''}
                    />
                  </div>

                  {/* Revalidation Section */}
                  <div className="applicant-record-card__divider">
                    <h4 className="text-sm font-semibold text-fg-secondary mb-3">Revalidation Details (if applicable)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormDatePicker
                        label="Date Revalidated"
                        name={`cert-${index}-dateRevalidated`}
                        value={cert.dateRevalidated}
                        onChange={(e) => handleCertificateChange(index, 'dateRevalidated', e.target.value)}
                        onBlur={() => handleBlur(index, 'dateRevalidated')}
                        max={new Date().toISOString().split('T')[0]}
                        helpText="Leave blank if not revalidated"
                        error={touched[`cert-${index}-dateRevalidated`] ? errors[`cert-${index}-dateRevalidated`] : ''}
                      />

                      <FormDatePicker
                        label="Revalidation Expiry"
                        name={`cert-${index}-dateRevalidationExpiry`}
                        value={cert.dateRevalidationExpiry}
                        onChange={(e) => handleCertificateChange(index, 'dateRevalidationExpiry', e.target.value)}
                        onBlur={() => handleBlur(index, 'dateRevalidationExpiry')}
                        min={cert.dateRevalidated || new Date().toISOString().split('T')[0]}
                        helpText="Leave blank if not revalidated"
                        error={touched[`cert-${index}-dateRevalidationExpiry`] ? errors[`cert-${index}-dateRevalidationExpiry`] : ''}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddCertificate}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-line-input"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Certificate</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
