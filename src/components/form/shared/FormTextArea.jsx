import { forwardRef } from 'react'

const FormTextArea = forwardRef(({ 
  label, 
  error, 
  required = false,
  helpText,
  rows = 4,
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

      {/* Textarea */}
      <textarea
        ref={ref}
        rows={rows}
        className={`applicant-field__input resize-y ${
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

FormTextArea.displayName = 'FormTextArea'

export default FormTextArea
