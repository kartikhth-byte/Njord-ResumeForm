export function dateCell(value) {
  if (!value) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function dateTimeCell(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function recordDisplayId(row, fallback = '') {
  return row?.display_id || fallback || '—'
}

export function latestRecordDate(...values) {
  const times = values.map(value => Date.parse(value)).filter(Number.isFinite)
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

// Reference data uses "Add" for additional ranks ("Add Chief Officer"), which
// reads like a button label. Show the full word; stored values stay unchanged.
export function displayRankName(name) {
  return typeof name === 'string' ? name.replace(/^Add\s+/i, 'Additional ') : name
}
