import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'

const HAIR_COLOR_OPTIONS = [
  { value: 'black', label: 'Black' },
  { value: 'brown', label: 'Brown' },
  { value: 'blonde', label: 'Blonde' },
  { value: 'red', label: 'Red' },
  { value: 'gray', label: 'Gray/White' },
  { value: 'bald', label: 'Bald' },
  { value: 'other', label: 'Other' },
]

const EYE_COLOR_OPTIONS = [
  { value: 'brown', label: 'Brown' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'hazel', label: 'Hazel' },
  { value: 'gray', label: 'Gray' },
  { value: 'black', label: 'Black' },
  { value: 'other', label: 'Other' },
]

const SIZE_OPTIONS = {
  boilerSuit: [
    { value: 'XS', label: 'XS - Extra Small' },
    { value: 'S', label: 'S - Small' },
    { value: 'M', label: 'M - Medium' },
    { value: 'L', label: 'L - Large' },
    { value: 'XL', label: 'XL - Extra Large' },
    { value: 'XXL', label: 'XXL - 2X Large' },
    { value: 'XXXL', label: 'XXXL - 3X Large' },
  ]
}

export default function Section13({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    height: data.height || '',
    weight: data.weight || '',
    hairColor: data.hairColor || '',
    eyeColor: data.eyeColor || '',
    shoeSize: data.shoeSize || '',
    boilerSuitSize: data.boilerSuitSize || '',
    uniformShirtSize: data.uniformShirtSize || '',
    uniformTrouserSize: data.uniformTrouserSize || '',
  })

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        height: data.height || '',
        weight: data.weight || '',
        hairColor: data.hairColor || '',
        eyeColor: data.eyeColor || '',
        shoeSize: data.shoeSize || '',
        boilerSuitSize: data.boilerSuitSize || '',
        uniformShirtSize: data.uniformShirtSize || '',
        uniformTrouserSize: data.uniformTrouserSize || '',
      })
    }
  }, [data])

  const handleChange = (e) => {
    const { name, value } = e.target
    
    const newFormData = {
      ...formData,
      [name]: value
    }
    
    setFormData(newFormData)
    onUpdate({ section13: newFormData })
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Physical & Uniform Details</h2>
<h2 className="text-2xl font-bold text-gray-900">Section 13: Physical & Uniform Details</h2>
        <p className="text-gray-600 mt-1">
          Provide your physical characteristics and uniform sizes for proper equipment fitting
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Physical Characteristics */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Physical Characteristics</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Height"
              name="height"
              required
              value={formData.height}
              onChange={handleChange}
              placeholder="e.g., 180cm or 5ft 11in"
              helpText="In centimeters or feet/inches"
            />

            <FormInput
              label="Weight"
              name="weight"
              required
              value={formData.weight}
              onChange={handleChange}
              placeholder="e.g., 75kg or 165lbs"
              helpText="In kilograms or pounds"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              label="Hair Color"
              name="hairColor"
              required
              value={formData.hairColor}
              onChange={handleChange}
              options={HAIR_COLOR_OPTIONS}
            />

            <FormSelect
              label="Eye Color"
              name="eyeColor"
              required
              value={formData.eyeColor}
              onChange={handleChange}
              options={EYE_COLOR_OPTIONS}
            />
          </div>
        </div>

        {/* Uniform Sizes */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Uniform & Safety Equipment Sizes</h3>

          <FormInput
            label="Shoe Size"
            name="shoeSize"
            required
            value={formData.shoeSize}
            onChange={handleChange}
            placeholder="e.g., 42 EU / 9 US / 8 UK"
            helpText="Provide your shoe size in any standard sizing system"
          />

          <FormSelect
            label="Boiler Suit / Coverall Size"
            name="boilerSuitSize"
            required
            value={formData.boilerSuitSize}
            onChange={handleChange}
            options={SIZE_OPTIONS.boilerSuit}
            helpText="Standard clothing size for coveralls"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Uniform Shirt Size"
              name="uniformShirtSize"
              required
              value={formData.uniformShirtSize}
              onChange={handleChange}
              placeholder="e.g., 42 or L"
              helpText="Collar size (cm/inches) or letter size"
            />

            <FormInput
              label="Uniform Trouser Size"
              name="uniformTrouserSize"
              required
              value={formData.uniformTrouserSize}
              onChange={handleChange}
              placeholder="e.g., 34 or L"
              helpText="Waist size (cm/inches) or letter size"
            />
          </div>
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
              Important
            </h3>
            <p className="text-sm text-blue-800">
              Accurate uniform and safety equipment sizes are essential for your comfort and safety onboard. These measurements help ensure proper fit of work clothes, safety gear, and life-saving equipment.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}