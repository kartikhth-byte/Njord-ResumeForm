import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { registerListSessionCache } from '../lib/listSessionCache'

const CACHE_MAX_AGE_MS = 60_000
const workCache = registerListSessionCache(new Map())
const EMPTY_WORK = { assignments: [], history: [], credits: [], loading: true, refreshing: false, error: '' }

export async function loadWorkRows(table) {
  const rows = []
  for (let start = 0; ; start += 1000) {
    let query = supabase.from(table).select('*').order(table === 'recruitment_work_assignments' ? 'case_id' : table === 'recruitment_task_credits' ? 'event_id' : 'id')
    if (table === 'recruitment_work_assignments') query = query.order('task_key')
    const { data, error } = await query.range(start, start + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

export default function useRecruitmentWork(enabled = true) {
  const { user, session } = useAuth()
  const cacheKey = user?.id && session?.expires_at ? `${user.id}:${session.expires_at}` : null
  const [state, setState] = useState({ ...EMPTY_WORK, key: null })
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!enabled || !cacheKey) return undefined
    let cancelled = false
    const cached = workCache.get(cacheKey)
    const freshCache = cached && Date.now() - cached.at < CACHE_MAX_AGE_MS
    setState(previous => freshCache
      ? { ...cached.data, key: cacheKey, loading: false, refreshing: true, error: '' }
      : previous.key === cacheKey && !previous.loading
        ? { ...previous, refreshing: true, error: '' }
        : { ...EMPTY_WORK, key: cacheKey })
    Promise.all(['recruitment_work_assignments', 'recruitment_work_history', 'recruitment_task_credits'].map(loadWorkRows))
      .then(([assignments, history, credits]) => {
        if (cancelled) return
        const data = { assignments, history, credits }
        workCache.set(cacheKey, { data, at: Date.now() })
        if (workCache.size > 16) workCache.delete(workCache.keys().next().value)
        setState({ ...data, key: cacheKey, loading: false, refreshing: false, error: '' })
      })
      .catch(error => {
        if (!cancelled) setState(previous => ({ ...previous, key: cacheKey, loading: false, refreshing: false, error: error.message }))
      })
    return () => { cancelled = true }
  }, [enabled, cacheKey, revision])

  const reload = useCallback(() => setRevision(value => value + 1), [])
  return { ...(state.key === cacheKey ? state : EMPTY_WORK), reload }
}
