import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../components/auth/AuthContext'
import { supabase } from '../lib/supabase'
import { registerListSessionCache } from '../lib/listSessionCache'
import { isCaseTableMissing } from '../utils/recruitmentCase'

const REQUIREMENT_COLUMNS = 'company_id, ship_id, location_reviewed_at, id, display_id, req_id_display, version, date_opened, date_closed, vessel_name, vessel_type_id, rank_id, positions_required, target_days, customer_name, status, closure_reason, owner_recruiter_id, created_by_recruiter_id, archived_at, deleted_at, created_at, updated_at'
const PROSPECT_COLUMNS = 'version, dob, needle_resume_id, id, display_id, name, email, telephone, lead_source, status, rank_applied_for_id, vessel_type_id, nationality_id, first_contacted_at, last_terminal_status, last_terminal_status_at, archived_at, deleted_at, invited_at, claimed_at, bounce_flag, created_by_recruiter_id, last_activity_at, created_at, updated_at'
const JUNCTION_COLUMNS = 'id, prospect_id, requirement_id, status, submitted_at, customer_decided_at, joined_at, withdrawn_at, withdrawal_reason, assigned_by_recruiter_id, last_transition_by_recruiter_id, created_at, updated_at'
const APPLICATION_COLUMNS = 'id, display_id, prospect_id, user_id, applied_rank, status, submitted_at, reference_number, handling_recruiter_id, contract_end_date, created_at, updated_at'

const DATASETS = {
  requirements: new Set(['ranks', 'vesselTypes', 'recruiters', 'requirements', 'junctions', 'requirementRemarks', 'cases']),
  candidates: new Set(['ranks', 'vesselTypes', 'recruiters', 'requirements', 'prospects', 'junctions', 'applications', 'prospectNotes', 'cases', 'caseEvents']),
  recruitment: new Set(['recruiters', 'requirements', 'prospects', 'cases', 'caseEvents']),
}
const ALL_DATASETS = new Set(['ranks', 'vesselTypes', 'recruiters', 'requirements', 'prospects', 'junctions', 'applications', 'requirementRemarks', 'prospectNotes', 'scheduledEvents', 'cases', 'caseEvents'])
const trackerCache = registerListSessionCache(new Map())
const EMPTY_DATA = {
  ranks: [], vesselTypes: [], recruiters: [], requirements: [], prospects: [],
  junctions: [], applications: [], requirementRemarks: [], prospectNotes: [],
  scheduledEvents: [], cases: [], caseEvents: [], casesAvailable: false,
}

async function loadCaseRows(table, columns, orderColumn) {
  const rows = []
  for (let start = 0; ; start += 1000) {
    let query = supabase.from(table).select(columns).order(orderColumn, { ascending: false })
    if (orderColumn !== 'id') query = query.order('id')
    const result = await query.range(start, start + 999)
    if (result.error) return result
    rows.push(...(result.data || []))
    if ((result.data || []).length < 1000) return { data: rows, error: null }
  }
}

const normalizeRecruiterRows = (rows = []) =>
  rows.map((item) => ({
    ...item,
    role_name: item.user_roles?.[0]?.roles?.name || '',
  }))

/**
 * Shared loader for the KPI tracker surfaces. List pages fetch only the
 * datasets they use; Dashboard and KPI retain the complete snapshot.
 */
