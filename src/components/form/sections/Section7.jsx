import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' },
]

const emptyDependent = {
  name: '',
  dateOfBirth: '',
  age: '',
  gender: '',
  relationship: '',
}

export default function Section7({ data = {}, onUpdate }) {
  const [dependents, setDependents] = useState(data.dependents || [])

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Array.isArray(data.dependents)) {
      setDependents(prevDependents => (
        data.dependents.length === 0 && prevDependents.length > 0 ? prevDependents : data.dependents
      ))
    }
  }, [data])

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return ''
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age.toString()
  }

  const handleAddDependent = () => {
    const newDependents = [...dependents, { ...emptyDependent }]
    setDependents(newDependents)
    onUpdate({ section7: { dependents: newDependents } })
  }

  const handleRemoveDependent = (index) => {
    const newDependents = dependents.filter((_, i) => i !== index)
    setDependents(newDependents)
    onUpdate({ section7: { dependents: newDependents } })
  }

  const handleDependentChange = (index, field, value) => {
    const newDependents = [...dependents]
    newDependents[index] = {
      ...newDependents[index],
      [field]: value
    }

    // Auto-calculate age when date of birth changes
    if (field === 'dateOfBirth') {
      newDependents[index].age = calculateAge(value)
    }

    setDependents(newDependents)
    onUpdate({ section7: { dependents: newDependents } })
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <p className="applicant-section-kicker">Family information</p>
        <h2 className="applicant-section-title">Dependents</h2>
        <p className="applicant-section-copy">
          List all your dependents (spouse, children, parents, etc.)
        </p>
      </div>

      {/* Dependents List */}
      <div className="space-y-6">
        {dependents.length === 0 ? (
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
            <p className="text-gray-600 mb-4">No dependents added</p>
            <button
              onClick={handleAddDependent}
              className="applicant-action applicant-action--primary"
            >
              <Plus className="w-4 h-4" />
              Add Dependent
            </button>
          </div>
        ) : (
          <>
            {dependents.map((dependent, index) => (
              <div key={index} className="applicant-record-card">
                {/* Dependent Header */}
                <div className="applicant-record-card__header">
                  <div>
                    <h3 className="applicant-record-card__title">Dependent {index + 1}</h3>
                    <p className="applicant-record-card__subtitle">
                      Include the relationship and basic identifying details for each dependent.
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveDependent(index)}
                    className="applicant-action applicant-action--secondary"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Dependent Fields */}
                <div className="space-y-4">
                  <FormInput
                    label="Name"
                    name={`dependent-${index}-name`}
                    required
                    value={dependent.name}
                    onChange={(e) => handleDependentChange(index, 'name', e.target.value)}
                    placeholder="Full name"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormDatePicker
                      label="Date of Birth"
                      name={`dependent-${index}-dateOfBirth`}
                      required
                      value={dependent.dateOfBirth}
                      onChange={(e) => handleDependentChange(index, 'dateOfBirth', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />

                    <FormInput
                      label="Age"
                      name={`dependent-${index}-age`}
                      value={dependent.age}
                      disabled
                      placeholder="Auto-calculated"
                      helpText="Auto-calculated"
                    />

                    <FormSelect
                      label="Gender"
                      name={`dependent-${index}-gender`}
                      required
                      value={dependent.gender}
                      onChange={(e) => handleDependentChange(index, 'gender', e.target.value)}
                      options={GENDER_OPTIONS}
                    />
                  </div>

                  <FormSelect
                    label="Relationship"
                    name={`dependent-${index}-relationship`}
                    required
                    value={dependent.relationship}
                    onChange={(e) => handleDependentChange(index, 'relationship', e.target.value)}
                    options={RELATIONSHIP_OPTIONS}
                  />
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddDependent}
              className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-slate-300"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Dependent</span>
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
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Note</h3>
            <p className="text-sm text-blue-800">
              This information is used for emergency contacts and benefits purposes. Please include all immediate family members who depend on you financially.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
