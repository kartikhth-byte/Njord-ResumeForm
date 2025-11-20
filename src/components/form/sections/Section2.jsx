import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import FormDatePicker from '../shared/FormDatePicker'
import PhotoUpload from '../shared/PhotoUpload'
import PhoneInput from '../shared/PhoneInput'

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value
    
    let newFormData = { ...formData }
    
    // Handle nested fields
    if (name.startsWith('nextOfKin.')) {
      const field = name.split('.')[1]
      newFormData.nextOfKin = {
        ...newFormData.nextOfKin,
        [field]: fieldValue
      }
    } else if (name.startsWith('emergencyContact.')) {
      const field = name.split('.')[1]
      newFormData.emergencyContact = {
        ...newFormData.emergencyContact,
        [field]: fieldValue
      }
    } else {
      newFormData[name] = fieldValue
    }
    
    setFormData(newFormData)
    setTouched(prev => ({ ...prev, [name]: true }))
    
    // Trigger auto-save
    onUpdate({ section2: newFormData })
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
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
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
          />

          <FormInput
            label="First Name"
            name="firstName"
            required
            value={formData.firstName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="John"
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
          <FormInput
            label="Nationality"
            name="nationality"
            required
            value={formData.nationality}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g., American, Indian"
          />

          <FormInput
            label="Place of Birth"
            name="placeOfBirth"
            required
            value={formData.placeOfBirth}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="City, Country"
          />

          <FormSelect
            label="Gender"
            name="gender"
            required
            value={formData.gender}
            onChange={handleChange}
            onBlur={handleBlur}
            options={GENDER_OPTIONS}
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
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="City"
            name="city"
            required
            value={formData.city}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="New York"
          />

          <FormInput
            label="State/Province"
            name="state"
            value={formData.state}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="NY (optional)"
          />

          <FormInput
            label="Postal Code"
            name="postalCode"
            required
            value={formData.postalCode}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="10001"
          />
        </div>

        <FormInput
          label="Country"
          name="country"
          required
          value={formData.country}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="United States"
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
          />

          <FormSelect
            label="Relationship"
            name="nextOfKin.relationship"
            required
            value={formData.nextOfKin.relationship}
            onChange={handleChange}
            onBlur={handleBlur}
            options={RELATIONSHIP_OPTIONS}
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
          />

          <FormSelect
            label="Relationship"
            name="emergencyContact.relationship"
            required
            value={formData.emergencyContact.relationship}
            onChange={handleChange}
            onBlur={handleBlur}
            options={RELATIONSHIP_OPTIONS}
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