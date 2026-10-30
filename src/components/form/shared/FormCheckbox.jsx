import { forwardRef } from 'react'

const FormCheckbox = forwardRef(({ 
  label, 
  error, 
  required = false,
  helpText,
  checked = false,
  onChange,
  name,
  ...props 
}, ref) => {
  return (
    <div className="space-y-1.5">
      {/* Checkbox with Label */}
      <label className="applicant-toggle-card cursor-pointer group">
        <input
          ref={ref}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          className={`mt-1 w-4 h-4 rounded border-2 transition-colors cursor-pointer focus:ring-2 focus:ring-offset-2 ${
 error
 ? 'border-danger-line text-danger focus:ring-danger/40'
 : 'border-line-input text-accent-text focus:ring-accent'
 }`}
          {...props}
        />
        <span className="flex-1">
          <span className={`applicant-toggle-card__title ${error ? 'text-danger' : ''}`}>
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </span>
          {helpText && (
            <span className="applicant-toggle-card__copy block">{helpText}</span>
          )}
        </span>
      </label>

      {/* Error Message */}
      {error && (
        <p className="applicant-field__error ml-7">
          <span className="text-danger">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormCheckbox.displayName = 'FormCheckbox'

export default FormCheckbox
