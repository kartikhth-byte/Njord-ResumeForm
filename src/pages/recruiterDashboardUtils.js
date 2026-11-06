export function buildLookupMap(rows = []) {
  return rows.reduce((acc, row) => {
    if (row?.id) {
      acc[row.id] = row
    }
    return acc
  }, {})
}

export function getLookupName(map, id, fallback = 'Unknown') {
  if (!id) return fallback
  return map?.[id]?.name || fallback
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDate(value, options = {}) {
  if (!value) return 'Not set'
  // Date-only strings (DB `date` columns like requirements.date_opened) must
  // be parsed as local dates; `new Date('YYYY-MM-DD')` is UTC midnight and
  // renders the previous day in UTC-negative timezones.
  let date
  const match = typeof value === 'string' ? DATE_ONLY_PATTERN.exec(value.trim()) : null
  if (match) {
    date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  } else {
    date = new Date(value)
  }
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function formatDateTime(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  const diffMs = date.getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    if (Math.abs(diffHours) < 1) {
      const diffMinutes = Math.round(diffMs / (1000 * 60))
      return diffMinutes === 0 ? 'just now' : `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) === 1 ? '' : 's'} ${diffMinutes > 0 ? 'from now' : 'ago'}`
    }
    return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? '' : 's'} ${diffHours > 0 ? 'from now' : 'ago'}`
  }
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ${diffDays > 0 ? 'from now' : 'ago'}`
}

const makeStatusMeta = (label, className) => ({ label, className })

export const PROSPECT_STATUS_META = {
  open: makeStatusMeta('Open', 'bg-accent-soft text-accent-text'),
  contacted: makeStatusMeta('Contacted', 'bg-accent-soft text-accent-text'),
  approved: makeStatusMeta('Approved', 'bg-success-soft text-success'),
  rejected: makeStatusMeta('Rejected', 'bg-danger-soft text-danger'),
}

export const REQUIREMENT_STATUS_META = {
  open: makeStatusMeta('Open', 'bg-success-soft text-success'),
  closed: makeStatusMeta('Closed', 'bg-raised text-fg'),
  cancelled: makeStatusMeta('Cancelled', 'bg-danger-soft text-danger'),
}

export const JUNCTION_STATUS_META = {
  shortlisted: makeStatusMeta('Shortlisted', 'bg-accent-soft text-accent-text'),
  submitted_to_customer: makeStatusMeta('Submitted', 'bg-accent-soft text-accent-text'),
  customer_reviewing: makeStatusMeta('Customer Reviewing', 'bg-progress-soft text-progress'),
  customer_accepted: makeStatusMeta('Customer Accepted', 'bg-success-soft text-success'),
  customer_rejected: makeStatusMeta('Customer Rejected', 'bg-danger-soft text-danger'),
  joined: makeStatusMeta('Joined', 'bg-success-soft text-success'),
  withdrawn: makeStatusMeta('Withdrawn', 'bg-raised text-fg'),
}

export function getStatusMeta(map, status) {
  return map?.[status] || makeStatusMeta(status || 'Unknown', 'bg-raised text-fg')
}

export function safeList(rows) {
  return Array.isArray(rows) ? rows : []
}
