export default function SegmentedControl({ options = [], value, onChange, size = 'md' }) {
  return (
    <div className={`segmented-control segmented-control--${size}`} role="tablist">
      {options.map(option => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`segmented-control__button ${active ? 'is-active' : ''}`}
          >
            {option.icon ? <option.icon className="segmented-control__icon" /> : null}
            <span>{option.label}</span>
            {typeof option.count === 'number' ? (
              <span className="segmented-control__count">{option.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
