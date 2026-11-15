import { useEffect, useRef } from 'react'

// Shared lists revalidate when a recruiter returns from another tab or app.
// The interval avoids duplicate reads from a focus + visibility event pair.
export default function useRefreshOnFocus(refresh, enabled = true) {
  const refreshRef = useRef(refresh)
  const lastRefreshRef = useRef(Date.now())
  refreshRef.current = refresh

  useEffect(() => {
    if (!enabled) return undefined
    const revalidate = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefreshRef.current < 30_000) return
      lastRefreshRef.current = Date.now()
      refreshRef.current()
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [enabled])
}
