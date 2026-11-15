import { useState } from 'react'

export default function SearchableFilterSelect({ label, value, onChange, options, placeholder = 'All', className = 'flex flex-col gap-1 text-sm', selectClassName = '', unavailableLabel = 'Unavailable selection' }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase()
  const selected = options.find(option => option.value === value)
  const matches = needle ? options.filter(option => String(option.label || '').toLocaleLowerCase().includes(needle)) : options
  const visible = selected && !matches.some(option => option.value === value) ? [selected, ...matches] : matches

  return <label className={className}>{label}
    <input type="search" aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} className={selectClassName} />
    <select aria-label={label} className={selectClassName} value={value} onChange={event => { onChange(event.target.value); setQuery('') }}>
      <option value="">{placeholder}</option>
      {value && !selected && <option value={value}>{unavailableLabel}</option>}
      {visible.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
}
