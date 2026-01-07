import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

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
            <div className="ml-7 space-y-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              {/* NEW: Lifetime Validity Checkbox */}
              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="yellowFeverLifetime"
                  checked={formData.vaccinations.yellowFever.lifetimeValidity}
                  onChange={(e) => handleYellowFeverChange('lifetimeValidity', e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="yellowFeverLifetime" className="ml-3 block text-sm font-medium text-gray-700">
                  This certificate has lifetime validity (no expiry date)
                </label>
              </div>

              {/* NEW: Information Alert */}
              {formData.vaccinations.yellowFever.lifetimeValidity && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Certificates with lifetime validity will not trigger expiry warnings.
                  </p>
                </div>
              )}

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

        {/* Hepatitis A */}
        <div className="space-y-3">
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
                label="Date of Vaccination"
                name="hepatitisADate"
                value={formData.vaccinations.hepatitisADate}
                onChange={(e) => handleVaccinationChange('hepatitisADate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Hepatitis B */}
        <div className="space-y-3">
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
                label="Date of Vaccination"
                name="hepatitisBDate"
                value={formData.vaccinations.hepatitisBDate}
                onChange={(e) => handleVaccinationChange('hepatitisBDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Typhoid */}
        <div className="space-y-3">
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
                label="Date of Vaccination"
                name="typhoidDate"
                value={formData.vaccinations.typhoidDate}
                onChange={(e) => handleVaccinationChange('typhoidDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Tetanus */}
        <div className="space-y-3">
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
                label="Date of Vaccination"
                name="tetanusDate"
                value={formData.vaccinations.tetanusDate}
                onChange={(e) => handleVaccinationChange('tetanusDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Measles */}
        <div className="space-y-3">
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
                label="Date of Vaccination"
                name="measlesDate"
                value={formData.vaccinations.measlesDate}
                onChange={(e) => handleVaccinationChange('measlesDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Polio */}
        <div className="space-y-3">
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
                label="Date of Vaccination"
                name="polioDate"
                value={formData.vaccinations.polioDate}
                onChange={(e) => handleVaccinationChange('polioDate', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}
        </div>

        {/* Other Vaccinations */}
        <div className="space-y-3">
          <FormInput
            label="Other Vaccinations (if any)"
            name="otherVaccinations"
            type="textarea"
            rows={3}
            value={formData.vaccinations.otherVaccinations}
            onChange={(e) => handleVaccinationChange('otherVaccinations', e.target.value)}
            placeholder="List any other vaccinations you have received"
          />
        </div>
      </div>

      {/* Information Alert */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Important Information</p>
          <p>
            Medical certificates and vaccinations are required for maritime employment. 
            Ensure all information is accurate and certificates are valid. You will receive 
            automatic expiry warnings at 90, 60, and 30 days before expiration.
          </p>
        </div>
      </div>
    </div>
  )
}