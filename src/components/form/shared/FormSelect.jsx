import { forwardRef } from 'react'

const FormSelect = forwardRef(({ 
  label, 
  error, 
  required = false,
  options = [],
  placeholder = 'Select an option',
  helpText,
  ...props 
}, ref) => {
  return (
    <div className="applicant-field">
      {/* Label */}
      {label && (
        <label className="applicant-field__label">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      {/* Select */}
      <select
        ref={ref}
        className={`applicant-field__input appearance-none ${
 error
 ? 'border-danger-line focus:border-danger focus:ring-danger/40'
 : ''
 }`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Help Text */}
      {helpText && !error && (
        <p className="applicant-field__help">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="applicant-field__error">
          <span className="text-danger">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormSelect.displayName = 'FormSelect'

export default FormSelect
