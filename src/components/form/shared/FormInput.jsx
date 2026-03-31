import { forwardRef } from 'react'

const FormInput = forwardRef(({ 
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

      {/* Input */}
      <input
        ref={ref}
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

FormInput.displayName = 'FormInput'

export default FormInput
