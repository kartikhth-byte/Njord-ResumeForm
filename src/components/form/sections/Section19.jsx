import { useState, useEffect } from 'react'
import FormInput from '../shared/FormInput'
import FormSelect from '../shared/FormSelect'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

const RELATIONSHIP_OPTIONS = [
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Son', label: 'Son' },
  { value: 'Daughter', label: 'Daughter' },
  { value: 'Brother', label: 'Brother' },
  { value: 'Sister', label: 'Sister' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other Relative', label: 'Other Relative' },
  { value: 'Other', label: 'Other' },
]

const emptyContact = {
  isPrimary: false,
  fullName: '',
  relationship: '',
  phoneNumber: '',
  alternatePhone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
}

export default function Section19({ data = {}, onUpdate }) {
  const [contacts, setContacts] = useState(data.contacts || [])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Sync state when data prop changes
  useEffect(() => {
    if (data && data.contacts) {
      setContacts(data.contacts)
    }
  }, [data])

  // Validation function for contact fields
  const validateContactField = (index, field, value) => {
    const key = `contact-${index}-${field}`
    
    switch (field) {
      case 'fullName':
        return !value ? 'Full name is required' : ''
      case 'relationship':
        return !value ? 'Relationship is required' : ''
      case 'phoneNumber':
        if (!value) return 'Phone number is required'
        if (value.length < 8) return 'Please enter a valid phone number'
        return ''
      case 'email':
        if (!value) return 'Email is required'
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) return 'Please enter a valid email address'
        return ''
      case 'address':
        return !value ? 'Street address is required' : ''
      case 'city':
        return !value ? 'City is required' : ''
      case 'country':
        return !value ? 'Country is required' : ''
      case 'postalCode':
        return !value ? 'Postal code is required' : ''
      // Optional fields
      case 'alternatePhone':
      case 'state':
        return ''
      default:
        return ''
    }
  }

  const handleAddContact = () => {
    const newContacts = [...contacts, { ...emptyContact }]
    setContacts(newContacts)
    onUpdate({ section19: { contacts: newContacts } })
  }

  const handleRemoveContact = (index) => {
    const newContacts = contacts.filter((_, i) => i !== index)
    setContacts(newContacts)
    onUpdate({ section19: { contacts: newContacts } })
  }

  const handleContactChange = (index, field, value) => {
    const newContacts = [...contacts]
    
    // If setting as primary, unset all other primaries
    if (field === 'isPrimary' && value === true) {
      newContacts.forEach((contact, i) => {
        if (i !== index) {
          contact.isPrimary = false
        }
      })
    }
    
    newContacts[index] = {
      ...newContacts[index],
      [field]: value
    }
    setContacts(newContacts)
    
    // Mark field as touched (skip for isPrimary checkbox)
    if (field !== 'isPrimary') {
      const key = `contact-${index}-${field}`
      setTouched(prev => ({ ...prev, [key]: true }))
      
      // Validate field
      const error = validateContactField(index, field, value)
      setErrors(prev => ({ ...prev, [key]: error }))
    }
    
    onUpdate({ section19: { contacts: newContacts } })
  }

  const handleBlur = (index, field) => {
    const key = `contact-${index}-${field}`
    setTouched(prev => ({ ...prev, [key]: true }))
    
    const value = contacts[index]?.[field]
    const error = validateContactField(index, field, value)
    setErrors(prev => ({ ...prev, [key]: error }))
  }

  const primaryContact = contacts.find(c => c.isPrimary)

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Section 19: Emergency Contact Information</h2>
        <p className="text-gray-600 mt-1">
          Provide emergency contact information for next-of-kin and family members
        </p>
      </div>

      {/* Warning if no primary contact */}
      {contacts.length > 0 && !primaryContact && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Primary Contact Required
              </h3>
              <p className="text-sm text-red-800">
                Please designate one contact as your primary emergency contact by checking the "Primary Contact" box.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div className="space-y-6">
        {contacts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-gray-600 mb-2">No emergency contacts added yet</p>
            <p className="text-sm text-gray-500 mb-4">Add at least one emergency contact (family member or next-of-kin)</p>
            <button
              onClick={handleAddContact}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Emergency Contact
            </button>
          </div>
        ) : (
          <>
            {contacts.map((contact, index) => (
              <div 
                key={index} 
                className={`border-2 rounded-lg p-6 ${
                  contact.isPrimary 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {/* Contact Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Emergency Contact {index + 1}
                      {contact.fullName && ` - ${contact.fullName}`}
                    </h3>
                    {contact.isPrimary && (
                      <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveContact(index)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Remove</span>
                  </button>
                </div>

                {/* Primary Contact Checkbox */}
                <div className="mb-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id={`contact-${index}-isPrimary`}
                      checked={contact.isPrimary}
                      onChange={(e) => handleContactChange(index, 'isPrimary', e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`contact-${index}-isPrimary`} className="ml-3 block">
                      <span className="text-sm font-medium text-gray-900">
                        Set as Primary Emergency Contact
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        This person will be contacted first in case of emergency
                      </p>
                    </label>
                  </div>
                </div>

                {/* Contact Fields */}
                <div className="space-y-4">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 border-b pb-2">Personal Information</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Full Name"
                        name={`contact-${index}-fullName`}
                        required
                        value={contact.fullName}
                        onChange={(e) => handleContactChange(index, 'fullName', e.target.value)}
                        onBlur={() => handleBlur(index, 'fullName')}
                        placeholder="e.g., Jane Smith"
                        error={touched[`contact-${index}-fullName`] ? errors[`contact-${index}-fullName`] : ''}
                      />

                      <FormSelect
                        label="Relationship"
                        name={`contact-${index}-relationship`}
                        required
                        value={contact.relationship}
                        onChange={(e) => handleContactChange(index, 'relationship', e.target.value)}
                        onBlur={() => handleBlur(index, 'relationship')}
                        options={RELATIONSHIP_OPTIONS}
                        error={touched[`contact-${index}-relationship`] ? errors[`contact-${index}-relationship`] : ''}
                      />
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 border-b pb-2">Contact Information</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Primary Phone Number"
                        name={`contact-${index}-phoneNumber`}
                        required
                        type="tel"
                        value={contact.phoneNumber}
                        onChange={(e) => handleContactChange(index, 'phoneNumber', e.target.value)}
                        onBlur={() => handleBlur(index, 'phoneNumber')}
                        placeholder="e.g., +1 234 567 8900"
                        helpText="Include country code"
                        error={touched[`contact-${index}-phoneNumber`] ? errors[`contact-${index}-phoneNumber`] : ''}
                      />

                      <FormInput
                        label="Alternate Phone Number"
                        name={`contact-${index}-alternatePhone`}
                        type="tel"
                        value={contact.alternatePhone}
                        onChange={(e) => handleContactChange(index, 'alternatePhone', e.target.value)}
                        placeholder="e.g., +1 234 567 8901"
                        helpText="Optional backup number"
                      />
                    </div>

                    <FormInput
                      label="Email Address"
                      name={`contact-${index}-email`}
                      required
                      type="email"
                      value={contact.email}
                      onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                      onBlur={() => handleBlur(index, 'email')}
                      placeholder="e.g., jane.smith@email.com"
                      error={touched[`contact-${index}-email`] ? errors[`contact-${index}-email`] : ''}
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 border-b pb-2">Address</h4>
                    
                    <FormInput
                      label="Street Address"
                      name={`contact-${index}-address`}
                      required
                      value={contact.address}
                      onChange={(e) => handleContactChange(index, 'address', e.target.value)}
                      onBlur={() => handleBlur(index, 'address')}
                      placeholder="e.g., 123 Main Street, Apt 4B"
                      error={touched[`contact-${index}-address`] ? errors[`contact-${index}-address`] : ''}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="City"
                        name={`contact-${index}-city`}
                        required
                        value={contact.city}
                        onChange={(e) => handleContactChange(index, 'city', e.target.value)}
                        onBlur={() => handleBlur(index, 'city')}
                        placeholder="e.g., New York"
                        error={touched[`contact-${index}-city`] ? errors[`contact-${index}-city`] : ''}
                      />

                      <FormInput
                        label="State / Province"
                        name={`contact-${index}-state`}
                        value={contact.state}
                        onChange={(e) => handleContactChange(index, 'state', e.target.value)}
                        placeholder="e.g., New York"
                        helpText="If applicable"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="Country"
                        name={`contact-${index}-country`}
                        required
                        value={contact.country}
                        onChange={(e) => handleContactChange(index, 'country', e.target.value)}
                        onBlur={() => handleBlur(index, 'country')}
                        placeholder="e.g., United States"
                        error={touched[`contact-${index}-country`] ? errors[`contact-${index}-country`] : ''}
                      />

                      <FormInput
                        label="Postal / ZIP Code"
                        name={`contact-${index}-postalCode`}
                        required
                        value={contact.postalCode}
                        onChange={(e) => handleContactChange(index, 'postalCode', e.target.value)}
                        onBlur={() => handleBlur(index, 'postalCode')}
                        placeholder="e.g., 10001"
                        error={touched[`contact-${index}-postalCode`] ? errors[`contact-${index}-postalCode`] : ''}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Another Button */}
            <button
              onClick={handleAddContact}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Another Emergency Contact</span>
            </button>
          </>
        )}
      </div>

      {/* Info Boxes */}
      <div className="space-y-4">
        {/* Important Information */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                Critical Safety Information
              </h3>
              <p className="text-sm text-red-800 mb-2">
                Emergency contact information is vital for your safety at sea. This information will be used to contact your family in case of:
              </p>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Medical emergencies requiring family notification</li>
                <li>Serious accidents or incidents onboard</li>
                <li>Repatriation arrangements</li>
                <li>Any situation requiring immediate family contact</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Best Practices
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Provide at least 2 emergency contacts when possible</li>
                <li>Designate one person as your primary contact</li>
                <li>Ensure all phone numbers include country codes</li>
                <li>Keep this information up-to-date at all times</li>
                <li>Inform your contacts that they are listed as emergency contacts</li>
                <li>Verify all contact details are current before sailing</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-1">
                Privacy & Confidentiality
              </h3>
              <p className="text-sm text-green-800">
                Emergency contact information is kept strictly confidential and will only be used in genuine emergency situations or as required by maritime regulations. This information is stored securely and only accessible to authorized personnel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}