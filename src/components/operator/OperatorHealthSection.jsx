import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { NEEDLE_BASE } from '../../lib/needle'

// Needle reachability through Holmes's /ai forwarding rule.
export default function OperatorHealthSection() {
  const [state, setState] = useState({ loading: true, ok: false, detail: '' })

  const check = useCallback(async () => {
    setState({ loading: true, ok: false, detail: '' })
    try {
      const response = await fetch(`${NEEDLE_BASE}/healthz`, { credentials: 'same-origin' })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.ok) {
        setState({ loading: false, ok: false, detail: `Answered ${response.status}` })
        return
      }
      const hydrate = body.hydrate?.status || 'unknown'
      setState({ loading: false, ok: true, detail: `Corpus cache: ${hydrate}` })
    } catch {
      setState({ loading: false, ok: false, detail: 'Not reachable at /ai' })
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-slate-900">AI search (Needle)</div>
        <div className="text-sm text-slate-500">{state.loading ? 'Checking…' : state.detail}</div>
      </div>
      <div className="flex items-center gap-3">
        {state.loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
        ) : (
          <span className={`text-sm font-medium ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {state.ok ? 'Up' : 'Down'}
          </span>
        )}
        <button
          type="button"
          onClick={check}
          disabled={state.loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Check
        </button>
      </div>
    </div>
  )
}
