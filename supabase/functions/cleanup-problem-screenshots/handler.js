// Only this feature's reserved paths are eligible. Never enumerate unrelated buckets.
export async function cleanupProblemScreenshots(admin, now = new Date()) {
  const cutoff = now.toISOString(), pendingCutoff = new Date(now.getTime() - 3600000).toISOString()
  const { data: rows, error } = await admin.from('problem_reports').select('id,screenshot_path')
    .is('screenshot_deleted_at', null)
    .or(`screenshot_expires_at.lte.${cutoff},and(submitted_at.is.null,created_at.lte.${pendingCutoff})`)
    .order('created_at', { ascending: true }).limit(100)
  if (error) throw new Error('Retention query failed')
  let deleted = 0, failed = 0
  for (const row of rows) {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/.test(row.screenshot_path) || !row.screenshot_path.endsWith(`/${row.id}.png`)) { failed++; continue }
    const { error: removeError } = await admin.storage.from('problem-screenshots').remove([row.screenshot_path])
    if (removeError) { failed++; continue }
    // Storage remove is retry-safe. Mark only after physical deletion succeeds.
    const { error: markError } = await admin.from('problem_reports').update({ screenshot_deleted_at: cutoff }).eq('id', row.id).is('screenshot_deleted_at', null)
    if (markError) failed++
    else deleted++
  }
  return { selected: rows.length, deleted, failed }
}

export function cleanupHandler({ admin, token }) {
  return async req => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    if (!token || token.length < 32 || req.headers.get('Authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401 })
    try {
      const result = await cleanupProblemScreenshots(admin)
      return Response.json(result, { status: result.failed ? 503 : 200 })
    } catch { return Response.json({ error: 'Screenshot retention failed' }, { status: 503 }) }
  }
}
