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
    
    const newFormData = {
      ...formData,
      [name]: fieldValue
    }
    
    // Clear conditional fields when parent changes
    if (name === 'mediaAdvertisement' && !checked) {
      newFormData.mediaAdvertisementDetails = ''
    }
    if (name === 'professionalRecommendation' && !checked) {
      newFormData.recommendedBy = ''
    }
    
    setFormData(newFormData)

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

    // Trigger auto-save
    onUpdate({
      section1: newFormData
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
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 1: Availability & Application Details</h2>      
  <p className="text-gray-600 mt-1">
          Tell us about the position you are applying for and your availability
        </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Media Advertisement */}
        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="mediaAdvertisement"
              name="mediaAdvertisement"
              checked={formData.mediaAdvertisement}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="mediaAdvertisement" className="ml-3 block text-sm font-medium text-gray-700">
              Are you responding to a media advertisement?
            </label>
          </div>

          {formData.mediaAdvertisement && (
            <FormInput
              label="If YES, please state which one"
              name="mediaAdvertisementDetails"
              required
              value={formData.mediaAdvertisementDetails}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.mediaAdvertisementDetails ? errors.mediaAdvertisementDetails : ''}
              placeholder="e.g., LinkedIn job posting, Maritime Executive ad"
              helpText="Specify the advertisement source"
            />
          )}
        </div>

        {/* Professional Recommendation */}
        <div className="space-y-3">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="professionalRecommendation"
              name="professionalRecommendation"
              checked={formData.professionalRecommendation}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="professionalRecommendation" className="ml-3 block text-sm font-medium text-gray-700">
              Are you applying upon personal or professional recommendation?
            </label>
          </div>

          {formData.professionalRecommendation && (
            <FormInput
              label="If YES, please state who"
              name="recommendedBy"
              required
              value={formData.recommendedBy}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.recommendedBy ? errors.recommendedBy : ''}
              placeholder="e.g., Captain John Smith, Chief Engineer Jane Doe"
              helpText="Name and position of the person who recommended you"
            />
          )}
        </div>
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
              Tip
            </h3>
            <p className="text-sm text-blue-800">
              Your availability information helps us match you with suitable positions. Be as specific as possible about your preferred vessel type and availability dates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}