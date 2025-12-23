import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const FLAG_STATE_OPTIONS = [
  { value: 'Panama', label: 'Panama' },
  { value: 'Liberia', label: 'Liberia' },
  { value: 'Marshall Islands', label: 'Marshall Islands' },
  { value: 'Hong Kong', label: 'Hong Kong (China)' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Malta', label: 'Malta' },
  { value: 'Bahamas', label: 'Bahamas' },
  { value: 'Cyprus', label: 'Cyprus' },
  { value: 'Isle of Man', label: 'Isle of Man (UK)' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Norway', label: 'Norway (NIS)' },
  { value: 'Denmark', label: 'Denmark (DIS)' },
  { value: 'Greece', label: 'Greece' },
  { value: 'USA', label: 'United States' },
  { value: 'India', label: 'India' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'France', label: 'France' },
  { value: 'Japan', label: 'Japan' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'China', label: 'China' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Australia', label: 'Australia' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Other', label: 'Other' },
]

const ENDORSEMENT_TYPE_OPTIONS = [
  { value: 'STCW Endorsement', label: 'STCW Endorsement' },
  { value: 'Recognition of CoC', label: 'Recognition of CoC' },
  { value: 'Flag State Equivalency', label: 'Flag State Equivalency' },
  { value: 'Temporary License', label: 'Temporary License' },
  { value: 'Full License', label: 'Full License' },
  { value: 'Other', label: 'Other' },
]

const emptyEndorsement = {
  flagState: '',
  endorsementType: '',
  rankEndorsed: '',
  endorsementNumber: '',
  dateOfIssue: '',
  dateOfExpiry: '',
  placeOfIssue: '',
}

export default function Section15({ data = {}, onUpdate }) {
  const [endorsements, setEndorsements] = useState(data.endorsements || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.endorsements) {
      setEndorsements(data.endorsements)
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

  // Validation function for endorsement fields
  const validateEndorsementField = (index, field, value) => {
    const key = `endorsement-${index}-${field}`
    
    switch (field) {
      case 'flagState':
        return !value ? 'Flag state is required' : ''
      case 'endorsementType':
        return !value ? 'Endorsement type is required' : ''
      case 'rankEndorsed':
        return !value ? 'Rank endorsed is required' : ''
      case 'endorsementNumber':
        return !value ? 'Endorsement number is required' : ''
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
        if (endorsements[index]?.dateOfIssue && value <= endorsements[index].dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''
      default:
        return ''
    }
  }

  const handleAddEndorsement = () => {
    const newEndorsements = [...endorsements, { ...emptyEndorsement }]
    setEndorsements(newEndorsements)
    onUpdate({ section15: { endorsements: newEndorsements } })
  }

  const handleRemoveEndorsement = (index) => {
    const newEndorsements = endorsements.filter((_, i) => i !== index)
    setEndorsements(newEndorsements)
    onUpdate({ section15: { endorsements: newEndorsements } })
  }

  const handleEndorsementChange = (index, field, value) => {
    const newEndorsements = [...endorsements]
    newEndorsements[index] = {
      ...newEndorsements[index],
      [field]: value
    }
    setEndorsements(newEndorsements)
    
    // Mark field as touched
    const key = `endorsement-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateEndorsementField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section15: { endorsements: newEndorsements } })
  }

  const handleBlur = (index, field) => {
    const key = `endorsement-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = endorsements[index]?.[field]
    const error = validateEndorsementField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Section 15: Flag State Endorsements</h2>
        <p className="text-gray-600 mt-1">
          List all your flag state endorsements and recognitions
        </p>
      </div>

      {/* Endorsements List */}
      <div className="space-y-6">
        {endorsements.length === 0 ? (
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
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
              />
            </svg>
            <p className="text-gray-600 mb-2">No flag state endorsements added yet</p>
            <p className="text-sm text-gray-500 mb-4">Add endorsements if you have any</p>
            <button
              onClick={handleAddEndorsement}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Flag State Endorsement
            </button>
          </div>
        ) : (
          <>
            {endorsements.map((endorsement, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Endorsement Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Flag State Endorsement {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveEndorsement(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Endorsement Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormSelect
                      label="Flag State"
                      name={`endorsement-${index}-flagState`}
                      required
                      value={endorsement.flagState}
                      onChange={(e) => handleEndorsementChange(index, 'flagState', e.target.value)}
                      onBlur={() => handleBlur(index, 'flagState')}
                      options={FLAG_STATE_OPTIONS}
                      helpText="Country that issued the endorsement"
                      error={touched[`endorsement-${index}-flagState`] ? errors[`endorsement-${index}-flagState`] : ''}
                    />

                    <FormSelect
                      label="Endorsement Type"
                      name={`endorsement-${index}-endorsementType`}
                      required
                      value={endorsement.endorsementType}
                      onChange={(e) => handleEndorsementChange(index, 'endorsementType', e.target.value)}
                      onBlur={() => handleBlur(index, 'endorsementType')}
                      options={ENDORSEMENT_TYPE_OPTIONS}
                      error={touched[`endorsement-${index}-endorsementType`] ? errors[`endorsement-${index}-endorsementType`] : ''}
                    />
                  </div>

                  <FormInput
                    label="Rank Endorsed"
                    name={`endorsement-${index}-rankEndorsed`}
                    required
                    value={endorsement.rankEndorsed}
                    onChange={(e) => handleEndorsementChange(index, 'rankEndorsed', e.target.value)}
                    onBlur={() => handleBlur(index, 'rankEndorsed')}
                    placeholder="e.g., Master, Chief Officer, Chief Engineer"
                    helpText="The rank/position this endorsement is valid for"
                    error={touched[`endorsement-${index}-rankEndorsed`] ? errors[`endorsement-${index}-rankEndorsed`] : ''}
                  />

                  <FormInput
                    label="Endorsement Number"
                    name={`endorsement-${index}-endorsementNumber`}
                    required
                    value={endorsement.endorsementNumber}
                    onChange={(e) => handleEndorsementChange(index, 'endorsementNumber', e.target.value)}
                    onBlur={() => handleBlur(index, 'endorsementNumber')}
                    placeholder="e.g., END123456"
                    error={touched[`endorsement-${index}-endorsementNumber`] ? errors[`endorsement-${index}-endorsementNumber`] : ''}
                  />

                  <FormInput
                    label="Place of Issue"
                    name={`endorsement-${index}-placeOfIssue`}
                    required
                    value={endorsement.placeOfIssue}
                    onChange={(e) => handleEndorsementChange(index, 'placeOfIssue', e.target.value)}
                    onBlur={() => handleBlur(index, 'placeOfIssue')}
                    placeholder="e.g., Panama City, Panama"
                    error={touched[`endorsement-${index}-placeOfIssue`] ? errors[`endorsement-${index}-placeOfIssue`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="Date of Issue"
                      name={`endorsement-${index}-dateOfIssue`}
                      required
                      value={endorsement.dateOfIssue}
                      onChange={(e) => handleEndorsementChange(index, 'dateOfIssue', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfIssue')}
                      max={new Date().toISOString().split('T')[0]}
                      error={touched[`endorsement-${index}-dateOfIssue`] ? errors[`endorsement-${index}-dateOfIssue`] : ''}
                    />

                    <FormDatePicker
                      label="Date of Expiry"
                      name={`endorsement-${index}-dateOfExpiry`}
                      required
                      value={endorsement.dateOfExpiry}
                      onChange={(e) => handleEndorsementChange(index, 'dateOfExpiry', e.target.value)}
                      onBlur={() => handleBlur(index, 'dateOfExpiry')}
                      min={endorsement.dateOfIssue || new Date().toISOString().split('T')[0]}
                      helpText="Must be after date of issue"
                      error={touched[`endorsement-${index}-dateOfExpiry`] ? errors[`endorsement-${index}-dateOfExpiry`] : ''}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddEndorsement}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Flag State Endorsement</span>
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
              About Flag State Endorsements
            </h3>
            <p className="text-sm text-blue-800">
              Flag state endorsements allow you to serve on vessels registered under that particular flag. Common flags include Panama, Liberia, Marshall Islands, and Singapore. Many companies require specific flag state endorsements. These are issued based on your Certificate of Competency and STCW certificates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}