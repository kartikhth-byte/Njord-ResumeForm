import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import { Plus, Trash2 } from 'lucide-react'

const RELATIONSHIP_OPTIONS = [
  { value: 'Former Captain', label: 'Former Captain' },
  { value: 'Former Chief Engineer', label: 'Former Chief Engineer' },
  { value: 'Former Chief Officer', label: 'Former Chief Officer' },
  { value: 'Former Second Engineer', label: 'Former Second Engineer' },
  { value: 'Fleet Manager', label: 'Fleet Manager' },
  { value: 'Technical Superintendent', label: 'Technical Superintendent' },
  { value: 'Crewing Manager', label: 'Crewing Manager' },
  { value: 'HR Manager', label: 'HR Manager' },
  { value: 'Port Captain', label: 'Port Captain' },
  { value: 'Former Colleague', label: 'Former Colleague' },
  { value: 'Training Instructor', label: 'Training Instructor' },
  { value: 'Other', label: 'Other' },
]

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const emptyCurrentEmployer = {
  company: '',
  contactPerson: '',
  address: '',
  phoneNumber: '',
}

const emptyReference = {
  name: '',
  position: '',
  company: '',
  address: '',
  relationship: '',
  phoneNumber: '',
  email: '',
  yearsKnown: '',
  additionalNotes: '',
}

