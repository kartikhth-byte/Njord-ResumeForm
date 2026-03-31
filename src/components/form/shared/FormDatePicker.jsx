import { forwardRef } from 'react'

const FormDatePicker = forwardRef(({ 
  label, 
  error, 
  required = false,
  helpText,
  ...props 
}, ref) => {
  return (
    <div className="applicant-field">
      {/* Label */}
      {label && (
        <label className="applicant-field__label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Date Input */}
      <input
        ref={ref}
        type="date"
        className={`applicant-field__input ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : ''
        }`}
        {...props}
      />

      {/* Help Text */}
      {helpText && !error && (
        <p className="applicant-field__help">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="applicant-field__error">
          <span className="text-red-500">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormDatePicker.displayName = 'FormDatePicker'

export default FormDatePicker
