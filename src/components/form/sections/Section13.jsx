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

const HEIGHT_UNIT_OPTIONS = [
  { value: 'cm', label: 'cm' },
  { value: 'm', label: 'm' },
  { value: 'ft', label: 'ft' },
]

const WEIGHT_UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'lbs', label: 'lbs' },
]

const SHOE_SIZE_UNIT_OPTIONS = [
  { value: 'EU', label: 'EU' },
  { value: 'US', label: 'US' },
  { value: 'UK', label: 'UK' },
  { value: 'CM', label: 'CM' },
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
    heightUnit: data.heightUnit || 'cm',
    weight: data.weight || '',
    weightUnit: data.weightUnit || 'kg',
    hairColor: data.hairColor || '',
    eyeColor: data.eyeColor || '',
    shoeSize: data.shoeSize || '',
shoeSizeUnit: data.shoeSizeUnit || '',
    boilerSuitSize: data.boilerSuitSize || '',
    uniformShirtSize: data.uniformShirtSize || '',
    uniformTrouserSize: data.uniformTrouserSize || '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        height: data.height || '',
        heightUnit: data.heightUnit || 'cm',
        weight: data.weight || '',
        weightUnit: data.weightUnit || 'kg',
        hairColor: data.hairColor || '',
        eyeColor: data.eyeColor || '',
        shoeSize: data.shoeSize || '',
shoeSizeUnit: data.shoeSizeUnit || '',
        boilerSuitSize: data.boilerSuitSize || '',
        uniformShirtSize: data.uniformShirtSize || '',
        uniformTrouserSize: data.uniformTrouserSize || '',
      })
    }
  }, [data])

  // Validation function
  const validateField = (name, value) => {
    switch (name) {
      case 'height':
        return !value ? 'Height is required' : ''
      case 'weight':
        return !value ? 'Weight is required' : ''
      case 'hairColor':
        return !value ? 'Hair color is required' : ''
      case 'eyeColor':
        return !value ? 'Eye color is required' : ''
      case 'shoeSize':
        return !value ? 'Shoe size is required' : ''
      case 'boilerSuitSize':
        return !value ? 'Boiler suit size is required' : ''
      case 'uniformShirtSize':
        return !value ? 'Uniform shirt size is required' : ''
      case 'uniformTrouserSize':
        return !value ? 'Uniform trouser size is required' : ''
      default:
        return ''
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    const newFormData = {
      ...formData,
      [name]: value
    }
    
    setFormData(newFormData)
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }))
    
    // Validate field
    const error = validateField(name, value)
    setErrors(prev => ({ ...prev, [name]: error }))
    
    onUpdate({ section13: newFormData })
  }

  const handleBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    
    const error = validateField(name, formData[name])
    setErrors(prev => ({ ...prev, [name]: error }))
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="applicant-section-intro">
        <p className="applicant-section-kicker">Deployment readiness</p>
        <h2 className="applicant-section-title">Physical and uniform details</h2>
        <p className="applicant-section-copy">
          Provide your physical characteristics and uniform sizes for proper equipment fitting
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Physical Characteristics */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Physical Characteristics</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Height with Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleChange}
                    onBlur={() => handleBlur('height')}
                    step="0.01"
                    min="0"
                    placeholder="e.g., 180"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      touched.height && errors.height
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
                <FormSelect
                  name="heightUnit"
                  value={formData.heightUnit}
                  onChange={handleChange}
                  options={HEIGHT_UNIT_OPTIONS}
                />
              </div>
              {touched.height && errors.height && (
                <p className="mt-1 text-sm text-red-600">{errors.height}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">Your height</p>
            </div>

            {/* Weight with Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    onBlur={() => handleBlur('weight')}
                    step="0.01"
                    min="0"
                    placeholder="e.g., 75"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      touched.weight && errors.weight
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                </div>
                <FormSelect
                  name="weightUnit"
                  value={formData.weightUnit}
                  onChange={handleChange}
                  options={WEIGHT_UNIT_OPTIONS}
                />
              </div>
              {touched.weight && errors.weight && (
                <p className="mt-1 text-sm text-red-600">{errors.weight}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">Your weight</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormSelect
              label="Hair Color"
              name="hairColor"
              required
              value={formData.hairColor}
              onChange={handleChange}
              onBlur={() => handleBlur('hairColor')}
              options={HAIR_COLOR_OPTIONS}
              error={touched.hairColor ? errors.hairColor : ''}
            />

            <FormSelect
              label="Eye Color"
              name="eyeColor"
              required
              value={formData.eyeColor}
              onChange={handleChange}
              onBlur={() => handleBlur('eyeColor')}
              options={EYE_COLOR_OPTIONS}
              error={touched.eyeColor ? errors.eyeColor : ''}
            />
          </div>
        </div>

        {/* Uniform Sizes */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Uniform & Safety Equipment Sizes</h3>

{/* Shoe Size with Unit */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Shoe Size
      <span className="text-red-500 ml-1">*</span>
    </label>
    <input
      type="text"
      name="shoeSize"
      value={formData.shoeSize}
      onChange={handleChange}
      onBlur={() => handleBlur('shoeSize')}
      placeholder="e.g., 42 or 9 or 8"
      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
        touched.shoeSize && errors.shoeSize
          ? 'border-red-500'
          : 'border-gray-300'
      }`}
    />
    {touched.shoeSize && errors.shoeSize && (
      <p className="mt-1 text-sm text-red-600">{errors.shoeSize}</p>
    )}
    <p className="mt-1 text-sm text-gray-500">Enter your shoe size number</p>
  </div>

  <FormSelect
    label="Sizing System"
    name="shoeSizeUnit"
    required
    value={formData.shoeSizeUnit}
    onChange={handleChange}
    options={SHOE_SIZE_UNIT_OPTIONS}
    placeholder="Select system"
    helpText="Choose measurement system"
  />
</div>

          <FormSelect
            label="Boiler Suit / Coverall Size"
            name="boilerSuitSize"
            required
            value={formData.boilerSuitSize}
            onChange={handleChange}
            onBlur={() => handleBlur('boilerSuitSize')}
            options={SIZE_OPTIONS.boilerSuit}
            helpText="Standard clothing size for coveralls"
            error={touched.boilerSuitSize ? errors.boilerSuitSize : ''}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Uniform Shirt Size"
              name="uniformShirtSize"
              required
              value={formData.uniformShirtSize}
              onChange={handleChange}
              onBlur={() => handleBlur('uniformShirtSize')}
              placeholder="e.g., 42 or L"
              helpText="Collar size (cm/inches) or letter size"
              error={touched.uniformShirtSize ? errors.uniformShirtSize : ''}
            />

            <FormInput
              label="Uniform Trouser Size"
              name="uniformTrouserSize"
              required
              value={formData.uniformTrouserSize}
              onChange={handleChange}
              onBlur={() => handleBlur('uniformTrouserSize')}
              placeholder="e.g., 34 or L"
              helpText="Waist size (cm/inches) or letter size"
              error={touched.uniformTrouserSize ? errors.uniformTrouserSize : ''}
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
