import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Simple module-level cache: the recruiter list is small and stable within a
// session, and this control appears wherever recruiters record input.
let recruitersCache = null

/**
 * Selector for the recruiter currently handling an application. Every stage
 * of the pipeline can be worked by a different recruiter; this value feeds
 * the KPI dashboard's per-recruiter workload reporting.
 */
export default function HandledBySelect({
  applicationId,
  value,
  onChanged,
  disabled = false,
  showLabel = false,
  className = '',
}) {
  const [recruiters, setRecruiters] = useState(recruitersCache || [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (recruitersCache) return undefined
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('user_type', 'recruiter')
      .order('full_name')
      .then(({ data, error }) => {
        if (cancelled || error) return
        recruitersCache = data || []
        setRecruiters(recruitersCache)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = async (event) => {
    const recruiterId = event.target.value
    setSaving(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({ handling_recruiter_id: recruiterId || null })
        .eq('id', applicationId)
      if (error) throw error
      onChanged?.(recruiterId || null)
    } catch (updateError) {
      console.error('Failed to update handling recruiter:', updateError)
      alert(`Could not update the handling recruiter${updateError?.message ? `: ${updateError.message}` : ''}`)
    } finally {
      setSaving(false)
    }
  }

  const select = (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || saving}
      className={`rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 ${className}`}
    >
      <option value="">Unassigned</option>
      {recruiters.map((recruiter) => (
        <option key={recruiter.id} value={recruiter.id}>
          {recruiter.full_name || recruiter.email}
        </option>
      ))}
    </select>
  )

  if (!showLabel) return select

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-xs font-medium text-slate-500">Handled by</span>
      {select}
    </label>
  )
}
