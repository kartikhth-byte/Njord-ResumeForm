/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const emptyEducation = {
  institution: '',
  from: '',
  to: '',
  qualification: '',
}

export default function Section6({ data = {}, onUpdate }) {
  const [education, setEducation] = useState(data.education || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.education) {
      setEducation(data.education)
    }
  }, [data])

  // Validation function for individual education fields
  const validateEducationField = (index, field, value) => {
    const key = `education-${index}-${field}`
    
    switch (field) {
      case 'institution':
        return !value ? 'Institution name is required' : ''
      case 'from':
        return !value ? 'Start date is required' : ''
      case 'to':
        if (!value) return 'End date is required'
        if (education[index]?.from && value <= education[index].from) {
          return 'End date must be after start date'
        }
        return ''
      case 'qualification':
        return !value ? 'Qualification is required' : ''
      default:
        return ''
    }
  }

  const handleAddEducation = () => {
    const newEducation = [...education, { ...emptyEducation }]
    setEducation(newEducation)
    onUpdate({ section6: { education: newEducation } })
  }

  const handleRemoveEducation = (index) => {
    const newEducation = education.filter((_, i) => i !== index)
    setEducation(newEducation)
    onUpdate({ section6: { education: newEducation } })
  }

  const handleEducationChange = (index, field, value) => {
    const newEducation = [...education]
    newEducation[index] = {
      ...newEducation[index],
      [field]: value
    }
    setEducation(newEducation)
    
    // Mark field as touched
    const key = `education-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateEducationField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section6: { education: newEducation } })
  }

  const handleBlur = (index, field) => {
    const key = `education-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate on blur
    const value = education[index]?.[field]
    const error = validateEducationField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 6: Education Background</h2>
        <p className="text-gray-600 mt-1">
          List your educational qualifications and training institutions
        </p>
      </div>

      {/* Education List */}
      <div className="space-y-6">
        {education.length === 0 ? (
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
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <p className="text-gray-600 mb-4">No education records added yet</p>
            <button
              onClick={handleAddEducation}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Education Record
            </button>
          </div>
        ) : (
          <>
            {education.map((edu, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Education Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Education {index + 1}
                  </h3>
                  <button
                    onClick={() => handleRemoveEducation(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Education Fields */}
                <div className="space-y-4">
                  <FormInput
                    label="School / College / Institution"
                    name={`education-${index}-institution`}
                    required
                    value={edu.institution}
                    onChange={(e) => handleEducationChange(index, 'institution', e.target.value)}
                    onBlur={() => handleBlur(index, 'institution')}
                    placeholder="e.g., Maritime Academy, University Name"
                    error={touched[`education-${index}-institution`] ? errors[`education-${index}-institution`] : ''}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormDatePicker
                      label="From"
                      name={`education-${index}-from`}
                      required
                      value={edu.from}
                      onChange={(e) => handleEducationChange(index, 'from', e.target.value)}
                      onBlur={() => handleBlur(index, 'from')}
                      max={new Date().toISOString().split('T')[0]}
                      helpText="Start date"
                      error={touched[`education-${index}-from`] ? errors[`education-${index}-from`] : ''}
                    />

                    <FormDatePicker
                      label="To"
                      name={`education-${index}-to`}
                      required
                      value={edu.to}
                      onChange={(e) => handleEducationChange(index, 'to', e.target.value)}
                      onBlur={() => handleBlur(index, 'to')}
                      min={edu.from}
                      max={new Date().toISOString().split('T')[0]}
                      helpText="End date"
                      error={touched[`education-${index}-to`] ? errors[`education-${index}-to`] : ''}
                    />
                  </div>

                  <FormInput
                    label="Highest Qualification Attained"
                    name={`education-${index}-qualification`}
                    required
                    value={edu.qualification}
                    onChange={(e) => handleEducationChange(index, 'qualification', e.target.value)}
                    onBlur={() => handleBlur(index, 'qualification')}
                    placeholder="e.g., Bachelor of Science in Marine Engineering, Diploma in Nautical Science"
                    helpText="Degree, diploma, or certificate obtained"
                    error={touched[`education-${index}-qualification`] ? errors[`education-${index}-qualification`] : ''}
                  />
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddEducation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Education Record</span>
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
              🎓 Tip
            </h3>
            <p className="text-sm text-blue-800">
              Include all relevant maritime education and training, starting with the most recent. Include maritime academies, universities, and any specialized maritime training institutions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
