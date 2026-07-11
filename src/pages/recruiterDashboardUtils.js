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
  open: makeStatusMeta('Open', 'bg-blue-100 text-blue-800'),
  contacted: makeStatusMeta('Contacted', 'bg-sky-100 text-sky-800'),
  approved: makeStatusMeta('Approved', 'bg-emerald-100 text-emerald-800'),
  rejected: makeStatusMeta('Rejected', 'bg-rose-100 text-rose-800'),
}

export const REQUIREMENT_STATUS_META = {
  open: makeStatusMeta('Open', 'bg-emerald-100 text-emerald-800'),
  closed: makeStatusMeta('Closed', 'bg-slate-100 text-slate-800'),
  cancelled: makeStatusMeta('Cancelled', 'bg-rose-100 text-rose-800'),
}

export const JUNCTION_STATUS_META = {
  shortlisted: makeStatusMeta('Shortlisted', 'bg-blue-100 text-blue-800'),
  submitted_to_customer: makeStatusMeta('Submitted', 'bg-indigo-100 text-indigo-800'),
  customer_reviewing: makeStatusMeta('Customer Reviewing', 'bg-violet-100 text-violet-800'),
  customer_accepted: makeStatusMeta('Customer Accepted', 'bg-emerald-100 text-emerald-800'),
  customer_rejected: makeStatusMeta('Customer Rejected', 'bg-rose-100 text-rose-800'),
  joined: makeStatusMeta('Joined', 'bg-green-100 text-green-800'),
  withdrawn: makeStatusMeta('Withdrawn', 'bg-slate-100 text-slate-800'),
}

export function getStatusMeta(map, status) {
  return map?.[status] || makeStatusMeta(status || 'Unknown', 'bg-gray-100 text-gray-800')
}

export function safeList(rows) {
  return Array.isArray(rows) ? rows : []
}
