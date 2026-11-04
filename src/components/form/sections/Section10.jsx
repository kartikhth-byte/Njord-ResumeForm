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
        lifetimeValidity: data.vaccinations?.yellowFever?.lifetimeValidity || false, // NEW
      },
      covidVaccinated: data.vaccinations?.covidVaccinated || false,
      covidDoses: data.vaccinations?.covidDoses || '',
      covidLastDoseDate: data.vaccinations?.covidLastDoseDate || '',
      otherVaccinations: data.vaccinations?.otherVaccinations || '',
    }
  })

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
            lifetimeValidity: data.vaccinations?.yellowFever?.lifetimeValidity || false, // NEW
          },
          covidVaccinated: data.vaccinations?.covidVaccinated || false,
          covidDoses: data.vaccinations?.covidDoses || '',
          covidLastDoseDate: data.vaccinations?.covidLastDoseDate || '',
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
    onUpdate({ section10: newFormData })
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
    onUpdate({ section10: newFormData })
  }

  const handleYellowFeverChange = (field, value) => {
    let yellowFeverData = {
      ...formData.vaccinations.yellowFever,
      [field]: value
    }

    // If lifetime validity is checked, clear the expiry date
    if (field === 'lifetimeValidity' && value === true) {
      yellowFeverData.dateOfExpiry = ''
    }

    const newFormData = {
      ...formData,
      vaccinations: {
        ...formData.vaccinations,
        yellowFever: yellowFeverData
      }
    }
    setFormData(newFormData)
    onUpdate({ section10: newFormData })
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Medical fitness and vaccination</h2>
      </div>

      {/* Medical Fitness Section */}
      <div className="applicant-section-card space-y-5">
        <h3 className="text-lg font-semibold text-fg border-b pb-2">Medical Fitness Certificates</h3>

        <div className="space-y-6">
          {formData.medicalFitness.length === 0 ? (
            <div className="applicant-empty-state">
              <p className="text-fg-secondary mb-4">No medical certificates added yet</p>
              <button
                onClick={handleAddMedical}
                className="applicant-action applicant-action--primary"
              >
                <Plus className="w-4 h-4" />
                Add Medical Certificate
              </button>
            </div>
          ) : (
            <>
              {formData.medicalFitness.map((medical, index) => (
                <div key={index} className="applicant-record-card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="applicant-record-card__title">Medical Certificate {index + 1}</h4>
                    </div>
                    <button
                      onClick={() => handleRemoveMedical(index)}
                      className="applicant-action applicant-action--secondary"
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
                      options={MEDICAL_TYPE_OPTIONS}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormDatePicker
                        label="Date of Issue"
                        name={`medical-${index}-dateOfIssue`}
                        required
                        value={medical.dateOfIssue}
                        onChange={(e) => handleMedicalChange(index, 'dateOfIssue', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                      />

                      <FormDatePicker
                        label="Date of Expiry"
                        name={`medical-${index}-dateOfExpiry`}
                        required
                        value={medical.dateOfExpiry}
                        onChange={(e) => handleMedicalChange(index, 'dateOfExpiry', e.target.value)}
                        min={medical.dateOfIssue || new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={handleAddMedical}
                className="applicant-action applicant-action--secondary w-full justify-center border border-dashed border-line-input"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Add Another Medical Certificate</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Vaccination Records */}
      <div className="applicant-section-card space-y-5">
        <h3 className="text-lg font-semibold text-fg border-b pb-2">Vaccination Records</h3>

        {/* Yellow Fever */}
        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="yellowFever"
              checked={formData.vaccinations.yellowFever.received}
              onChange={(e) => handleYellowFeverChange('received', e.target.checked)}
              className="mt-1 h-4 w-4 text-accent-text focus:ring-accent border-line-input rounded"
            />
            <label htmlFor="yellowFever" className="ml-3 block text-sm font-medium text-fg-secondary">
              Yellow Fever Vaccination
            </label>
          </div>

          {formData.vaccinations.yellowFever.received && (
            <div className="ml-7 space-y-4 bg-warning-soft border border-warning-line rounded-lg p-4">
              {/* NEW: Lifetime Validity Checkbox */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="yellowFeverLifetime"
                  checked={formData.vaccinations.yellowFever.lifetimeValidity}
                  onChange={(e) => handleYellowFeverChange('lifetimeValidity', e.target.checked)}
                  className="mt-1 h-4 w-4 text-accent-text focus:ring-accent border-line-input rounded"
                />
                <label htmlFor="yellowFeverLifetime" className="ml-3 block text-sm font-medium text-fg-secondary">
                  This certificate has lifetime validity (no expiry date)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormDatePicker
                  label="Date of Issue"
                  name="yellowFever-dateOfIssue"
                  value={formData.vaccinations.yellowFever.dateOfIssue}
                  onChange={(e) => handleYellowFeverChange('dateOfIssue', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />

                <FormDatePicker
                  label={formData.vaccinations.yellowFever.lifetimeValidity ? "Date of Expiry (N/A)" : "Date of Expiry"}
                  name="yellowFever-dateOfExpiry"
                  value={formData.vaccinations.yellowFever.dateOfExpiry}
                  onChange={(e) => handleYellowFeverChange('dateOfExpiry', e.target.value)}
                  min={formData.vaccinations.yellowFever.dateOfIssue || new Date().toISOString().split('T')[0]}
                  disabled={formData.vaccinations.yellowFever.lifetimeValidity}
                  required={!formData.vaccinations.yellowFever.lifetimeValidity}
                />
              </div>
            </div>
          )}
        </div>

        {/* COVID-19 Vaccination */}
        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="covidVaccinated"
              checked={formData.vaccinations.covidVaccinated}
              onChange={(e) => handleVaccinationChange('covidVaccinated', e.target.checked)}
              className="mt-1 h-4 w-4 text-accent-text focus:ring-accent border-line-input rounded"
            />
            <label htmlFor="covidVaccinated" className="ml-3 block text-sm font-medium text-fg-secondary">
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
                max="10"
                value={formData.vaccinations.covidDoses}
                onChange={(e) => handleVaccinationChange('covidDoses', e.target.value)}
              />

              <FormDatePicker
                label="Last Dose Date"
                name="covidLastDoseDate"
                value={formData.vaccinations.covidLastDoseDate}
                onChange={(e) => handleVaccinationChange('covidLastDoseDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Other Vaccinations */}
        <div className="space-y-3">
          <FormInput
            label="Other vaccinations"
            name="otherVaccinations"
            type="textarea"
            rows={3}
            value={formData.vaccinations.otherVaccinations}
            onChange={(e) => handleVaccinationChange('otherVaccinations', e.target.value)}
            placeholder="e.g. Hepatitis B 2024, Typhoid 2023"
          />
        </div>
      </div>
    </div>
  )
}
