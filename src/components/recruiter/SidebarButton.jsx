import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Portal labels outside the scrollable rail so the embedded app cannot clip them.
export default function SidebarButton({ label, rail, children, onClick, ...props }) {
  const [position, setPosition] = useState(null)
  const show = (event) => {
    if (!rail) return
    const rect = event.currentTarget.getBoundingClientRect()
    setPosition({ left: rect.right + 10, top: Math.max(24, Math.min(rect.top + rect.height / 2, window.innerHeight - 24)) })
  }

  useEffect(() => {
    if (!position) return
    const hide = () => setPosition(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [position])

  return (
    <>
      <button
        {...props}
        type="button"
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={() => setPosition(null)}
        onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) show(event) }}
        onBlur={() => setPosition(null)}
        onKeyDown={(event) => { if (event.key === 'Escape') setPosition(null) }}
        onClick={(event) => { setPosition(null); onClick?.(event) }}
      >
        {children}
      </button>
      {rail && position ? createPortal(
        <span role="tooltip" className="recruiter-sidebar__tooltip" style={position}>{label}</span>,
        document.body,
      ) : null}
    </>
  )
}
