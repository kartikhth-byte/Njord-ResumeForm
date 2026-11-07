import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// A native modal keeps the tracker inert and traps focus, including long forms.
export default function RecordFormDialog({ title, busy = false, onClose, children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    const trapTab = (event) => {
      if (event.key !== 'Tab') return
      const nodes = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter((node) => node.getClientRects().length > 0)
      const first = nodes[0]
      const last = nodes.at(-1)
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', trapTab, true)
    return () => {
      document.removeEventListener('keydown', trapTab, true)
      dialog.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  return createPortal(
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-busy={busy}
      className="m-auto max-h-[94dvh] w-[96vw] max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/70"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    >
      <div className="flex max-h-[94dvh] min-w-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {busy && <p role="status" className="mt-1 text-sm text-fg-secondary">Saving. Please wait…</p>}
          </div>
          <button type="button" disabled={busy} aria-label={`Close ${title.toLowerCase()}`} className="shrink-0 rounded-control p-2 hover:bg-raised focus-visible:outline focus-visible:outline-2 disabled:opacity-50" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>,
    document.body,
  )
}
