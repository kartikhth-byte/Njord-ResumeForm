import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { registerListSessionCache } from '../lib/listSessionCache'

const CACHE_MAX_AGE_MS = 60_000
const fleetCache = registerListSessionCache(new Map())
const EMPTY_FLEET = { companies: [], ships: [], vesselTypes: [], loading: true, refreshing: false, error: '' }

// Stable reviewed identities. Never infer company ownership from old labels.
export default function useClientFleet({ includeArchived = false, includeVesselTypes = true, enabled = true } = {}) {
  const { user, session } = useAuth()
  const cacheKey = user?.id && session?.expires_at ? `${user.id}:${session.expires_at}:${includeArchived}:${includeVesselTypes}` : null
  const [state, setState] = useState({ ...EMPTY_FLEET, key: null })
  const request = useRef(0)
  const reload = useCallback(async () => {
    if (!enabled || !cacheKey) return
    const current = ++request.current
    const cached = fleetCache.get(cacheKey)
    const freshCache = cached && Date.now() - cached.at < CACHE_MAX_AGE_MS
    setState(previous => freshCache
      ? { ...cached.data, key: cacheKey, loading: false, refreshing: true, error: '' }
      : previous.key === cacheKey && !previous.loading
        ? { ...previous, refreshing: true, error: '' }
        : { ...EMPTY_FLEET, key: cacheKey })
    try {
      const load = async (table, columns) => {
        const rows = []
        for (let start = 0; ; start += 1000) {
          let query = supabase.from(table).select(columns).order('name').order('id').range(start, start + 999)
          if (!includeArchived && table !== 'vessel_types') query = query.is('archived_at', null)
          const { data, error } = await query
          if (error) throw error
          rows.push(...(data || []))
          if (!data || data.length < 1000) return rows
        }
      }
      const [companies, ships, vesselTypes] = await Promise.all([
        load('client_companies', 'id,name,version,archived_at'),
        load('client_ships', 'id,name,company_id,imo,vessel_type_id,version,archived_at'),
        includeVesselTypes ? load('vessel_types', 'id,name') : Promise.resolve([]),
      ])
      if (current === request.current) {
        const data = { companies, ships, vesselTypes }
        fleetCache.set(cacheKey, { data, at: Date.now() })
        if (fleetCache.size > 16) fleetCache.delete(fleetCache.keys().next().value)
        setState({ ...data, key: cacheKey, loading: false, refreshing: false, error: '' })
      }
    } catch (error) {
      if (current === request.current) setState(prev => ({...prev, key: cacheKey, loading: false, refreshing: false, error: error.message || 'Could not load companies and ships.'}))
    }
  }, [includeArchived, includeVesselTypes, enabled, cacheKey])
  useEffect(() => { void reload(); return () => { request.current += 1 } }, [reload])
  return { ...(state.key === cacheKey ? state : EMPTY_FLEET), reload }
}
