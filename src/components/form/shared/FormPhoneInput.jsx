import { forwardRef } from 'react'

const COUNTRY_CODES = [
  { value: '+1', label: '🇺🇸 +1', country: 'US/CA' },
  { value: '+44', label: '🇬🇧 +44', country: 'UK' },
  { value: '+91', label: '🇮🇳 +91', country: 'India' },
  { value: '+86', label: '🇨🇳 +86', country: 'China' },
  { value: '+81', label: '🇯🇵 +81', country: 'Japan' },
  { value: '+82', label: '🇰🇷 +82', country: 'S.Korea' },
  { value: '+65', label: '🇸🇬 +65', country: 'Singapore' },
  { value: '+971', label: '🇦🇪 +971', country: 'UAE' },
  { value: '+974', label: '🇶🇦 +974', country: 'Qatar' },
  { value: '+966', label: '🇸🇦 +966', country: 'Saudi' },
  { value: '+61', label: '🇦🇺 +61', country: 'Australia' },
  { value: '+64', label: '🇳🇿 +64', country: 'N.Zealand' },
  { value: '+33', label: '🇫🇷 +33', country: 'France' },
  { value: '+49', label: '🇩🇪 +49', country: 'Germany' },
  { value: '+39', label: '🇮🇹 +39', country: 'Italy' },
  { value: '+34', label: '🇪🇸 +34', country: 'Spain' },
  { value: '+31', label: '🇳🇱 +31', country: 'Netherlands' },
  { value: '+47', label: '🇳🇴 +47', country: 'Norway' },
  { value: '+46', label: '🇸🇪 +46', country: 'Sweden' },
  { value: '+45', label: '🇩🇰 +45', country: 'Denmark' },
  { value: '+351', label: '🇵🇹 +351', country: 'Portugal' },
  { value: '+30', label: '🇬🇷 +30', country: 'Greece' },
  { value: '+90', label: '🇹🇷 +90', country: 'Turkey' },
  { value: '+20', label: '🇪🇬 +20', country: 'Egypt' },
  { value: '+27', label: '🇿🇦 +27', country: 'S.Africa' },
  { value: '+234', label: '🇳🇬 +234', country: 'Nigeria' },
  { value: '+254', label: '🇰🇪 +254', country: 'Kenya' },
  { value: '+63', label: '🇵🇭 +63', country: 'Philippines' },
  { value: '+60', label: '🇲🇾 +60', country: 'Malaysia' },
  { value: '+66', label: '🇹🇭 +66', country: 'Thailand' },
  { value: '+84', label: '🇻🇳 +84', country: 'Vietnam' },
  { value: '+62', label: '🇮🇩 +62', country: 'Indonesia' },
  { value: '+880', label: '🇧🇩 +880', country: 'Bangladesh' },
  { value: '+92', label: '🇵🇰 +92', country: 'Pakistan' },
  { value: '+94', label: '🇱🇰 +94', country: 'Sri Lanka' },
]

const FormPhoneInput = forwardRef(({ 
  label, 
  error, 
  required = false,
  helpText,
  countryCode = '+91',
  phoneNumber = '',
  onCountryCodeChange,
  onPhoneNumberChange,
  name,
  onBlur,
  ...props 
}, ref) => {
  return (
    <div className="space-y-1.5">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-fg-secondary">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      {/* Input Group */}
      <div className="flex gap-2">
        {/* Country Code Dropdown */}
        <select
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
          className={`w-32 px-3 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 bg-surface ${
 error
 ? 'border-danger-line focus:border-danger focus:ring-danger/40'
 : 'border-line-input focus:border-accent focus:ring-accent'
 }`}
        >
          {COUNTRY_CODES.map((code) => (
            <option key={code.value} value={code.value}>
              {code.label}
            </option>
          ))}
        </select>

        {/* Phone Number Input */}
        <input
          ref={ref}
          type="tel"
          name={name}
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(e.target.value)}
          onBlur={onBlur}
          placeholder="9876543210"
          className={`flex-1 px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 ${
 error
 ? 'border-danger-line focus:border-danger focus:ring-danger/40'
 : 'border-line-input focus:border-accent focus:ring-accent'
 }`}
          {...props}
        />
      </div>

      {/* Help Text */}
      {helpText && !error && (
        <p className="text-xs text-fg-muted">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-danger flex items-start gap-1">
          <span className="text-danger">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormPhoneInput.displayName = 'FormPhoneInput'

export default FormPhoneInput