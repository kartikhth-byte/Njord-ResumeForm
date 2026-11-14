export function dateCell(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

export function recordDisplayId(row, fallback = '') {
  return row?.display_id || fallback || '—'
}

export function latestRecordDate(...values) {
  const times = values.map(value => Date.parse(value)).filter(Number.isFinite)
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}
