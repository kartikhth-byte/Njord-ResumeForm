import { useState } from 'react'

// Top 50 countries by maritime workforce
const COUNTRY_CODES = [
  { code: '91', country: 'India', flag: '🇮🇳' },
  { code: '86', country: 'China', flag: '🇨🇳' },
  { code: '63', country: 'Philippines', flag: '🇵🇭' },
  { code: '62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '7', country: 'Russia', flag: '🇷🇺' },
  { code: '380', country: 'Ukraine', flag: '🇺🇦' },
  { code: '1', country: 'United States', flag: '🇺🇸' },
  { code: '44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '81', country: 'Japan', flag: '🇯🇵' },
  { code: '82', country: 'South Korea', flag: '🇰🇷' },
  { code: '49', country: 'Germany', flag: '🇩🇪' },
  { code: '33', country: 'France', flag: '🇫🇷' },
  { code: '39', country: 'Italy', flag: '🇮🇹' },
  { code: '34', country: 'Spain', flag: '🇪🇸' },
  { code: '31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '47', country: 'Norway', flag: '🇳🇴' },
  { code: '46', country: 'Sweden', flag: '🇸🇪' },
  { code: '45', country: 'Denmark', flag: '🇩🇰' },
  { code: '358', country: 'Finland', flag: '🇫🇮' },
  { code: '48', country: 'Poland', flag: '🇵🇱' },
  { code: '30', country: 'Greece', flag: '🇬🇷' },
  { code: '90', country: 'Turkey', flag: '🇹🇷' },
  { code: '20', country: 'Egypt', flag: '🇪🇬' },
  { code: '27', country: 'South Africa', flag: '🇿🇦' },
  { code: '234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '55', country: 'Brazil', flag: '🇧🇷' },
  { code: '52', country: 'Mexico', flag: '🇲🇽' },
  { code: '54', country: 'Argentina', flag: '🇦🇷' },
  { code: '56', country: 'Chile', flag: '🇨🇱' },
  { code: '61', country: 'Australia', flag: '🇦🇺' },
  { code: '64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '65', country: 'Singapore', flag: '🇸🇬' },
  { code: '60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '66', country: 'Thailand', flag: '🇹🇭' },
  { code: '84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '98', country: 'Iran', flag: '🇮🇷' },
  { code: '971', country: 'UAE', flag: '🇦🇪' },
  { code: '966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '974', country: 'Qatar', flag: '🇶🇦' },
  { code: '965', country: 'Kuwait', flag: '🇰🇼' },
  { code: '968', country: 'Oman', flag: '🇴🇲' },
  { code: '973', country: 'Bahrain', flag: '🇧🇭' },
  { code: '351', country: 'Portugal', flag: '🇵🇹' },
  { code: '32', country: 'Belgium', flag: '🇧🇪' },
  { code: '41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '43', country: 'Austria', flag: '🇦🇹' },
  { code: '420', country: 'Czech Republic', flag: '🇨🇿' },
]

export default function PhoneInput({ 
  label, 
  required = false, 
  countryCode = '', 
  phoneNumber = '', 
  onChange,
  error = '',
  helpText = ''
}) {
  const [selectedCountryCode, setSelectedCountryCode] = useState(countryCode || '91')
  const [number, setNumber] = useState(phoneNumber || '')

  const handleCountryCodeChange = (e) => {
    const newCode = e.target.value
    setSelectedCountryCode(newCode)
    onChange(newCode, number)
  }

  const handleNumberChange = (e) => {
    const newNumber = e.target.value.replace(/\D/g, '') // Only digits
    setNumber(newNumber)
    onChange(selectedCountryCode, newNumber)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-fg-secondary mb-1">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      
      <div className="flex gap-2">
        {/* Country Code Dropdown */}
        <select
          value={selectedCountryCode}
          onChange={handleCountryCodeChange}
          className="w-32 px-3 py-2 border border-line-input rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
        >
          {COUNTRY_CODES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} +{country.code}
            </option>
          ))}
        </select>

        {/* Phone Number Input */}
        <input
          type="tel"
          value={number}
          onChange={handleNumberChange}
          placeholder="5551234567"
          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${
 error ? 'border-danger' : 'border-line-input'
 }`}
        />
      </div>

      {/* Help Text */}
      {helpText && !error && (
        <p className="mt-1 text-sm text-fg-muted">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-danger">{error}</p>
      )}
    </div>
  )
}