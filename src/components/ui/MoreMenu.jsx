import { useEffect, useRef } from 'react'
import { MoreVertical } from 'lucide-react'

// Small "More" menu for secondary or destructive actions.
// items: [{ label, onClick, danger?, disabled? }] (falsy items are skipped)
export default function MoreMenu({ items = [], label = 'More', disabled = false }) {
  const ref = useRef(null)
  const visible = items.filter(Boolean)

  useEffect(() => {
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) ref.current.removeAttribute('open')
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (visible.length === 0) return null

  return (
    <details ref={ref} className="relative">
      <summary
        className={`directory-actions__summary ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        aria-disabled={disabled}
        aria-label={`${label} actions`}
        title={`${label} actions`}
      >
        <MoreVertical aria-hidden="true" className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-[11rem] overflow-hidden rounded-card border border-line bg-surface py-1 shadow-lg" role="menu">
        {visible.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              ref.current?.removeAttribute('open')
              item.onClick()
            }}
            className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-raised disabled:opacity-50 ${item.danger ? 'text-danger' : 'text-fg'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  )
}
