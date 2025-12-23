import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2 } from 'lucide-react'

const MEDICAL_TYPE_OPTIONS = [
  { value: 'PEME', label: 'PEME (Pre-Employment Medical Examination)' },
  { value: 'ENG1', label: 'ENG1 (UK)' },
  { value: 'Medical Certificate', label: 'Medical Certificate' },
  { value: 'Other', label: 'Other' },
]

const emptyMedical = {
  type: '',
  dateOfIssue: '',
  dateOfExpiry: '',
}

export default function Section10({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    medicalFitness: data.medicalFitness || [],
    vaccinations: {
      yellowFever: {
        received: data.vaccinations?.yellowFever?.received || false,
        dateOfIssue: data.vaccinations?.yellowFever?.dateOfIssue || '',
        dateOfExpiry: data.vaccinations?.yellowFever?.dateOfExpiry || '',
      },
      covidVaccinated: data.vaccinations?.covidVaccinated || false,
      covidDoses: data.vaccinations?.covidDoses || '',
      covidLastDoseDate: data.vaccinations?.covidLastDoseDate || '',
      hepatitisA: data.vaccinations?.hepatitisA || false,
      hepatitisADate: data.vaccinations?.hepatitisADate || '',
      hepatitisB: data.vaccinations?.hepatitisB || false,
      hepatitisBDate: data.vaccinations?.hepatitisBDate || '',
      typhoid: data.vaccinations?.typhoid || false,
      typhoidDate: data.vaccinations?.typhoidDate || '',
      tetanus: data.vaccinations?.tetanus || false,
      tetanusDate: data.vaccinations?.tetanusDate || '',
      measles: data.vaccinations?.measles || false,
      measlesDate: data.vaccinations?.measlesDate || '',
      polio: data.vaccinations?.polio || false,
      polioDate: data.vaccinations?.polioDate || '',
      otherVaccinations: data.vaccinations?.otherVaccinations || '',
    }
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Helper function to validate year in date
  const validateYear = (dateString) => {
    if (!dateString) return null
    const year = dateString.split('-')[0]
    if (year.length !== 4) return 'Year must be 4 digits'
    const yearNum = parseInt(year, 10)
    if (yearNum < 1900 || yearNum > 2100) return 'Year must be between 1900 and 2100'
    return null
  }

  // Validation function for medical certificates
  const validateMedicalField = (index, field, value) => {
    const key = `medical-${index}-${field}`
    
    switch (field) {
      case 'type':
        return !value ? 'Certificate type is required' : ''
      case 'dateOfIssue':
        if (!value) return 'Date of issue is required'
        const issueYearError = validateYear(value)
        if (issueYearError) return issueYearError
        return ''
      case 'dateOfExpiry':
        if (!value) return 'Date of expiry is required'
        const expiryYearError = validateYear(value)
        if (expiryYearError) return expiryYearError
        if (formData.medicalFitness[index]?.dateOfIssue && value <= formData.medicalFitness[index].dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
        return ''
      default:
        return ''
    }
  }

  // Validation function for vaccination fields
  const validateVaccinationField = (field, value) => {
    const key = `vaccination-${field}`
    
    // Yellow Fever validation
    if (field === 'yellowFever-dateOfIssue') {
      if (formData.vaccinations.yellowFever.received && !value) {
        return 'Date of issue is required when Yellow Fever is checked'
      }
      if (value) {
        const yearError = validateYear(value)
        if (yearError) return yearError
      }
      return ''
    }
    
    if (field === 'yellowFever-dateOfExpiry') {
      if (formData.vaccinations.yellowFever.received && !value) {
        return 'Date of expiry is required when Yellow Fever is checked'
      }
      if (value) {
        const yearError = validateYear(value)
        if (yearError) return yearError
        if (formData.vaccinations.yellowFever.dateOfIssue && value <= formData.vaccinations.yellowFever.dateOfIssue) {
          return 'Expiry date must be after issue date'
        }
      }
      return ''
    }
    
    // COVID validation
    if (field === 'covidDoses') {
      if (formData.vaccinations.covidVaccinated && !value) {
        return 'Number of doses is required when COVID-19 is checked'
      }
      if (value && (parseInt(value) < 1 || parseInt(value) > 5)) {
        return 'Doses must be between 1 and 5'
      }
      return ''
    }
    
    if (field === 'covidLastDoseDate') {
      if (formData.vaccinations.covidVaccinated && !value) {
        return 'Last dose date is required when COVID-19 is checked'
      }
      if (value) {
        const yearError = validateYear(value)
        if (yearError) return yearError
      }
      return ''
    }
    
    return ''
  }

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        medicalFitness: data.medicalFitness || [],
        vaccinations: {
          yellowFever: {
            received: data.vaccinations?.yellowFever?.received || false,
            dateOfIssue: data.vaccinations?.yellowFever?.dateOfIssue || '',
            dateOfExpiry: data.vaccinations?.yellowFever?.dateOfExpiry || '',
          },
          covidVaccinated: data.vaccinations?.covidVaccinated || false,
          covidDoses: data.vaccinations?.covidDoses || '',
          covidLastDoseDate: data.vaccinations?.covidLastDoseDate || '',
          hepatitisA: data.vaccinations?.hepatitisA || false,
          hepatitisADate: data.vaccinations?.hepatitisADate || '',
          hepatitisB: data.vaccinations?.hepatitisB || false,
          hepatitisBDate: data.vaccinations?.hepatitisBDate || '',
          typhoid: data.vaccinations?.typhoid || false,
          typhoidDate: data.vaccinations?.typhoidDate || '',
          tetanus: data.vaccinations?.tetanus || false,
          tetanusDate: data.vaccinations?.tetanusDate || '',
          measles: data.vaccinations?.measles || false,
          measlesDate: data.vaccinations?.measlesDate || '',
          polio: data.vaccinations?.polio || false,
          polioDate: data.vaccinations?.polioDate || '',
          otherVaccinations: data.vaccinations?.otherVaccinations || '',
        }
      })
    }
  }, [data])

  const handleAddMedical = () => {
    const newMedicalFitness = [...formData.medicalFitness, { ...emptyMedical }]
    const newFormData = { ...formData, medicalFitness: newMedicalFitness }
    setFormData(newFormData)
    onUpdate({ section10: newFormData })
  }

  const handleRemoveMedical = (index) => {
    const newMedicalFitness = formData.medicalFitness.filter((_, i) => i !== index)
    const newFormData = { ...formData, medicalFitness: newMedicalFitness }
    setFormData(newFormData)
    onUpdate({ section10: newFormData })
  }

  const handleMedicalChange = (index, field, value) => {
    const newMedicalFitness = [...formData.medicalFitness]
    newMedicalFitness[index] = {
      ...newMedicalFitness[index],
      [field]: value
    }
    const newFormData = { ...formData, medicalFitness: newMedicalFitness }
    setFormData(newFormData)
    
    // Mark field as touched
    const key = `medical-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate field
    const error = validateMedicalField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
    
    onUpdate({ section10: newFormData })
  }

  const handleMedicalBlur = (index, field) => {
    const key = `medical-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = formData.medicalFitness[index]?.[field]
    const error = validateMedicalField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  const handleVaccinationChange = (field, value) => {
    const newFormData = {
      ...formData,
      vaccinations: {
        ...formData.vaccinations,
        [field]: value
      }
    }
    setFormData(newFormData)
    
    // Mark field as touched
    const key = `vaccination-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Handle COVID checkbox validation
    if (field === 'covidVaccinated' && value) {
      // If checkbox is checked, validate COVID fields
      const dosesError = validateVaccinationField('covidDoses', formData.vaccinations.covidDoses)
      const dateError = validateVaccinationField('covidLastDoseDate', formData.vaccinations.covidLastDoseDate)
      setErrors(prev => ({
        ...prev,
        'vaccination-covidDoses': dosesError,
        'vaccination-covidLastDoseDate': dateError
      }))
    } else if (field === 'covidVaccinated' && !value) {
      // If checkbox is unchecked, clear errors
      setErrors(prev => ({
        ...prev,
        'vaccination-covidDoses': '',
        'vaccination-covidLastDoseDate': ''
      }))
    } else {
      // Validate individual COVID fields
      const error = validateVaccinationField(field, value)
      setErrors(prev => ({ ...prev, [key]: error }))
    }
    
    onUpdate({ section10: newFormData })
  }

  const handleVaccinationBlur = (field) => {
    const key = `vaccination-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = formData.vaccinations[field]
    const error = validateVaccinationField(field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  const handleYellowFeverChange = (field, value) => {
    const newFormData = {
      ...formData,
      vaccinations: {
        ...formData.vaccinations,
        yellowFever: {
          ...formData.vaccinations.yellowFever,
          [field]: value
        }
      }
    }
    setFormData(newFormData)
    
    // Mark field as touched
    const key = `vaccination-yellowFever-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    // Validate yellow fever dates if checkbox is checked
    if (field === 'received' && value) {
      // If checkbox is checked, validate dates
      const issueError = validateVaccinationField('yellowFever-dateOfIssue', formData.vaccinations.yellowFever.dateOfIssue)
      const expiryError = validateVaccinationField('yellowFever-dateOfExpiry', formData.vaccinations.yellowFever.dateOfExpiry)
      setErrors(prev => ({
        ...prev,
        'vaccination-yellowFever-dateOfIssue': issueError,
        'vaccination-yellowFever-dateOfExpiry': expiryError
      }))
    } else if (field === 'received' && !value) {
      // If checkbox is unchecked, clear errors
      setErrors(prev => ({
        ...prev,
        'vaccination-yellowFever-dateOfIssue': '',
        'vaccination-yellowFever-dateOfExpiry': ''
      }))
    } else {
      // Validate individual date fields
      const error = validateVaccinationField(`yellowFever-${field}`, value)
      setErrors(prev => ({ ...prev, [key]: error }))
    }
    
    onUpdate({ section10: newFormData })
  }

  const handleYellowFeverBlur = (field) => {
    const key = `vaccination-yellowFever-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = formData.vaccinations.yellowFever[field]
    const error = validateVaccinationField(`yellowFever-${field}`, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 10: Medical Fitness & Vaccination</h2>
        <p className="text-gray-600 mt-1">
          Provide your medical fitness certificates and vaccination records
        </p>
      </div>

      {/* Medical Fitness Section */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Medical Fitness Certificates</h3>

        <div className="space-y-6">
          {formData.medicalFitness.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-600 mb-4">No medical certificates added yet</p>
              <button
                onClick={handleAddMedical}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Medical Certificate
              </button>
            </div>
          ) : (
            <>
              {formData.medicalFitness.map((medical, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-gray-900">
                      Medical Certificate {index + 1}
                    </h4>
                    <button
                      onClick={() => handleRemoveMedical(index)}
                      className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Remove</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <FormSelect
                      label="Certificate Type"
                      name={`medical-${index}-type`}
                      required
                      value={medical.type}
                      onChange={(e) => handleMedicalChange(index, 'type', e.target.value)}
                      onBlur={() => handleMedicalBlur(index, 'type')}
                      options={MEDICAL_TYPE_OPTIONS}
                      error={touched[`medical-${index}-type`] ? errors[`medical-${index}-type`] : ''}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormDatePicker
                        label="Date of Issue"
                        name={`medical-${index}-dateOfIssue`}
                        required
                        value={medical.dateOfIssue}
                        onChange={(e) => handleMedicalChange(index, 'dateOfIssue', e.target.value)}
                        onBlur={() => handleMedicalBlur(index, 'dateOfIssue')}
                        max={new Date().toISOString().split('T')[0]}
                        error={touched[`medical-${index}-dateOfIssue`] ? errors[`medical-${index}-dateOfIssue`] : ''}
                      />

                      <FormDatePicker
                        label="Date of Expiry"
                        name={`medical-${index}-dateOfExpiry`}
                        required
                        value={medical.dateOfExpiry}
                        onChange={(e) => handleMedicalChange(index, 'dateOfExpiry', e.target.value)}
                        onBlur={() => handleMedicalBlur(index, 'dateOfExpiry')}
                        min={medical.dateOfIssue || new Date().toISOString().split('T')[0]}
                        error={touched[`medical-${index}-dateOfExpiry`] ? errors[`medical-${index}-dateOfExpiry`] : ''}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={handleAddMedical}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Add Another Medical Certificate</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Vaccination Records */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Vaccination Records</h3>

        {/* Yellow Fever */}
        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="yellowFever"
              checked={formData.vaccinations.yellowFever.received}
              onChange={(e) => handleYellowFeverChange('received', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="yellowFever" className="ml-3 block text-sm font-medium text-gray-700">
              Yellow Fever Vaccination
            </label>
          </div>

          {formData.vaccinations.yellowFever.received && (
            <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormDatePicker
                label="Date of Issue"
                name="yellowFever-dateOfIssue"
                required
                value={formData.vaccinations.yellowFever.dateOfIssue}
                onChange={(e) => handleYellowFeverChange('dateOfIssue', e.target.value)}
                onBlur={() => handleYellowFeverBlur('dateOfIssue')}
                max={new Date().toISOString().split('T')[0]}
                error={touched['vaccination-yellowFever-dateOfIssue'] ? errors['vaccination-yellowFever-dateOfIssue'] : ''}
              />

              <FormDatePicker
                label="Date of Expiry"
                name="yellowFever-dateOfExpiry"
                required
                value={formData.vaccinations.yellowFever.dateOfExpiry}
                onChange={(e) => handleYellowFeverChange('dateOfExpiry', e.target.value)}
                onBlur={() => handleYellowFeverBlur('dateOfExpiry')}
                min={formData.vaccinations.yellowFever.dateOfIssue}
                helpText="Usually valid for life"
                error={touched['vaccination-yellowFever-dateOfExpiry'] ? errors['vaccination-yellowFever-dateOfExpiry'] : ''}
              />
            </div>
          )}
        </div>

        {/* COVID-19 */}
        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="covidVaccinated"
              checked={formData.vaccinations.covidVaccinated}
              onChange={(e) => handleVaccinationChange('covidVaccinated', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="covidVaccinated" className="ml-3 block text-sm font-medium text-gray-700">
              COVID-19 Vaccination
            </label>
          </div>

          {formData.vaccinations.covidVaccinated && (
            <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Number of Doses"
                name="covidDoses"
                type="number"
                min="1"
                max="5"
                required
                value={formData.vaccinations.covidDoses}
                onChange={(e) => handleVaccinationChange('covidDoses', e.target.value)}
                onBlur={() => handleVaccinationBlur('covidDoses')}
                placeholder="e.g., 2"
                error={touched['vaccination-covidDoses'] ? errors['vaccination-covidDoses'] : ''}
              />

              <FormDatePicker
                label="Last Dose Date"
                name="covidLastDoseDate"
                required
                value={formData.vaccinations.covidLastDoseDate}
                onChange={(e) => handleVaccinationChange('covidLastDoseDate', e.target.value)}
                onBlur={() => handleVaccinationBlur('covidLastDoseDate')}
                max={new Date().toISOString().split('T')[0]}
                error={touched['vaccination-covidLastDoseDate'] ? errors['vaccination-covidLastDoseDate'] : ''}
              />
            </div>
          )}
        </div>

        {/* Other Vaccinations - Simplified Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hepatitis A */}
          <div className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="hepatitisA"
                checked={formData.vaccinations.hepatitisA}
                onChange={(e) => handleVaccinationChange('hepatitisA', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hepatitisA" className="ml-3 block text-sm font-medium text-gray-700">
                Hepatitis A
              </label>
            </div>
            {formData.vaccinations.hepatitisA && (
              <div className="ml-7">
                <FormDatePicker
                  label="Date"
                  name="hepatitisADate"
                  value={formData.vaccinations.hepatitisADate}
                  onChange={(e) => handleVaccinationChange('hepatitisADate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Hepatitis B */}
          <div className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="hepatitisB"
                checked={formData.vaccinations.hepatitisB}
                onChange={(e) => handleVaccinationChange('hepatitisB', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hepatitisB" className="ml-3 block text-sm font-medium text-gray-700">
                Hepatitis B
              </label>
            </div>
            {formData.vaccinations.hepatitisB && (
              <div className="ml-7">
                <FormDatePicker
                  label="Date"
                  name="hepatitisBDate"
                  value={formData.vaccinations.hepatitisBDate}
                  onChange={(e) => handleVaccinationChange('hepatitisBDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Typhoid */}
          <div className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="typhoid"
                checked={formData.vaccinations.typhoid}
                onChange={(e) => handleVaccinationChange('typhoid', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="typhoid" className="ml-3 block text-sm font-medium text-gray-700">
                Typhoid
              </label>
            </div>
            {formData.vaccinations.typhoid && (
              <div className="ml-7">
                <FormDatePicker
                  label="Date"
                  name="typhoidDate"
                  value={formData.vaccinations.typhoidDate}
                  onChange={(e) => handleVaccinationChange('typhoidDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Tetanus */}
          <div className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="tetanus"
                checked={formData.vaccinations.tetanus}
                onChange={(e) => handleVaccinationChange('tetanus', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="tetanus" className="ml-3 block text-sm font-medium text-gray-700">
                Tetanus
              </label>
            </div>
            {formData.vaccinations.tetanus && (
              <div className="ml-7">
                <FormDatePicker
                  label="Date"
                  name="tetanusDate"
                  value={formData.vaccinations.tetanusDate}
                  onChange={(e) => handleVaccinationChange('tetanusDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Measles */}
          <div className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="measles"
                checked={formData.vaccinations.measles}
                onChange={(e) => handleVaccinationChange('measles', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="measles" className="ml-3 block text-sm font-medium text-gray-700">
                Measles
              </label>
            </div>
            {formData.vaccinations.measles && (
              <div className="ml-7">
                <FormDatePicker
                  label="Date"
                  name="measlesDate"
                  value={formData.vaccinations.measlesDate}
                  onChange={(e) => handleVaccinationChange('measlesDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Polio */}
          <div className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="polio"
                checked={formData.vaccinations.polio}
                onChange={(e) => handleVaccinationChange('polio', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="polio" className="ml-3 block text-sm font-medium text-gray-700">
                Polio
              </label>
            </div>
            {formData.vaccinations.polio && (
              <div className="ml-7">
                <FormDatePicker
                  label="Date"
                  name="polioDate"
                  value={formData.vaccinations.polioDate}
                  onChange={(e) => handleVaccinationChange('polioDate', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>
        </div>

        {/* Other Vaccinations */}
        <FormInput
          label="Other Vaccinations"
          name="otherVaccinations"
          value={formData.vaccinations.otherVaccinations}
          onChange={(e) => handleVaccinationChange('otherVaccinations', e.target.value)}
          placeholder="List any other vaccinations (optional)"
          helpText="e.g., Influenza, Meningococcal, etc."
        />
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
              💉 Important
            </h3>
            <p className="text-sm text-blue-800">
              Ensure your medical certificate is valid and up-to-date. Yellow Fever vaccination is mandatory for traveling to certain countries. Keep your vaccination records current for smooth embarkation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}