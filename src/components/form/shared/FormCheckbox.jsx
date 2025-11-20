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
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          ref={ref}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          className={`mt-1 w-4 h-4 rounded border-2 transition-colors cursor-pointer focus:ring-2 focus:ring-offset-2 ${
            error
              ? 'border-red-300 text-red-600 focus:ring-red-500'
              : 'border-gray-300 text-blue-600 focus:ring-blue-500'
          }`}
          {...props}
        />
        <span className="flex-1">
          <span className={`text-sm ${error ? 'text-red-900' : 'text-gray-700'}`}>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
          {helpText && (
            <span className="block text-xs text-gray-500 mt-1">{helpText}</span>
          )}
        </span>
      </label>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 flex items-start gap-1 ml-7">
          <span className="text-red-500">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormCheckbox.displayName = 'FormCheckbox'

export default FormCheckbox