import { useState, useEffect } from 'react'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import FormInput from '../shared/FormInput'
import { RANK_OPTIONS } from '../../../utils/rankOptions'
import { VESSEL_TYPE_OPTIONS } from '../../../utils/vesselOptions'

export default function Section1({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    appliedForRank: data.appliedForRank || '',
    vesselType: data.vesselType || '',
    availableFrom: data.availableFrom || '',
    availableTill: data.availableTill || '',
    mediaAdvertisement: data.mediaAdvertisement || false,
    mediaAdvertisementDetails: data.mediaAdvertisementDetails || '',
    professionalRecommendation: data.professionalRecommendation || false,
    recommendedBy: data.recommendedBy || '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        appliedForRank: data.appliedForRank || '',
        vesselType: data.vesselType || '',
        availableFrom: data.availableFrom || '',
        availableTill: data.availableTill || '',
        mediaAdvertisement: data.mediaAdvertisement || false,
        mediaAdvertisementDetails: data.mediaAdvertisementDetails || '',
        professionalRecommendation: data.professionalRecommendation || false,
        recommendedBy: data.recommendedBy || '',
      })
    }
  }, [data])

  // Validation rules
  const validateField = (name, value) => {
    switch (name) {
      case 'appliedForRank':
        if (!value) return 'Position applied for is required'
        return ''

      case 'vesselType':
        if (!value) return 'Vessel type is required'
        return ''

      case 'availableFrom':
        if (!value) return 'Available from date is required'
        return ''

      case 'availableTill':
        if (value && value < formData.availableFrom) {
          return 'Available till date must be after available from date'
        }
        return ''

      case 'mediaAdvertisementDetails':
        if (formData.mediaAdvertisement && !value) {
          return 'Please specify which advertisement'
        }
        return ''

      case 'recommendedBy':
        if (formData.professionalRecommendation && !value) {
          return 'Please specify who recommended you'
        }
        return ''

      default:
        return ''
    }
  }

  // Handle field change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value

    // Mark as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }))

    // Validate field
    const error = validateField(name, fieldValue)
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))

    setFormData(prev => {
      const newFormData = {
        ...prev,
        [name]: fieldValue
      }

      if (name === 'mediaAdvertisement' && !checked) {
        newFormData.mediaAdvertisementDetails = ''
      }
      if (name === 'professionalRecommendation' && !checked) {
        newFormData.recommendedBy = ''
      }

      onUpdate({
        section1: newFormData
      })

      return newFormData
    })
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched(prev => ({
      ...prev,
      [name]: true
    }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <h2 className="applicant-section-title">Availability and application details</h2>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Position Applied For */}
        <FormSelect
          label="Position Applied For"
          name="appliedForRank"
          required
          value={formData.appliedForRank}
          onChange={handleChange}
          onBlur={handleBlur}
          options={RANK_OPTIONS}
          placeholder="Select the position you are applying for"
          error={touched.appliedForRank ? errors.appliedForRank : ''}
          helpText="The rank/position you wish to apply for"
        />

        {/* Type of Vessel */}
        <FormSelect
          label="Type of Vessel"
          name="vesselType"
          required
          value={formData.vesselType}
          onChange={handleChange}
          onBlur={handleBlur}
          options={VESSEL_TYPE_OPTIONS}
          placeholder="Select preferred vessel type"
          error={touched.vesselType ? errors.vesselType : ''}
          helpText="Your preferred type of vessel to work on"
        />

        {/* Availability Dates */}
        <div className="applicant-section-card applicant-section-card--muted">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-fg">Availability window</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormDatePicker
            label="Available From"
            name="availableFrom"
            required
            value={formData.availableFrom}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.availableFrom ? errors.availableFrom : ''}
            min={new Date().toISOString().split('T')[0]}
            helpText="When can you join?"
          />

          <FormDatePicker
            label="Available Till"
            name="availableTill"
            value={formData.availableTill}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.availableTill ? errors.availableTill : ''}
            min={formData.availableFrom || new Date().toISOString().split('T')[0]}
            helpText="Optional - End of availability"
          />
          </div>
        </div>

        {/* Media Advertisement */}
        <div className="applicant-toggle-card flex-col">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="mediaAdvertisement"
              name="mediaAdvertisement"
              checked={formData.mediaAdvertisement}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-accent-text focus:ring-accent border-line-input rounded"
            />
            <div>
              <label htmlFor="mediaAdvertisement" className="applicant-toggle-card__title">
                Are you responding to a media advertisement?
              </label>
            </div>
          </div>

          {formData.mediaAdvertisement && (
            <div className="w-full">
              <FormInput
                label="If yes, please state which one"
                name="mediaAdvertisementDetails"
                required
                value={formData.mediaAdvertisementDetails}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.mediaAdvertisementDetails ? errors.mediaAdvertisementDetails : ''}
                placeholder="e.g., LinkedIn job posting, Maritime Executive ad"
                helpText="Specify the advertisement source"
              />
            </div>
          )}
        </div>

        {/* Professional Recommendation */}
        <div className="applicant-toggle-card flex-col">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="professionalRecommendation"
              name="professionalRecommendation"
              checked={formData.professionalRecommendation}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-accent-text focus:ring-accent border-line-input rounded"
            />
            <div>
              <label htmlFor="professionalRecommendation" className="applicant-toggle-card__title">
                Are you applying upon personal or professional recommendation?
              </label>
            </div>
          </div>

          {formData.professionalRecommendation && (
            <div className="w-full">
              <FormInput
                label="If yes, please state who"
                name="recommendedBy"
                required
                value={formData.recommendedBy}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.recommendedBy ? errors.recommendedBy : ''}
                placeholder="e.g., Captain John Smith, Chief Engineer Jane Doe"
                helpText="Name and position of the person who recommended you"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
