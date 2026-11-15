import { forwardRef, useState } from 'react'

const FormSelect = forwardRef(({ 
  label, 
  error, 
  required = false,
  options = [],
  placeholder = 'Select an option',
  helpText,
  searchable = false,
  onChange,
  ...props 
}, ref) => {
  const [query, setQuery] = useState('')
  const matches = searchable && query.trim()
    ? options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : options
  const selected = options.find(option => option.value === props.value)
  const visibleOptions = selected && !matches.some(option => option.value === selected.value)
    ? [selected, ...matches]
    : matches
  return (
    <div className="applicant-field">
      {/* Label */}
      {label && (
        <label className="applicant-field__label">
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      {searchable && (
        <input
          type="search"
          aria-label={`Search ${label.toLowerCase()}`}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}`}
          className="applicant-field__input"
        />
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
        onChange={event => { onChange?.(event); setQuery('') }}
      >
        <option value="">{placeholder}</option>
        {visibleOptions.map((option) => (
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
