// Server-to-server bridge. Never accept candidate facts or a Needle origin
// from the caller. Service-role writes are limited to verified resume evidence and private save receipts.
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
    if (!['review_existing', 'prepare', 'upload', 'view', 'match', 'match_results', 'match_original', 'match_preview', 'operator', 'status'].includes(action)) return json({ error: 'Unknown action' }, 400)
    if (action === 'operator' && !access.operator) return json({ error: 'Not authorized' }, 403)
    if (action !== 'operator' && !access.view) return json({ error: 'Not authorized' }, 403)
    if (!['view', 'status', 'operator'].includes(action) && (!access.edit || (access.coordinator && !access.operator) || (action !== 'upload' && !access.search))) return json({ error: 'Not authorized' }, 403)
    if (action === 'upload') return json({ error: 'Use platform Resume Intake for original uploads' }, 410)
    if (action === 'review_existing') {
      const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
      if (!uuid(body.p_evidence) || !['new', 'link'].includes(body.p_decision)
        || !body.p_fields || typeof body.p_fields !== 'object' || Array.isArray(body.p_fields)
        || JSON.stringify(body.p_fields).length > 65536
        || (body.p_link != null && !uuid(body.p_link)) || (body.p_requirement != null && !uuid(body.p_requirement))
        || (body.p_requirement != null && !Number.isSafeInteger(body.p_requirement_version))
        || typeof body.p_confirm_new !== 'boolean') return json({error:'Invalid identity review'},400)
      const evidence = checked(await admin.from('needle_resume_evidence').select('*')
        .eq('id',body.p_evidence).eq('actor_id',user.id).eq('organization_id',organization).eq('source','needle_search').maybeSingle())
      if (!evidence || !/^[a-f0-9]{64}$/.test(evidence.resume_id || '')) return json({error:'Review this résumé again before attaching.'},409)
      const signedReview = await sign(user.id,{org:organization,role:'user',resume_ids:[evidence.resume_id]},'prepare')
      const verifiedResponse = await fetcher(new URL('/api/holmes/verify-review',base), {
        method:'POST',redirect:'error',headers:{Authorization:`Bearer ${signedReview}`,'Content-Type':'application/json'},
        body:JSON.stringify({resume_id:evidence.resume_id,facts_revision:evidence.facts_revision}),signal:AbortSignal.timeout(60000),
      })
      if (!verifiedResponse.ok) return json({error:verifiedResponse.status===409
        ? 'The résumé changed or its original is unavailable. Close matching and review it again.'
        : 'Could not verify the résumé. No candidate was saved. Try again.'},verifiedResponse.status===409?409:503)
      const verified = await verifiedResponse.json()
      const age = Date.now()-Date.parse(verified.verified_at)
      if (verified.resume_id!==evidence.resume_id || verified.facts_revision!==evidence.facts_revision
        || verified.original_verified!==true || !Number.isFinite(age) || age < -5000 || age > 30000) {
        return json({error:'Could not verify the reviewed résumé. No candidate was saved.'},409)
      }
      const reviewed = {p_evidence:body.p_evidence,p_decision:body.p_decision,p_fields:body.p_fields,
        p_link:body.p_link??null,p_confirm_new:body.p_confirm_new,p_requirement:body.p_requirement??null,
        p_requirement_version:body.p_requirement_version??null}
      const receipt = checked(await admin.from('existing_resume_save_receipts').insert({
        evidence_id:evidence.id,actor_id:user.id,organization_id:organization,resume_id:evidence.resume_id,
        facts_revision:evidence.facts_revision,reviewed_request:reviewed,verified_at:verified.verified_at,
      }).select('id').single())
      // Keep the caller's permissions and all identity/case checks in the DB.
      const saved = await client.rpc('review_existing_resume',{...reviewed,p_receipt:receipt.id})
      if (saved.error) {
        const safe = new Set(['version_conflict','open_requirement_required','requirement_not_open','possible_duplicate',
          'possible_duplicate_requires_review','existing_candidate_requires_explicit_link','linked_candidate_requires_restore',
          'phone_or_email_required','valid_email_required','permission_denied','resume_source_changed_refresh_matching',
          'resume_review_expired_refresh_matching','fresh_source_verification_required'])
        return json({error:safe.has(saved.error.message)?saved.error.message:'Could not save the reviewed candidate. Refresh matching and try again.'},409)
      }
      return json(saved.data)
    }
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
    const matching = ['match', 'match_results', 'match_original', 'match_preview'].includes(action)
    if (matching) {
      if (body.offset !== undefined && (!Number.isSafeInteger(body.offset) || body.offset < 0)) return json({ error: 'Invalid results offset' }, 400)
      if (action !== 'match' && (typeof body.stage_id !== 'string' || !body.stage_id)) return json({ error: 'Choose saved requirement results' }, 400)
      if (action === 'match_original' || action === 'match_preview') {
        if (!/^[a-f0-9]{64}$/.test(body.resume_id || '')) return json({ error: 'Resume not found' }, 404)
        ids = [body.resume_id]
      }
      if (action === 'match_preview' && (!Number.isSafeInteger(body.page) || body.page < 1 || body.page > 100)) return json({ error: 'Invalid résumé page' }, 400)
      const requirement = checked(await client.from('requirements').select('id,req_id_display,status,version,rank_id,vessel_type_id,company_id,ship_id,location_reviewed_at,deleted_at,archived_at').eq('id', body.requirement_id).maybeSingle())
      if (!requirement || requirement.status !== 'open' || !requirement.location_reviewed_at || !requirement.company_id || !requirement.ship_id || requirement.deleted_at || requirement.archived_at) return json({ error: 'Choose an open requirement' }, 409)
      const [shipResult,companyResult]=await Promise.all([
        client.from('client_ships').select('id').eq('id',requirement.ship_id).eq('company_id',requirement.company_id).is('archived_at',null).maybeSingle(),
        client.from('client_companies').select('id').eq('id',requirement.company_id).is('archived_at',null).maybeSingle(),
      ])
      if(!checked(shipResult)||!checked(companyResult))return json({error:'Company or ship requires review'},409)
      if (body.expected_version !== requirement.version) return json({ error: 'Requirement changed. Refresh and try again.' }, 409)
      const [rank, vessel] = await Promise.all([
        client.from('ranks').select('name,code').eq('id', requirement.rank_id).maybeSingle(),
        client.from('vessel_types').select('name,code').eq('id', requirement.vessel_type_id).maybeSingle(),
      ])
      const nationalities = checked(await client.from('requirement_nationalities').select('countries(name)').eq('requirement_id', requirement.id)) || []
      matchPayload = { requirement_id: requirement.id, requirement_version: requirement.version,
        title: requirement.req_id_display, rank: checked(rank)?.name || '', vessel_type: checked(vessel)?.name || '',
        nationalities: nationalities.map(row => row.countries?.name).filter(Boolean),
        offset: body.offset || 0, ...(action !== 'match' ? { stage_id: body.stage_id } : {}),
        ...(['match_original','match_preview'].includes(action) ? { resume_id: body.resume_id } : {}),
        ...(action === 'match_preview' ? { page: body.page } : {}) }
    }
    const signed = await sign(user.id, { org: organization, role: ['view', 'status'].includes(action) ? 'viewer' : action === 'operator' ? 'admin' : 'user', resume_ids: ids }, matching ? 'match' : action === 'status' ? 'view' : action)
    const path = ['view', 'status'].includes(action) ? `resumes/${ids[0]}/${action === 'view' ? 'pdf' : 'status'}` : action.replaceAll('_', '-')
    const response = await fetcher(new URL(`/api/holmes/${path}`, base), {
      method: ['view', 'status'].includes(action) ? 'GET' : 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${signed}`, ...(['view', 'status'].includes(action) || upload ? {} : { 'Content-Type': 'application/json' }) },
      body: ['view', 'status'].includes(action) ? undefined : upload || JSON.stringify(matchPayload || (action === 'operator' ? { action: 'snapshot' } : { resume_ids: ids, stage_id: typeof body.stage_id === 'string' ? body.stage_id : null })),
      signal: AbortSignal.timeout(action === 'match' ? 120000 : 60000),
    })
    if (!response.ok) {
      const detail = matching && response.status < 500 ? await response.json().catch(() => null) : null
      const safeMatchErrors = new Set([
        'Requirement rank is unmapped. Correct the requirement rank before matching.',
        'Requirement vessel type is missing or unmapped. Correct it before matching.',
        'Original exceeds the 10 MB preview limit',
        'Original cannot be previewed; operator review required',
        'Resume page not found', 'Original PDF unavailable',
      ])
      return json({ error: safeMatchErrors.has(detail?.error) ? detail.error : response.status === 404 ? 'Resume or search not found' : 'Needle is unavailable. No candidate was saved.' }, response.status >= 500 ? 503 : response.status)
    }
    if (action === 'view' || action === 'match_original') {
      if (!response.headers.get('content-type')?.startsWith('application/pdf')) return json({ error: 'Original is not a PDF' }, 415)
      return new Response(response.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="resume.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
    }
    const payload = await response.json()
    if (action === 'match_preview') {
      if (!Number.isSafeInteger(payload.page_count) || payload.page_count < 1 || payload.page_count > 100
        || payload.page !== body.page || payload.page > payload.page_count || typeof payload.image !== 'string'
        || payload.image.length > 12 * 1024 * 1024 || !payload.image.startsWith('iVBORw0KGgo') || !/^[A-Za-z0-9+/=]+$/.test(payload.image)) throw new Error('Invalid résumé preview')
      return json({ page: payload.page, page_count: payload.page_count, image: payload.image })
    }
    if (matching) {
      if (!Array.isArray(payload.rows) || payload.rows.length > 25 || typeof payload.stage_id !== 'string'
          || !Number.isSafeInteger(payload.total) || payload.total < payload.rows.length
          || payload.rows.some(row => !/^[a-f0-9]{64}$/.test(row.resume_id || ''))
          || new Set(payload.rows.map(row => row.resume_id)).size !== payload.rows.length) throw new Error('Invalid requirement results')
      const rows = await Promise.all(payload.rows.map(async row => {
        const matches = checked(await client.rpc('find_resume_candidate_matches', { p_resume_id: row.resume_id })) || []
        const person = matches.find(match => match.reason === 'resume')
        return { resume_id: row.resume_id, full_name: row.full_name, present_rank: row.present_rank,
          nationality: row.nationality, public_bucket: row.public_bucket, confirmed: row.confirmed,
          criteria_count: row.criteria_count, verdicts: row.verdicts,
          existing_candidate: person ? { id: person.id, name: person.name } : null }
      }))
      const people = [...new Set(rows.map(row => row.existing_candidate?.id).filter(Boolean))]
      const cases = people.length ? checked(await client.from('recruitment_cases').select('id,prospect_id,requirement_id,status,requirements(req_id_display)').in('prospect_id', people)) || [] : []
      return json({ stage_id: payload.stage_id, total: payload.total, offset: payload.offset,
        // Retain the owned path for older deployed callers during the rolling
        // release. The requirement modal does not display or navigate to it.
        ...(action === 'match' ? { path: payload.path } : {}),
        next_offset: payload.next_offset, warnings: payload.warnings || [], filters: payload.filters,
        rows: rows.map(row => ({ ...row, cases: cases.filter(c => c.prospect_id === row.existing_candidate?.id) })) })
    }
    if (action === 'operator') return json(payload)
    if (action === 'status') {
      if (payload.resume_id !== ids[0]) throw new Error('Invalid status scope')
      checked(await admin.from('needle_resume_registry').update({ status: payload.status, engine_version: payload.engine_version, facts_revision: payload.facts_revision, verified_at: new Date().toISOString(), original_available: Boolean(payload.original_available) }).eq('organization_id', organization).eq('resume_id', ids[0]))
      delete payload.storage_ref
      return json(payload)
    }
    const resumes = payload.resumes
    if (!Array.isArray(resumes) || resumes.length !== ids.length || new Set(resumes.map(row => row.resume_id)).size !== ids.length
      || resumes.some(row => !ids.includes(row.resume_id))) throw new Error('Invalid Needle response')
    // Existing-corpus review never imports a file or accepts facts from the browser.
    // Validate the complete batch before issuing evidence for any row.
    if (resumes.some(row => row.status !== 'ready' || row.original_available !== true || typeof row.facts_revision !== 'string' || !row.facts_revision.trim())) {
      return json({ error: 'Résumé facts or original are unavailable. Refresh matching or ask an operator to review the source.' }, 409)
    }
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
      const { storage_ref: _privateOriginal, ...browserResume } = resume
      prepared.push({ ...browserResume, review_source: 'existing_resume', evidence_id: evidence.id, matches })
    }
    return json({ resumes: prepared })
  }
}
