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
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      {/* Date Input */}
      <input
        ref={ref}
        type="date"
        className={`applicant-field__input ${
 error
 ? 'border-danger-line focus:border-danger focus:ring-danger/40'
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
          <span className="text-danger">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormDatePicker.displayName = 'FormDatePicker'

export default FormDatePicker
