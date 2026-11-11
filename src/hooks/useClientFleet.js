import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Stable reviewed identities. Never infer company ownership from old labels.
export default function useClientFleet({ includeArchived = false, enabled = true } = {}) {
  const [state, setState] = useState({companies: [], ships: [], vesselTypes: [], loading: true, error: ''})
  const request = useRef(0)
  const reload = useCallback(async () => {
    if (!enabled) return
    const current = ++request.current
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
        load('vessel_types', 'id,name'),
      ])
      if (current === request.current) setState({companies, ships, vesselTypes, loading: false, error: ''})
    } catch (error) {
      if (current === request.current) setState(prev => ({...prev, loading: false, error: error.message || 'Could not load companies and ships.'}))
    }
  }, [includeArchived, enabled])
  useEffect(() => { void reload(); return () => { request.current += 1 } }, [reload])
  return {...state, reload}
}