export default function Section18({ data = {}, onUpdate }) {
  const [objectionToContactLastEmployer, setObjectionToContactLastEmployer] = useState(data.objectionToContactLastEmployer || '')
  const [currentEmployer, setCurrentEmployer] = useState(data.currentEmployer || emptyCurrentEmployer)
  const [references, setReferences] = useState(data.references || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const buildSection18Payload = (overrides = {}) => ({
    objectionToContactLastEmployer,
    currentEmployer,
    references,
    ...overrides,
  })

  // Sync state when data prop changes
  useEffect(() => {
    if (data) {
      setObjectionToContactLastEmployer(data.objectionToContactLastEmployer || '')
      setCurrentEmployer(data.currentEmployer || emptyCurrentEmployer)
      if (Array.isArray(data.references)) {
        setReferences(prevReferences => (
          data.references.length === 0 && prevReferences.length > 0 ? prevReferences : data.references
        ))
      }
    }
  }, [data])

  // Validation function for reference fields
  const validateReferenceField = (index, field, value) => {
    switch (field) {
      case 'name':
        return !value ? 'Name is required' : ''
      case 'position':
        return !value ? 'Position is required' : ''
      case 'company':
        return !value ? 'Company is required' : ''
      case 'address':
        return !value ? 'Address is required' : ''
      case 'relationship':
        return !value ? 'Relationship is required' : ''
      case 'phoneNumber':
        if (!value) return 'Phone number is required'
        // Basic phone validation (allows international formats)
        if (value.length < 8) return 'Please enter a valid phone number'
        return ''
      case 'email':
        if (!value) return 'Email is required'
        // Email validation
        {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) return 'Please enter a valid email address'
        }
        return ''
      case 'yearsKnown':
        if (!value) return 'Years known is required'
        {
          const years = parseInt(value, 10)
          if (years < 0) return 'Years known must be 0 or greater'
          if (years > 50) return 'Years known must be 50 or less'
        }
        return ''
      // Optional field - no validation
      case 'additionalNotes':
        return ''
      default:
        return ''
    }
  }

  const validateCurrentEmployerField = (field, value) => {
    switch (field) {
      case 'company':
        return !value ? 'Company is required' : ''
      case 'contactPerson':
        return !value ? 'Contact person is required' : ''
      case 'address':
        return !value ? 'Address is required' : ''
      case 'phoneNumber':
        if (!value) return 'Phone number is required'
        if (value.length < 8) return 'Please enter a valid phone number'
        return ''
      default:
        return ''
    }
  }

  const handleObjectionChange = (value) => {
    setObjectionToContactLastEmployer(value)
    setTouched(prev => ({ ...prev, objectionToContactLastEmployer: true }))
    setErrors(prev => ({
      ...prev,
      objectionToContactLastEmployer: value ? '' : 'Please select Yes or No',
    }))
    onUpdate({ section18: buildSection18Payload({ objectionToContactLastEmployer: value }) })
  }

  const handleCurrentEmployerChange = (field, value) => {
    const nextCurrentEmployer = {
      ...currentEmployer,
      [field]: value,
    }
    setCurrentEmployer(nextCurrentEmployer)
    const key = `currentEmployer-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    setErrors(prev => ({
      ...prev,
      [key]: validateCurrentEmployerField(field, value),
    }))
    onUpdate({ section18: buildSection18Payload({ currentEmployer: nextCurrentEmployer }) })
  }

  const handleCurrentEmployerBlur = (field) => {
    const key = `currentEmployer-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    setErrors(prev => ({
      ...prev,
      [key]: validateCurrentEmployerField(field, currentEmployer[field]),
    }))
  }

  const handleAddReference = () => {
    const newReferences = [...references, { ...emptyReference }]
    setReferences(newReferences)
    onUpdate({ section18: buildSection18Payload({ references: newReferences }) })
  }

  const handleRemoveReference = (index) => {
    const newReferences = references.filter((_, i) => i !== index)
    setReferences(newReferences)
    onUpdate({ section18: buildSection18Payload({ references: newReferences }) })
  }

  const handleReferenceChange = (index, field, value) => {
    const newReferences = [...references]
    newReferences[index] = {
      ...newReferences[index],
      [field]: value
    }
    setReferences(newReferences)
    
    // Mark field as touched
    const key = `reference-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateReferenceField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section18: buildSection18Payload({ references: newReferences }) })
  }

  const handleBlur = (index, field) => {
    const key = `reference-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = references[index]?.[field]
    const error = validateReferenceField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <p className="applicant-section-kicker">References</p>
        <h2 className="applicant-section-title">Professional references</h2>
        <p className="applicant-section-copy">
          Provide your current or immediate past employer details first, then add at least 2-3 professional references.
        </p>
      </div>

      <div className="applicant-record-card">
        <div className="applicant-record-card__header">
          <div>
            <h3 className="applicant-record-card__title">Employer Contact Permission</h3>
            <p className="applicant-record-card__subtitle">
              Let us know whether we may contact your last employer for reference checks.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <FormSelect
            label="Do you have any objection if we contact your last employer for reference?"
            name="objectionToContactLastEmployer"
            required
            value={objectionToContactLastEmployer}
            onChange={(e) => handleObjectionChange(e.target.value)}
            onBlur={() => {
              setTouched(prev => ({ ...prev, objectionToContactLastEmployer: true }))
              setErrors(prev => ({
                ...prev,
                objectionToContactLastEmployer: objectionToContactLastEmployer ? '' : 'Please select Yes or No',
              }))
            }}
            options={YES_NO_OPTIONS}
            error={touched.objectionToContactLastEmployer ? errors.objectionToContactLastEmployer : ''}
          />
        </div>
      </div>

      <div className="applicant-record-card">
        <div className="applicant-record-card__header">
          <div>
            <h3 className="applicant-record-card__title">
              Current or Immediate Past Employer
            </h3>
            <p className="applicant-record-card__subtitle">
              Please provide the name and address of your current or immediate past employer.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <FormInput
            label="Name of Company"
            name="currentEmployer-company"
            required
            value={currentEmployer.company}
            onChange={(e) => handleCurrentEmployerChange('company', e.target.value)}
            onBlur={() => handleCurrentEmployerBlur('company')}
            placeholder="e.g., Anglo-Eastern, Maersk"
            error={touched['currentEmployer-company'] ? errors['currentEmployer-company'] : ''}
          />

          <FormInput
            label="Contact Person"
            name="currentEmployer-contactPerson"
            required
            value={currentEmployer.contactPerson}
            onChange={(e) => handleCurrentEmployerChange('contactPerson', e.target.value)}
            onBlur={() => handleCurrentEmployerBlur('contactPerson')}
            placeholder="e.g., Crewing Manager"
            error={touched['currentEmployer-contactPerson'] ? errors['currentEmployer-contactPerson'] : ''}
          />

          <div>
            <label className="applicant-field__label">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="currentEmployer-address"
              value={currentEmployer.address}
              onChange={(e) => handleCurrentEmployerChange('address', e.target.value)}
              onBlur={() => handleCurrentEmployerBlur('address')}
              rows={3}
              className="applicant-field__input"
              placeholder="Complete employer address"
            />
            {touched['currentEmployer-address'] && errors['currentEmployer-address'] && (
              <p className="applicant-field__error">{errors['currentEmployer-address']}</p>
            )}
          </div>

          <FormInput
            label="Tel Number"
            name="currentEmployer-phoneNumber"
            required
            type="tel"
            value={currentEmployer.phoneNumber}
            onChange={(e) => handleCurrentEmployerChange('phoneNumber', e.target.value)}
            onBlur={() => handleCurrentEmployerBlur('phoneNumber')}
            placeholder="e.g., +65 6123 4567"
            error={touched['currentEmployer-phoneNumber'] ? errors['currentEmployer-phoneNumber'] : ''}
          />
        </div>
      </div>

      {/* References List */}
      <div className="space-y-6">
        {references.length === 0 ? (
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-gray-600 mb-2">No professional references added yet</p>
            <p className="text-sm text-gray-500 mb-4">Add references from former supervisors or colleagues</p>
            <button
              onClick={handleAddReference}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add Professional Reference
            </button>
          </div>
        ) : (
          <>
            {references.map((reference, index) => (
              <div key={index} className="applicant-record-card">
                {/* Reference Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">
                    Reference {index + 1}
                    {reference.name && ` - ${reference.name}`}
                    </h3>
                    <p className="applicant-record-card__subtitle">
                      Choose supervisors or senior colleagues who can speak directly to your maritime performance.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveReference(index)}
                    className="applicant-action applicant-action--secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Reference Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Full Name"
                      name={`reference-${index}-name`}
                      required
                      value={reference.name}
                      onChange={(e) => handleReferenceChange(index, 'name', e.target.value)}
                      onBlur={() => handleBlur(index, 'name')}
                      placeholder="e.g., Captain John Smith"
                      error={touched[`reference-${index}-name`] ? errors[`reference-${index}-name`] : ''}
                    />

                    <FormInput
                      label="Current Position"
                      name={`reference-${index}-position`}
                      required
                      value={reference.position}
                      onChange={(e) => handleReferenceChange(index, 'position', e.target.value)}
                      onBlur={() => handleBlur(index, 'position')}
                      placeholder="e.g., Fleet Manager, Master Mariner"
                      error={touched[`reference-${index}-position`] ? errors[`reference-${index}-position`] : ''}
                    />
                  </div>

                  <FormInput
                    label="Company / Organization"
                    name={`reference-${index}-company`}
                    required
                    value={reference.company}
                    onChange={(e) => handleReferenceChange(index, 'company', e.target.value)}
                    onBlur={() => handleBlur(index, 'company')}
                    placeholder="e.g., Maersk, V.Ships, Anglo-Eastern"
                    error={touched[`reference-${index}-company`] ? errors[`reference-${index}-company`] : ''}
                  />

                  <div>
                    <label className="applicant-field__label">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name={`reference-${index}-address`}
                      value={reference.address}
                      onChange={(e) => handleReferenceChange(index, 'address', e.target.value)}
                      onBlur={() => handleBlur(index, 'address')}
                      rows={3}
                      className="applicant-field__input"
                      placeholder="Complete reference address"
                    />
                    {touched[`reference-${index}-address`] && errors[`reference-${index}-address`] && (
                      <p className="applicant-field__error">{errors[`reference-${index}-address`]}</p>
                    )}
                  </div>

                  <FormSelect
                    label="Relationship to You"
                    name={`reference-${index}-relationship`}
                    required
                    value={reference.relationship}
                    onChange={(e) => handleReferenceChange(index, 'relationship', e.target.value)}
                    onBlur={() => handleBlur(index, 'relationship')}
                    options={RELATIONSHIP_OPTIONS}
                    helpText="How do you know this person?"
                    error={touched[`reference-${index}-relationship`] ? errors[`reference-${index}-relationship`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="Phone Number"
                      name={`reference-${index}-phoneNumber`}
                      required
                      type="tel"
                      value={reference.phoneNumber}
                      onChange={(e) => handleReferenceChange(index, 'phoneNumber', e.target.value)}
                      onBlur={() => handleBlur(index, 'phoneNumber')}
                      placeholder="e.g., +1 234 567 8900"
                      helpText="Include country code"
                      error={touched[`reference-${index}-phoneNumber`] ? errors[`reference-${index}-phoneNumber`] : ''}
                    />

                    <FormInput
                      label="Email Address"
                      name={`reference-${index}-email`}
                      required
                      type="email"
                      value={reference.email}
                      onChange={(e) => handleReferenceChange(index, 'email', e.target.value)}
                      onBlur={() => handleBlur(index, 'email')}
                      placeholder="e.g., john.smith@company.com"
                      error={touched[`reference-${index}-email`] ? errors[`reference-${index}-email`] : ''}
                    />
                  </div>

                  <FormInput
                    label="Years Known"
                    name={`reference-${index}-yearsKnown`}
                    required
                    type="number"
                    min="0"
                    max="50"
                    value={reference.yearsKnown}
                    onChange={(e) => handleReferenceChange(index, 'yearsKnown', e.target.value)}
                    onBlur={() => handleBlur(index, 'yearsKnown')}
                    placeholder="e.g., 5"
                    helpText="How many years have you known this person?"
                    error={touched[`reference-${index}-yearsKnown`] ? errors[`reference-${index}-yearsKnown`] : ''}
                  />

                  <div>
                    <label className="applicant-field__label">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      name={`reference-${index}-additionalNotes`}
                      value={reference.additionalNotes}
                      onChange={(e) => handleReferenceChange(index, 'additionalNotes', e.target.value)}
                      rows={2}
                      className="applicant-field__input"
                      placeholder="Any additional context about your working relationship..."
                    />
                    <p className="applicant-field__help">
                      e.g., Worked together on MV Atlantic Explorer, Reported directly to this person
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddReference}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-slate-300"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Reference</span>
            </button>
          </>
        )}
      </div>

      {/* Info Boxes */}
      <div className="space-y-4">
        {/* Best Practices */}
        <div className="applicant-section-card applicant-section-card--muted">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">
                Best Practices for References
              </h3>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                <li>Provide at least 2-3 professional references (more is better)</li>
                <li>Choose people who supervised your work directly</li>
                <li>Recent references are more valuable (from last 5 years)</li>
                <li>Always ask permission before listing someone as a reference</li>
                <li>Ensure contact details are current and accurate</li>
              </ul>
            </div>
          </div>
        </div>

        {/* General Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Important Information
              </h3>
              <p className="text-sm text-blue-800">
                Professional references play a crucial role in the hiring process. Employers will contact these individuals to verify your work history, performance, and character. Choose references who can speak positively about your technical skills, work ethic, safety awareness, and ability to work in a team. Former captains, chief engineers, and fleet managers make excellent references.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-1">
                Privacy & Confidentiality
              </h3>
              <p className="text-sm text-green-800">
                Reference information will be kept confidential and used solely for employment verification purposes. We will only contact your references after receiving your explicit consent and typically during the final stages of the recruitment process.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
