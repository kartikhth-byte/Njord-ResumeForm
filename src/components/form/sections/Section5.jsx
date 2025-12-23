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
    if (data && data.visas) {
      setVisas(data.visas)
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
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 5: Visas</h2>
        <p className="text-gray-600 mt-1">
          Add all your current valid visas for maritime travel
        </p>
      </div>

      {/* Visas List */}
      <div className="space-y-6">
        {visas.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-600 mb-4">No visas added yet</p>
            <button
              onClick={handleAddVisa}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Visa
            </button>
          </div>
        ) : (
          <>
            {visas.map((visa, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Visa Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Visa {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveVisa(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              onClick={handleAddVisa}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Visa</span>
            </button>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              🌍 Tip
            </h3>
            <p className="text-sm text-blue-800">
              Add all valid visas that are commonly required for seafarers (USA C1/D, Schengen, Australia MCV, etc.). Having multiple valid visas increases your employability for international vessels.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}