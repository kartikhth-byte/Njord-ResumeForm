/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import PhotoUpload from '../shared/PhotoUpload'
import PhoneInput from '../shared/PhoneInput'
import { COUNTRIES, NATIONALITIES, INDIAN_STATES, INDIAN_CITIES } from '../../../utils/countryData'


const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
]

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
]

export default function Section2({ data = {}, onUpdate }) {
  const [formData, setFormData] = useState({
    photoStoragePath: data.photoStoragePath || '',
    surname: data.surname || '',
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    otherNames: data.otherNames || '',
    knownAs: data.knownAs || '',
    nationality: data.nationality || '',
    placeOfBirth: data.placeOfBirth || '',
    dateOfBirth: data.dateOfBirth || '',
    age: data.age || '',
    gender: data.gender || '',
    email: data.email || '',
    phoneCountryCode: data.phoneCountryCode || '',
    phoneNumber: data.phoneNumber || '',
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || '',
    postalCode: data.postalCode || '',
    domesticAirport: data.domesticAirport || '',
    internationalAirport: data.internationalAirport || '',
    maritalStatus: data.maritalStatus || '',
    nextOfKin: {
      name: data.nextOfKin?.name || '',
      relationship: data.nextOfKin?.relationship || '',
      addressDifferent: data.nextOfKin?.addressDifferent || false,
      address: data.nextOfKin?.address || '',
      phoneDifferent: data.nextOfKin?.phoneDifferent || false,
      phone: data.nextOfKin?.phone || '',
    },
    emergencyContact: {
      name: data.emergencyContact?.name || '',
      relationship: data.emergencyContact?.relationship || '',
      address: data.emergencyContact?.address || '',
      phone: data.emergencyContact?.phone || '',
      mobile: data.emergencyContact?.mobile || '',
    },
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

// Auto-capitalize helper function - converts to Title Case
const autoCapitalize = (value) => {
  if (!value) return ''
  return value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

  // Sync state when data prop changes
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFormData({
        photoStoragePath: data.photoStoragePath || '',
        surname: data.surname || '',
        firstName: data.firstName || '',
        middleName: data.middleName || '',
        otherNames: data.otherNames || '',
        knownAs: data.knownAs || '',
        nationality: data.nationality || '',
        placeOfBirth: data.placeOfBirth || '',
        dateOfBirth: data.dateOfBirth || '',
        age: data.age || '',
        gender: data.gender || '',
        email: data.email || '',
        phoneCountryCode: data.phoneCountryCode || '',
        phoneNumber: data.phoneNumber || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        postalCode: data.postalCode || '',
        domesticAirport: data.domesticAirport || '',
        internationalAirport: data.internationalAirport || '',
        maritalStatus: data.maritalStatus || '',
        nextOfKin: {
          name: data.nextOfKin?.name || '',
          relationship: data.nextOfKin?.relationship || '',
          addressDifferent: data.nextOfKin?.addressDifferent || false,
          address: data.nextOfKin?.address || '',
          phoneDifferent: data.nextOfKin?.phoneDifferent || false,
          phone: data.nextOfKin?.phone || '',
        },
        emergencyContact: {
          name: data.emergencyContact?.name || '',
          relationship: data.emergencyContact?.relationship || '',
          address: data.emergencyContact?.address || '',
          phone: data.emergencyContact?.phone || '',
          mobile: data.emergencyContact?.mobile || '',
        },
      })
    }
  }, [data])

  // Calculate age from date of birth
  useEffect(() => {
    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      
      if (age !== formData.age) {
        const newFormData = { ...formData, age: age.toString() }
        setFormData(newFormData)
        onUpdate({ section2: newFormData })
      }
    }
  }, [formData.dateOfBirth])


  // Validation rules
  const validateField = (name, value) => {
    // Handle nested field names
    const fieldName = name.includes('.') ? name.split('.')[1] : name
    const parentField = name.includes('.') ? name.split('.')[0] : null

    // Personal Information
    if (name === 'surname' && !value) return 'Surname is required'
    if (name === 'firstName' && !value) return 'First name is required'
    if (name === 'nationality' && !value) return 'Nationality is required'
    if (name === 'placeOfBirth' && !value) return 'Place of birth is required'
    if (name === 'dateOfBirth' && !value) return 'Date of birth is required'
    if (name === 'gender' && !value) return 'Gender is required'

    // Contact Information
    if (name === 'email') {
      if (!value) return 'Email is required'
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) return 'Please enter a valid email address'
    }
    if (name === 'phoneCountryCode' && !value) return 'Phone country code is required'
    if (name === 'phoneNumber' && !value) return 'Phone number is required'
    if (name === 'address' && !value) return 'Address is required'
    if (name === 'city' && !value) return 'City is required'
    if (name === 'country' && !value) return 'Country is required'
    if (name === 'postalCode' && !value) return 'Postal code is required'
    if (name === 'maritalStatus' && !value) return 'Marital status is required'

    // Next of Kin
    if (name === 'nextOfKin.name' && !value) return 'Next of kin name is required'
    if (name === 'nextOfKin.relationship' && !value) return 'Next of kin relationship is required'
    if (name === 'nextOfKin.address' && formData.nextOfKin.addressDifferent && !value) {
      return 'Next of kin address is required when address is different'
    }
    if (name === 'nextOfKin.phone' && formData.nextOfKin.phoneDifferent && !value) {
      return 'Next of kin phone is required when phone is different'
    }

    // Emergency Contact
    if (name === 'emergencyContact.name' && !value) return 'Emergency contact name is required'
    if (name === 'emergencyContact.relationship' && !value) return 'Emergency contact relationship is required'
    if (name === 'emergencyContact.address' && !value) return 'Emergency contact address is required'
    if (name === 'emergencyContact.phone' && !value) return 'Emergency contact phone is required'

    return ''
  }

  const handleChange = (e) => {
  const { name, value } = e.target
  
  // If country changes, clear city and state
  if (name === 'country') {
    setFormData(prev => ({
      ...prev,
      [name]: value,
      city: '',
      state: ''
    }))
  } else {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  setTouched(prev => ({ ...prev, [name]: true }))
}

  const handlePhoneChange = (countryCode, number) => {
    const newFormData = {
      ...formData,
      phoneCountryCode: countryCode,
      phoneNumber: number
    }
    setFormData(newFormData)
    onUpdate({ section2: newFormData })
  }

  const handlePhotoUploaded = (photoPath) => {
    const newFormData = {
      ...formData,
      photoStoragePath: photoPath || ''
    }
    setFormData(newFormData)
    onUpdate({ section2: newFormData })
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    
    // Validate on blur
    const error = validateField(name, value)
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
<h2 className="text-2xl font-bold text-gray-900">Section 2: Personal & Contact Details</h2>
        <p className="text-gray-600 mt-1">
          Provide your personal information and contact details
        </p>
      </div>

      {/* Photo Upload */}
      <PhotoUpload
        currentPhotoPath={formData.photoStoragePath}
        onPhotoUploaded={handlePhotoUploaded}
      />

      {/* Personal Information */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Personal Information</h3>

        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Surname"
            name="surname"
            required
            value={formData.surname}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Doe"
            error={touched.surname ? errors.surname : ''}
          />

          <FormInput
            label="First Name"
            name="firstName"
            required
            value={formData.firstName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="John"
            error={touched.firstName ? errors.firstName : ''}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Middle Name"
            name="middleName"
            value={formData.middleName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Michael (optional)"
          />

          <FormInput
            label="Other Names"
            name="otherNames"
            value={formData.otherNames}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Any other names (optional)"
          />
        </div>

        <FormInput
          label="Known As"
          name="knownAs"
          value={formData.knownAs}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Nickname or preferred name (optional)"
          helpText="What you prefer to be called"
        />

        {/* Birth Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormSelect
        label="Nationality"
  name="nationality"
  required
  value={formData.nationality}
  onChange={handleChange}
  onBlur={handleBlur}
  options={NATIONALITIES}
  placeholder="Select your nationality"
            error={touched.nationality ? errors.nationality : ''}
          />

          <FormInput
  label="Place of Birth"
  name="placeOfBirth"
  required
  value={formData.placeOfBirth}
  onChange={(e) => {
    // Auto-capitalize first letter
    const value = e.target.value
    const capitalized = value.charAt(0).toUpperCase() + value.slice(1)
    handleChange({ target: { name: 'placeOfBirth', value: capitalized } })
  }}
  onBlur={handleBlur}
  placeholder="City, Country"
            error={touched.placeOfBirth ? errors.placeOfBirth : ''}
          />

          <FormSelect
            label="Gender"
            name="gender"
            required
            value={formData.gender}
            onChange={handleChange}
            onBlur={handleBlur}
            options={GENDER_OPTIONS}
            error={touched.gender ? errors.gender : ''}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormDatePicker
            label="Date of Birth"
            name="dateOfBirth"
            required
            value={formData.dateOfBirth}
            onChange={handleChange}
            onBlur={handleBlur}
            max={new Date().toISOString().split('T')[0]}
            error={touched.dateOfBirth ? errors.dateOfBirth : ''}
          />

          <FormInput
            label="Age"
            name="age"
            value={formData.age}
            disabled
            placeholder="Auto-calculated"
            helpText="Automatically calculated from date of birth"
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Contact Information</h3>

        <FormInput
          label="Email Address"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="john.doe@example.com"
          error={touched.email ? errors.email : ''}
        />

        <PhoneInput
          label="Mobile Phone"
          required
          countryCode={formData.phoneCountryCode}
          phoneNumber={formData.phoneNumber}
          onChange={handlePhoneChange}
        />

        <FormInput
          label="Full Address"
          name="address"
          required
          value={formData.address}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Street address, Apartment, Suite"
          error={touched.address ? errors.address : ''}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
{formData.country === 'india' ? (
  <FormSelect
    label="City"
    name="city"
    required
    value={formData.city}
    onChange={handleChange}
    onBlur={handleBlur}
    options={INDIAN_CITIES}
    placeholder="Select your city"
    error={touched.city ? errors.city : ''}
  />
) : (
  <FormInput
    label="City"
    name="city"
    required
    value={formData.city}
    onChange={(e) => {
      const capitalized = autoCapitalize(e.target.value)
      handleChange({ target: { name: 'city', value: capitalized } })
    }}
    onBlur={handleBlur}
    placeholder="Enter your city"
    error={touched.city ? errors.city : ''}
  />
)}

{formData.country === 'india' ? (
  <FormSelect
    label="State/Province"
    name="state"
    required
    value={formData.state}
    onChange={handleChange}
    onBlur={handleBlur}
    options={INDIAN_STATES}
    placeholder="Select your state"
    error={touched.state ? errors.state : ''}
  />
) : (
  <FormInput
    label="State/Province"
    name="state"
    value={formData.state}
    onChange={(e) => {
      const capitalized = autoCapitalize(e.target.value)
      handleChange({ target: { name: 'state', value: capitalized } })
    }}
    onBlur={handleBlur}
    placeholder="Enter your state/province"
    error={touched.state ? errors.state : ''}
  />
)}

          <FormInput
            label="Postal Code"
            name="postalCode"
            required
            value={formData.postalCode}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="10001"
            error={touched.postalCode ? errors.postalCode : ''}
          />
        </div>

        <FormSelect
    label="Country"
  name="country"
  required
  value={formData.country}
  onChange={handleChange}
  onBlur={handleBlur}
  options={COUNTRIES}
  placeholder="Select your country"
          error={touched.country ? errors.country : ''}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Domestic Airport"
            name="domesticAirport"
            value={formData.domesticAirport}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g., JFK, LAX"
            helpText="Nearest domestic airport"
          />

          <FormInput
            label="International Airport"
            name="internationalAirport"
            value={formData.internationalAirport}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g., JFK, LAX"
            helpText="Nearest international airport"
          />
        </div>

        <FormSelect
          label="Marital Status"
          name="maritalStatus"
          required
          value={formData.maritalStatus}
          onChange={handleChange}
          onBlur={handleBlur}
          options={MARITAL_STATUS_OPTIONS}
          error={touched.maritalStatus ? errors.maritalStatus : ''}
        />
      </div>

      {/* Next of Kin */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Next of Kin</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Full Name"
            name="nextOfKin.name"
            required
            value={formData.nextOfKin.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Jane Doe"
            error={touched['nextOfKin.name'] ? errors['nextOfKin.name'] : ''}
          />

          <FormSelect
            label="Relationship"
            name="nextOfKin.relationship"
            required
            value={formData.nextOfKin.relationship}
            onChange={handleChange}
            onBlur={handleBlur}
            options={RELATIONSHIP_OPTIONS}
            error={touched['nextOfKin.relationship'] ? errors['nextOfKin.relationship'] : ''}
          />
        </div>

        <div className="flex items-start">
          <input
            type="checkbox"
            id="nextOfKinAddressDifferent"
            name="nextOfKin.addressDifferent"
            checked={formData.nextOfKin.addressDifferent}
            onChange={handleChange}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="nextOfKinAddressDifferent" className="ml-3 block text-sm font-medium text-gray-700">
            Next of Kin has different address
          </label>
        </div>

        {formData.nextOfKin.addressDifferent && (
          <FormInput
            label="Next of Kin Address"
            name="nextOfKin.address"
            value={formData.nextOfKin.address}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Full address if different from above"
            error={touched['nextOfKin.address'] ? errors['nextOfKin.address'] : ''}
          />
        )}

        <div className="flex items-start">
          <input
            type="checkbox"
            id="nextOfKinPhoneDifferent"
            name="nextOfKin.phoneDifferent"
            checked={formData.nextOfKin.phoneDifferent}
            onChange={handleChange}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="nextOfKinPhoneDifferent" className="ml-3 block text-sm font-medium text-gray-700">
            Next of Kin has different phone number
          </label>
        </div>

        {formData.nextOfKin.phoneDifferent && (
          <FormInput
            label="Next of Kin Phone"
            name="nextOfKin.phone"
            value={formData.nextOfKin.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Phone number if different"
            error={touched['nextOfKin.phone'] ? errors['nextOfKin.phone'] : ''}
          />
        )}
      </div>

      {/* Emergency Contact */}
      <div className="space-y-5">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Emergency Contact</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Name"
            name="emergencyContact.name"
            required
            value={formData.emergencyContact.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Jane Doe"
            error={touched['emergencyContact.name'] ? errors['emergencyContact.name'] : ''}
          />

          <FormSelect
            label="Relationship"
            name="emergencyContact.relationship"
            required
            value={formData.emergencyContact.relationship}
            onChange={handleChange}
            onBlur={handleBlur}
            options={RELATIONSHIP_OPTIONS}
            error={touched['emergencyContact.relationship'] ? errors['emergencyContact.relationship'] : ''}
          />
        </div>

        <FormInput
          label="Address"
          name="emergencyContact.address"
          required
          value={formData.emergencyContact.address}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="Full address"
          error={touched['emergencyContact.address'] ? errors['emergencyContact.address'] : ''}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Phone Number"
            name="emergencyContact.phone"
            required
            value={formData.emergencyContact.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="+1 555-1234"
            error={touched['emergencyContact.phone'] ? errors['emergencyContact.phone'] : ''}
          />

          <FormInput
            label="Mobile Number"
            name="emergencyContact.mobile"
            value={formData.emergencyContact.mobile}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="+1 555-5678 (optional)"
          />
        </div>
      </div>
    </div>
  )
}
