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
        <h2 className="applicant-section-title">Physical and uniform details</h2>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Physical Characteristics */}
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-fg border-b pb-2">Physical Characteristics</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Height with Unit */}
            <div>
              <label className="block text-sm font-medium text-fg-secondary mb-1">
                Height
                <span className="text-danger ml-1">*</span>
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
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${
 touched.height && errors.height
 ? 'border-danger'
 : 'border-line-input'
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
                <p className="mt-1 text-sm text-danger">{errors.height}</p>
              )}
              <p className="mt-1 text-sm text-fg-muted">Your height</p>
            </div>

            {/* Weight with Unit */}
            <div>
              <label className="block text-sm font-medium text-fg-secondary mb-1">
                Weight
                <span className="text-danger ml-1">*</span>
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
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${
 touched.weight && errors.weight
 ? 'border-danger'
 : 'border-line-input'
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
                <p className="mt-1 text-sm text-danger">{errors.weight}</p>
              )}
              <p className="mt-1 text-sm text-fg-muted">Your weight</p>
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
          <h3 className="text-lg font-semibold text-fg border-b pb-2">Uniform & Safety Equipment Sizes</h3>

{/* Shoe Size with Unit */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium text-fg-secondary mb-1">
      Shoe Size
      <span className="text-danger ml-1">*</span>
    </label>
    <input
      type="text"
      name="shoeSize"
      value={formData.shoeSize}
      onChange={handleChange}
      onBlur={() => handleBlur('shoeSize')}
      placeholder="e.g., 42 or 9 or 8"
      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${
 touched.shoeSize && errors.shoeSize
 ? 'border-danger'
 : 'border-line-input'
 }`}
    />
    {touched.shoeSize && errors.shoeSize && (
      <p className="mt-1 text-sm text-danger">{errors.shoeSize}</p>
    )}
    <p className="mt-1 text-sm text-fg-muted">Enter your shoe size number</p>
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
    </div>
  )
}
