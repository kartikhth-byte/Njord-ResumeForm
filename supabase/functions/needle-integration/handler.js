// Server-to-server bridge. Never accept candidate facts or a Needle origin
// from the caller. Service-role writes are limited to verified resume evidence.
export function integrationHandler({ admin, requester, authorize, sign, origin, organization, fetcher = fetch }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  const checked = result => { if (result.error) throw new Error('Database operation failed'); return result.data }
  return async req => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return json({ error: 'Sign in required' }, 401)
    const access = await authorize(user.id)
    if (!access?.view && !access?.operator) return json({ error: 'Not authorized' }, 403)
    if (!origin || !organization) return json({ error: 'Needle integration is not configured' }, 503)
    let base
    try {
      base = new URL(origin)
      if ((base.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(base.hostname) && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Invalid origin')
    } catch { return json({ error: 'Needle integration is not configured' }, 503) }
    const client = requester(token)
    const multipart = req.headers.get('content-type')?.includes('multipart/form-data')
    let body, upload
    try {
      if (multipart) {
        if (Number(req.headers.get('content-length') || 0) > 10 * 1024 * 1024 + 65536) return json({ error: 'PDF must be 10 MB or smaller' }, 413)
        upload = await req.formData(); body = { action: 'upload' }
        const file = upload.get('file')
        if (!file || typeof file === 'string' || file.size > 10 * 1024 * 1024) return json({ error: 'Choose a PDF, 10 MB or smaller' }, 400)
      } else body = await req.json()
    } catch { return json({ error: 'Invalid request' }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400)
    const action = body.action
    if (!['prepare', 'upload', 'view', 'match', 'operator', 'status'].includes(action)) return json({ error: 'Unknown action' }, 400)
    if (action === 'operator' && !access.operator) return json({ error: 'Not authorized' }, 403)
    if (action !== 'operator' && !access.view) return json({ error: 'Not authorized' }, 403)
    if (!['view', 'status', 'operator'].includes(action) && (!access.edit || (access.coordinator && !access.operator) || (action !== 'upload' && !access.search))) return json({ error: 'Not authorized' }, 403)
    let ids = []
    if (action === 'prepare') {
      ids = body.resume_ids
      if (!Array.isArray(ids) || !ids.length || ids.length > 25 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) return json({ error: 'Choose 1–25 different resumes' }, 400)
    }
    if (action === 'view' || action === 'status') {
      // The normal viewer can only open a resume already linked to this person.
      if (!/^[a-f0-9]{64}$/.test(body.resume_id || '')) return json({ error: 'Resume not found' }, 404)
      const rows = checked(await client.from('prospect_resumes').select('resume_id').eq('organization_id', organization).eq('prospect_id', body.prospect_id).eq('resume_id', body.resume_id))
      if (!rows?.length) return json({ error: 'Resume not found' }, 404)
      ids = [body.resume_id]
    }
    let matchPayload
    if (action === 'match') {
      const requirement = checked(await client.from('requirements').select('id,req_id_display,status,version,rank_id,vessel_type_id,deleted_at,archived_at').eq('id', body.requirement_id).maybeSingle())
      if (!requirement || requirement.status !== 'open' || requirement.deleted_at || requirement.archived_at) return json({ error: 'Choose an open requirement' }, 409)
      if (body.expected_version !== requirement.version) return json({ error: 'Requirement changed. Refresh and try again.' }, 409)
      const [rank, vessel] = await Promise.all([
        client.from('ranks').select('name,code').eq('id', requirement.rank_id).maybeSingle(),
        client.from('vessel_types').select('name,code').eq('id', requirement.vessel_type_id).maybeSingle(),
      ])
      const nationalities = checked(await client.from('requirement_nationalities').select('countries(name)').eq('requirement_id', requirement.id)) || []
      matchPayload = { requirement_id: requirement.id, requirement_version: requirement.version,
        title: requirement.req_id_display, rank: checked(rank)?.name || '', vessel_type: checked(vessel)?.name || '',
        nationalities: nationalities.map(row => row.countries?.name).filter(Boolean) }
    }
    const signed = await sign(user.id, { org: organization, role: ['view', 'status'].includes(action) ? 'viewer' : action === 'operator' ? 'admin' : 'user', resume_ids: ids }, action === 'status' ? 'view' : action)
    const path = ['view', 'status'].includes(action) ? `resumes/${ids[0]}/${action === 'view' ? 'pdf' : 'status'}` : action
    const response = await fetcher(new URL(`/api/holmes/${path}`, base), {
      method: ['view', 'status'].includes(action) ? 'GET' : 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${signed}`, ...(['view', 'status'].includes(action) || upload ? {} : { 'Content-Type': 'application/json' }) },
      body: ['view', 'status'].includes(action) ? undefined : upload || JSON.stringify(matchPayload || (action === 'operator' ? { action: 'snapshot' } : { resume_ids: ids, stage_id: typeof body.stage_id === 'string' ? body.stage_id : null })),
      signal: AbortSignal.timeout(action === 'match' ? 120000 : 60000),
    })
    if (!response.ok) return json({ error: response.status === 404 ? 'Resume or search not found' : 'Needle is unavailable. No candidate was saved.' }, response.status >= 500 ? 503 : response.status)
    if (action === 'view') {
      if (!response.headers.get('content-type')?.startsWith('application/pdf')) return json({ error: 'Original is not a PDF' }, 415)
      return new Response(response.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="resume.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
    }
    const payload = await response.json()
    if (action === 'match' || action === 'operator') return json(payload)
    if (action === 'status') {
      if (payload.resume_id !== ids[0]) throw new Error('Invalid status scope')
      checked(await admin.from('needle_resume_registry').update({ status: payload.status, engine_version: payload.engine_version, facts_revision: payload.facts_revision, verified_at: new Date().toISOString(), original_available: Boolean(payload.original_available) }).eq('organization_id', organization).eq('resume_id', ids[0]))
      return json(payload)
    }
    const resumes = payload.resumes
    if (!Array.isArray(resumes) || !resumes.length || resumes.length > 25) throw new Error('Invalid Needle response')
    const prepared = []
    for (const resume of resumes) {
      if (!/^[a-f0-9]{64}$/.test(resume.resume_id || '') || !resume.original_available || (action === 'prepare' && !ids.includes(resume.resume_id))) throw new Error('Invalid Needle resume evidence')
      const registry = { organization_id: organization, resume_id: resume.resume_id, filename: resume.filename,
        status: resume.status, original_available: true, engine_version: resume.engine_version, facts_revision: resume.facts_revision, verified_at: new Date().toISOString() }
      checked(await admin.from('needle_resume_registry').upsert(registry, { onConflict: 'organization_id,resume_id' }))
      const evidence = checked(await admin.from('needle_resume_evidence').insert({ organization_id: organization, resume_id: resume.resume_id, actor_id: user.id,
        source: action === 'upload' ? 'holmes_upload' : 'needle_search', stage_id: body.stage_id || null,
        engine_version: resume.engine_version, facts_revision: resume.facts_revision }).select('id').single())
      // Use the caller's normal database permissions for identity previews.
      // Same-file matches must be available before requiring new-person fields.
      const matches = checked(await client.rpc('find_resume_candidate_matches', { p_resume_id: resume.resume_id })) || []
      prepared.push({ ...resume, evidence_id: evidence.id, matches })
    }
    return json({ resumes: prepared })
  }
}
