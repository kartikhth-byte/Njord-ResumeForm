import { useMemo, useState } from 'react'
import { Calendar, Filter, SlidersHorizontal } from 'lucide-react'
import { RANK_OPTIONS } from '../utils/rankOptions'
import { VESSEL_TYPE_OPTIONS } from '../utils/vesselOptions'

const COMMON_NATIONALITIES = [
  'indian', 'filipino', 'chinese', 'indonesian', 'russian', 'ukrainian',
  'romanian', 'polish', 'burmese', 'turkish', 'bangladeshi', 'greek',
  'croatian', 'bulgarian', 'egyptian'
]

const EXPERIENCE_OPTIONS = [
  { value: '0-2', label: '0-2 years' },
  { value: '3-5', label: '3-5 years' },
  { value: '6-10', label: '6-10 years' },
  { value: '10+', label: '10+ years' }
]

const CERTIFICATE_OPTIONS = [
  'Master',
  'Chief Officer',
  'Second Officer',
  'Third Officer',
  'Chief Engineer',
  'Second Engineer',
  'Third Engineer',
  'Fourth Engineer'
]

const AVAILABILITY_OPTIONS = [
  { value: 'now', label: 'Available Now' },
  { value: '30', label: 'Within 30 days' },
  { value: '60', label: 'Within 60 days' },
  { value: '90', label: 'Within 90 days' }
]

const AGE_OPTIONS = [
  { value: '20-30', label: '20-30 years' },
  { value: '31-40', label: '31-40 years' },
  { value: '41-50', label: '41-50 years' },
  { value: '50+', label: '50+ years' }
]

const VISA_OPTIONS = ['C1/D (USA)', 'Schengen', 'UK', 'Canada', 'Australia', 'Singapore', 'Japan', 'South Korea', 'UAE']
const FLAG_OPTIONS = ['Panama', 'Liberia', 'Marshall Islands', 'Singapore', 'Hong Kong', 'Bahamas', 'Malta', 'Cyprus', 'Isle of Man', 'Antigua and Barbuda']
const COMPLIANCE_STATUS_OPTIONS = [
  { value: 'red', label: 'Red' },
  { value: 'amber', label: 'Amber' },
  { value: 'green', label: 'Green' },
]

const LABELS = {
  position: 'Rank',
  vesselType: 'Vessel',
  nationality: 'Nationality',
  experienceRange: 'Experience',
  certificateGrade: 'Certificate',
  visaType: 'Visa',
  flagState: 'Flag State',
  complianceStatus: 'Compliance',
  availability: 'Availability',
  ageRange: 'Age',
  dateRange: 'Date'
}

export default function ApplicationFilters({ onFilterChange, onApplyFilters, activeFilters = {} }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const fieldClass = 'h-11 w-full rounded-card border border-line-input bg-surface px-4 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30'

  const updateFilter = (key, value) => {
    const next = { ...activeFilters, [key]: value }
    if (!value || (typeof value === 'object' && !value.from && !value.to)) {
      delete next[key]
    }
    onFilterChange(next)
  }

  const clearAll = () => {
    onFilterChange({})
    onApplyFilters?.({})
  }

  const activeCount = Object.keys(activeFilters).filter(key => activeFilters[key]).length
  const chips = useMemo(() => {
    return Object.entries(activeFilters)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => {
        const text = typeof value === 'object'
          ? `${value.from || 'Any'} to ${value.to || 'Any'}`
          : value

        return { key, label: `${LABELS[key] || key}: ${text}` }
      })
  }, [activeFilters])

  return (
    <div className="space-y-4">
      <div className="recruiter-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsExpanded(prev => !prev)}
              className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-secondary transition hover:border-line-input hover:bg-raised"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {isExpanded ? 'Less filters' : 'More filters'}
              {activeCount > 0 ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-text">{activeCount}</span> : null}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={clearAll}
              disabled={activeCount === 0}
              className="workspace-action-button workspace-action-button--secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onApplyFilters?.()}
              className="workspace-action-button workspace-action-button--primary"
            >
              <Filter className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={activeFilters.position || ''} onChange={event => updateFilter('position', event.target.value)} className={fieldClass}>
            <option value="">Rank</option>
            {RANK_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          <select value={activeFilters.vesselType || ''} onChange={event => updateFilter('vesselType', event.target.value)} className={fieldClass}>
            <option value="">Vessel Type</option>
            {VESSEL_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>

          <select value={activeFilters.nationality || ''} onChange={event => updateFilter('nationality', event.target.value)} className={fieldClass}>
            <option value="">Nationality</option>
            {COMMON_NATIONALITIES.map(option => <option key={option} value={option}>{option}</option>)}
          </select>

          <select value={activeFilters.experienceRange || ''} onChange={event => updateFilter('experienceRange', event.target.value)} className={fieldClass}>
            <option value="">Experience</option>
            {EXPERIENCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        {chips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map(chip => (
              <button key={chip.key} type="button" onClick={() => updateFilter(chip.key, null)} className="workspace-chip">
                <span>{chip.label}</span>
                <span className="workspace-chip__remove">×</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="recruiter-panel recruiter-panel--muted p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <select value={activeFilters.certificateGrade || ''} onChange={event => updateFilter('certificateGrade', event.target.value)} className={fieldClass}>
              <option value="">Certificate</option>
              {CERTIFICATE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>

            <select value={activeFilters.visaType || ''} onChange={event => updateFilter('visaType', event.target.value)} className={fieldClass}>
              <option value="">Visa Type</option>
              {VISA_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>

            <select value={activeFilters.flagState || ''} onChange={event => updateFilter('flagState', event.target.value)} className={fieldClass}>
              <option value="">Flag State</option>
              {FLAG_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>

            <select value={activeFilters.complianceStatus || ''} onChange={event => updateFilter('complianceStatus', event.target.value)} className={fieldClass}>
              <option value="">Compliance</option>
              {COMPLIANCE_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <select value={activeFilters.availability || ''} onChange={event => updateFilter('availability', event.target.value)} className={fieldClass}>
              <option value="">Availability</option>
              {AVAILABILITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <select value={activeFilters.ageRange || ''} onChange={event => updateFilter('ageRange', event.target.value)} className={fieldClass}>
              <option value="">Age Range</option>
              {AGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <div className="rounded-control border border-line-input bg-surface px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-fg-secondary">
                <Calendar className="h-4 w-4 text-fg-muted" />
                Date range
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={activeFilters.dateRange?.from || ''}
                  onChange={event => updateFilter('dateRange', { ...activeFilters.dateRange, from: event.target.value })}
                  className="rounded-control border border-line-input px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
                <input
                  type="date"
                  value={activeFilters.dateRange?.to || ''}
                  onChange={event => updateFilter('dateRange', { ...activeFilters.dateRange, to: event.target.value })}
                  className="rounded-control border border-line-input px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