export default function useKpiTrackerData({ enabled = true, scope = 'all' } = {}) {
  const { user, session } = useAuth()
  const cacheKey = user?.id && session?.expires_at ? `${user.id}:${session.expires_at}:${scope}` : null
  const datasets = DATASETS[scope] || ALL_DATASETS
  const [reloadToken, setReloadToken] = useState(0)
  const [snapshot, setSnapshot] = useState({ key: null, loading: true, refreshing: false, error: '', data: EMPTY_DATA })

  useEffect(() => {
    if (!enabled || !cacheKey) return undefined
    let cancelled = false
    const cached = trackerCache.get(cacheKey)
    setSnapshot(previous => cached
      ? { key: cacheKey, loading: false, refreshing: true, error: '', data: cached.data }
      : previous.key === cacheKey && !previous.loading
        ? { ...previous, refreshing: true, error: '' }
        : { key: cacheKey, loading: true, refreshing: false, error: '', data: EMPTY_DATA })

    const load = async () => {
      try {
        const read = (key, query) => datasets.has(key) ? query() : Promise.resolve({ data: [], error: null })
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
          casesResult,
          caseEventsResult,
        ] = await Promise.all([
          read('ranks', () => supabase.from('ranks').select('id, code, name').order('name')),
          read('vesselTypes', () => supabase.from('vessel_types').select('id, code, name').order('name')),
          read('recruiters', () => supabase
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
            .order('full_name')),
          read('requirements', () => loadCaseRows('requirements', REQUIREMENT_COLUMNS, 'date_opened')),
          read('prospects', () => loadCaseRows('prospects', PROSPECT_COLUMNS, 'id')),
          read('junctions', () => supabase.from('prospect_requirements').select(JUNCTION_COLUMNS).order('updated_at', { ascending: false })),
          read('applications', () => supabase.from('applications').select(APPLICATION_COLUMNS).order('updated_at', { ascending: false })),
          read('requirementRemarks', () => supabase.from('requirement_remarks').select('id, requirement_id, body, created_at').order('created_at', { ascending: false }).limit(1000)),
          read('prospectNotes', () => supabase.from('prospect_notes').select('id, prospect_id, body, created_at').order('created_at', { ascending: false }).limit(1000)),
          read('scheduledEvents', () => supabase
            .from('scheduled_events')
            .select('id, event_type, event_title, platform, scheduled_date, scheduled_time, status, application_id, scheduled_by')
            .gte('scheduled_date', new Date().toISOString().slice(0, 10))
            .order('scheduled_date', { ascending: true })
            .limit(30)),
          read('cases', () => loadCaseRows('recruitment_cases', 'id, display_id, prospect_id, requirement_id, application_id, application:applications!recruitment_cases_application_id_fkey(submitted_at), cycle, status, source, created_at, updated_at, version', 'updated_at')),
          read('caseEvents', () => loadCaseRows('recruitment_case_events', 'id, case_id, event_type, from_status, to_status, actor_id, payload, created_at', 'created_at')),
        ])

        if (cancelled) return

        const rowsOrThrow = (result) => {
          if (result.error) throw result.error
          return result.data || []
        }
        const casesMissing = casesResult.error && isCaseTableMissing(casesResult.error)
        const eventsMissing = caseEventsResult.error && (['42P01', 'PGRST205'].includes(caseEventsResult.error.code))
        if (!(casesMissing && (!datasets.has('caseEvents') || eventsMissing)) && (casesResult.error || caseEventsResult.error)) {
          throw casesResult.error || caseEventsResult.error
        }
        const casesAvailable = datasets.has('cases') && !casesResult.error && !caseEventsResult.error

        const data = {
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
          cases: casesAvailable ? casesResult.data || [] : [],
          caseEvents: casesAvailable ? caseEventsResult.data || [] : [],
          casesAvailable,
        }
        trackerCache.set(cacheKey, { data })
        if (trackerCache.size > 16) trackerCache.delete(trackerCache.keys().next().value)
        setSnapshot({ key: cacheKey, loading: false, refreshing: false, error: '', data })
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load KPI tracker data:', loadError)
        setSnapshot(previous => ({ ...previous, key: cacheKey, loading: false, refreshing: false, error: loadError?.message || 'Failed to load tracker data' }))
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken, datasets, cacheKey])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return snapshot.key === cacheKey
    ? { loading: snapshot.loading, refreshing: snapshot.refreshing, error: snapshot.error, reload, data: snapshot.data }
    : { loading: true, refreshing: false, error: '', reload, data: EMPTY_DATA }
}
