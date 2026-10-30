/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const VISA_TYPES = [
  { value: 'C1/D (USA)', label: 'C1/D (USA) - Transit/Crew' },
  { value: 'C1 (USA)', label: 'C1 (USA) - Transit' },
  { value: 'D (USA)', label: 'D (USA) - Crew Member' },
  { value: 'Australia Entry Visa', label: 'Australia Entry Visa' },
  { value: 'MCV (Australia)', label: 'MCV (Australia) - Maritime Crew Visa' },
  { value: 'Schengen', label: 'Schengen - European Union' },
  { value: 'UK Seafarer', label: 'UK Seafarer Visa' },
  { value: 'Canada Transit', label: 'Canada Transit Visa' },
  { value: 'Other', label: 'Other' },
]

const emptyVisa = {
  type: '',
  number: '',
  placeOfIssue: '',
  dateOfIssue: '',
  dateOfExpiry: '',
}

export default function Section5({ data = {}, onUpdate }) {
  const [visas, setVisas] = useState(data.visas || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Array.isArray(data.visas)) {
      setVisas(prevVisas => (
        data.visas.length === 0 && prevVisas.length > 0 ? prevVisas : data.visas
      ))
    }
  }, [data])

  // Validation function for individual visa fields
  const validateVisaField = (index, field, value) => {
    const key = `visa-${index}-${field}`
    
    switch (field) {
      case 'type':
        return !value ? 'Visa type is required' : ''
      case 'number':
        return !value ? 'Visa number is required' : ''
      case 'placeOfIssue':
        return !value ? 'Place of issue is required' : ''
      case 'dateOfIssue':
        return !value ? 'Date of issue is required' : ''
      case 'dateOfExpiry':
        if (!value) return 'Date of expiry is required'
        if (visas[index]?.dateOfIssue && value <= visas[index].dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''
      default:
        return ''
    }
  }

  const handleAddVisa = () => {
    const newVisas = [...visas, { ...emptyVisa }]
    setVisas(newVisas)
    onUpdate({ section5: { visas: newVisas } })
  }

  const handleRemoveVisa = (index) => {
    const newVisas = visas.filter((_, i) => i !== index)
    setVisas(newVisas)
    onUpdate({ section5: { visas: newVisas } })
  }

  const handleVisaChange = (index, field, value) => {
    const newVisas = [...visas]
    newVisas[index] = {
      ...newVisas[index],
      [field]: value
    }
    setVisas(newVisas)
    
    // Mark field as touched
    const key = `visa-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateVisaField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section5: { visas: newVisas } })
  }

  const handleBlur = (index, field) => {
    const key = `visa-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate on blur
    const value = visas[index]?.[field]
    const error = validateVisaField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Visas</h2>
      </div>

      {/* Visas List */}
      <div className="space-y-6">
        {visas.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-fg-secondary mb-4">No visas added yet</p>
            <button
              type="button"
              onClick={handleAddVisa}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add Your First Visa
            </button>
          </div>
        ) : (
          <>
            {visas.map((visa, index) => (
              <div key={index} className="applicant-record-card">
                {/* Visa Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">Visa {index + 1}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVisa(index)}
                    className="applicant-action applicant-action--secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Visa Fields */}
                <div className="space-y-4">
                  <FormSelect
                    label="Visa Type"
                    name={`visa-${index}-type`}
                    required
                    value={visa.type}
                    onChange={(e) => handleVisaChange(index, 'type', e.target.value)}
                    onBlur={() => handleBlur(index, 'type')}
                    options={VISA_TYPES}
                    error={touched[`visa-${index}-type`] ? errors[`visa-${index}-type`] : ''}
                  />

                  <FormInput
                    label="Visa Number"
                    name={`visa-${index}-number`}
                    required
                    value={visa.number}
                    onChange={(e) => handleVisaChange(index, 'number', e.target.value)}
                    onBlur={() => handleBlur(index, 'number')}
                    placeholder="e.g., V12345678"
                    error={touched[`visa-${index}-number`] ? errors[`visa-${index}-number`] : ''}
                  />

                  <FormInput
                    label="Place of Issue"
                    name={`visa-${index}-placeOfIssue`}
                    required
                    value={visa.placeOfIssue}
                    onChange={(e) => handleVisaChange(index, 'placeOfIssue', e.target.value)}
                    onBlur={() => handleBlur(index, 'placeOfIssue')}
                    placeholder="e.g., US Embassy, Mumbai"
                    error={touched[`visa-${index}-placeOfIssue`] ? errors[`visa-${index}-placeOfIssue`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="Date of Issue"
                      name={`visa-${index}-dateOfIssue`}
                      required
                      value={visa.dateOfIssue}
                      onChange={(e) => handleVisaChange(index, 'dateOfIssue', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfIssue')}
                      max={new Date().toISOString().split('T')[0]}
                      error={touched[`visa-${index}-dateOfIssue`] ? errors[`visa-${index}-dateOfIssue`] : ''}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`visa-${index}-dateOfExpiry`}
                      required
                      value={visa.dateOfExpiry}
                      onChange={(e) => handleVisaChange(index, 'dateOfExpiry', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfExpiry')}
                      min={visa.dateOfIssue || new Date().toISOString().split('T')[0]}
                      error={touched[`visa-${index}-dateOfExpiry`] ? errors[`visa-${index}-dateOfExpiry`] : ''}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              type="button"
              onClick={handleAddVisa}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-line-input"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Visa</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
