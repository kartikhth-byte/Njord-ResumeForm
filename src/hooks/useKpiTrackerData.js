import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const REQUIREMENT_COLUMNS = 'id, req_id_display, date_opened, date_closed, vessel_name, vessel_type_id, rank_id, positions_required, target_days, customer_name, status, closure_reason, owner_recruiter_id, created_by_recruiter_id, archived_at, deleted_at, created_at, updated_at'
const PROSPECT_COLUMNS = 'id, name, email, telephone, lead_source, status, rank_applied_for_id, vessel_type_id, nationality_id, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, deleted_at, invited_at, claimed_at, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at'
const JUNCTION_COLUMNS = 'id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at'
const APPLICATION_COLUMNS = 'id, prospect_id, user_id, applied_rank, status, submitted_at, reference_number, handling_recruiter_id, contract_end_date, created_at, updated_at'

const normalizeRecruiterRows = (rows = []) =>
  rows.map((item) => ({
    ...item,
    role_name: item.user_roles?.[0]?.roles?.name || '',
  }))

/**
 * Shared loader for the KPI tracker surfaces (Dashboard, Requirements,
 * Candidates). Every derived figure on those pages is computed from this
 * one live snapshot so the three views always agree with each other.
 */
export default function useKpiTrackerData({ enabled = true } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [data, setData] = useState({
    ranks: [],
    vesselTypes: [],
    recruiters: [],
    requirements: [],
    prospects: [],
    junctions: [],
    applications: [],
    requirementRemarks: [],
    prospectNotes: [],
    scheduledEvents: [],
  })

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          ranksResult,
          vesselTypesResult,
          recruitersResult,
          requirementsResult,
          prospectsResult,
          junctionsResult,
          applicationsResult,
          remarksResult,
          notesResult,
          eventsResult,
        ] = await Promise.all([
          supabase.from('ranks').select('id, code, name').order('name'),
          supabase.from('vessel_types').select('id, code, name').order('name'),
          supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              email,
              user_type,
              user_roles!user_roles_user_id_fkey(
                role_id,
                roles!inner(
                  id,
                  name
                )
              )
            `)
            .eq('user_type', 'recruiter')
            .order('full_name'),
          supabase.from('requirements').select(REQUIREMENT_COLUMNS).order('date_opened', { ascending: false }),
          supabase.from('prospects').select(PROSPECT_COLUMNS).order('last_activity_at', { ascending: false }),
          supabase.from('prospect_requirements').select(JUNCTION_COLUMNS).order('updated_at', { ascending: false }),
          supabase.from('applications').select(APPLICATION_COLUMNS).order('updated_at', { ascending: false }),
          supabase.from('requirement_remarks').select('id, requirement_id, body, created_at').order('created_at', { ascending: false }).limit(1000),
          supabase.from('prospect_notes').select('id, prospect_id, body, created_at').order('created_at', { ascending: false }).limit(1000),
          supabase
            .from('scheduled_events')
            .select('id, event_type, event_title, platform, scheduled_date, scheduled_time, status, application_id')
            .gte('scheduled_date', new Date().toISOString().slice(0, 10))
            .order('scheduled_date', { ascending: true })
            .limit(30),
        ])

        if (cancelled) return

        const rowsOrThrow = (result) => {
          if (result.error) throw result.error
          return result.data || []
        }

        setData({
          ranks: rowsOrThrow(ranksResult),
          vesselTypes: rowsOrThrow(vesselTypesResult),
          recruiters: normalizeRecruiterRows(rowsOrThrow(recruitersResult)),
          requirements: rowsOrThrow(requirementsResult),
          prospects: rowsOrThrow(prospectsResult),
          junctions: rowsOrThrow(junctionsResult),
          applications: rowsOrThrow(applicationsResult),
          // Notes/remarks are display-only extras; do not fail the page on them.
          requirementRemarks: remarksResult.error ? [] : remarksResult.data || [],
          prospectNotes: notesResult.error ? [] : notesResult.data || [],
          scheduledEvents: eventsResult.error ? [] : eventsResult.data || [],
        })
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load KPI tracker data:', loadError)
        setError(loadError?.message || 'Failed to load tracker data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { loading, error, reload, data }
}
