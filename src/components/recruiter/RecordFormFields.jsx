// Form fields shared by the requirement and candidate forms (moved from the old Workspace page).

export function TextField({ label, value, onChange, placeholder = '', type = 'text', required = false }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-fg-secondary">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-control border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </label>
  )
}

export function SelectField({ label, value, onChange, options, placeholder = 'Select an option', required = false }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-fg-secondary">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-control border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TextAreaField({ label, value, onChange, placeholder = '', rows = 4 }) {
  return (
    <label className="space-y-2 text-sm">
      <span className="block font-medium text-fg-secondary">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-control border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </label>
  )
}

export function ToggleField({ label, checked, onChange, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-line-input text-accent-text focus:ring-accent"
      />
      <span>
        <span className="block font-medium text-fg">{label}</span>
        {description ? <span className="block text-xs text-fg-muted">{description}</span> : null}
      </span>
    </label>
  )
}
