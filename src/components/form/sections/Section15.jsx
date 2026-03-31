/* eslint-disable no-unused-vars, no-case-declarations */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const FLAG_STATE_ENDORSEMENT_TYPES = {
  Malta: [
    "Seafarer's Book",
    'Endorsement of the GMDSS',
    'Endorsement of the CoC',
  ],
  Cyprus: [
    "Seafarer's ID and Sea Service Record Book",
    'Cert. Of Recognition of the National CoC',
  ],
  Bahamas: [
    'Endorsement of the CoC',
    'Endorsement of the GMDSS',
    "Seafarer's Identification and Record Book",
  ],
  'United Kingdom': [
    'Endorsement of the CoC (UK CeC)',
    'Endorsement of the GMDSS',
    "Seafarer's Identification and Record Book",
  ],
  Panama: [
    'Endorsement of the CoC',
    'Endorsement of the GMDSS GOC',
    "Seafarer's Identification and Record Book",
  ],
}

const FLAG_STATE_OPTIONS = Object.keys(FLAG_STATE_ENDORSEMENT_TYPES).map((flagState) => ({
  value: flagState,
  label: flagState,
}))

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
    if (data && Array.isArray(data.endorsements)) {
      setEndorsements(prevEndorsements => (
        data.endorsements.length === 0 && prevEndorsements.length > 0 ? prevEndorsements : data.endorsements
      ))
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
    const currentEndorsement = {
      ...newEndorsements[index],
      [field]: value,
    }
    if (field === 'flagState') {
      const allowedEndorsementTypes = FLAG_STATE_ENDORSEMENT_TYPES[value] || []
      if (!allowedEndorsementTypes.includes(currentEndorsement.endorsementType)) {
        currentEndorsement.endorsementType = ''
      }
    }
    newEndorsements[index] = currentEndorsement
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

  const getEndorsementTypeOptions = (flagState) => (
    (FLAG_STATE_ENDORSEMENT_TYPES[flagState] || []).map((type) => ({
      value: type,
      label: type,
    }))
  )

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <p className="applicant-section-kicker">Qualifications</p>
        <h2 className="applicant-section-title">Flag state endorsements</h2>
        <p className="applicant-section-copy">
          List all your flag state endorsements and recognitions
        </p>
      </div>

      {/* Endorsements List */}
      <div className="space-y-6">
        {endorsements.length === 0 ? (
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
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
              />
            </svg>
            <p className="text-gray-600 mb-2">No flag state endorsements added yet</p>
            <p className="text-sm text-gray-500 mb-4">Add endorsements if you have any</p>
            <button
              onClick={handleAddEndorsement}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add Flag State Endorsement
            </button>
          </div>
        ) : (
          <>
            {endorsements.map((endorsement, index) => (
              <div key={index} className="applicant-record-card">
                {/* Endorsement Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">Flag State Endorsement {index + 1}</h3>
                    <p className="applicant-record-card__subtitle">
                      Add every endorsement or recognition that authorizes you to serve under a specific flag.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveEndorsement(index)}
                    className="applicant-action applicant-action--secondary"
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
                      options={getEndorsementTypeOptions(endorsement.flagState)}
                      disabled={!endorsement.flagState}
                      helpText={endorsement.flagState ? 'Choose an endorsement type allowed for the selected flag state' : 'Select a flag state first'}
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
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-slate-300"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Flag State Endorsement</span>
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
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              About Flag State Endorsements
            </h3>
            <p className="text-sm text-blue-800">
              Flag state endorsements allow you to serve on vessels registered under that particular flag. Use the listed flag states and choose the endorsement type that matches the selected administration's document naming.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
