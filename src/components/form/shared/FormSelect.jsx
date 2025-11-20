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
    <div className="space-y-1.5">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Select */}
      <select
        ref={ref}
        className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 appearance-none bg-white ${
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
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
        <p className="text-xs text-gray-500">{helpText}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 flex items-start gap-1">
          <span className="text-red-500">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
})

FormSelect.displayName = 'FormSelect'

export default FormSelect