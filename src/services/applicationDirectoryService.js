// Read only: use explicit case.application_id links, never infer a requirement
// from the candidate's other cases, old labels or résumé employment history.
async function readPages(build) {
  const rows = []
  for (let start = 0; ; start += 500) {
    const { data, error } = await build().range(start, start + 499)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
  }
}
async function readIds(client, table, columns, field, ids) {
  const rows = [], unique = [...new Set(ids.filter(Boolean))]
  for (let start = 0; start < unique.length; start += 100) {
    const batch = unique.slice(start, start + 100)
    rows.push(...await readPages(() => client.from(table).select(columns).in(field, batch).order('id')))
  }
  return rows
}
export async function loadApplicationDirectory(client, filters = {}) {
  const applications = await readPages(() => {
    let query = client.from('applications').select('id,user_id,applied_rank,status,reference_number,public_token,submitted_at,test_attempt_number,test_max_attempts,handling_recruiter_id,contract_end_date,prospect_id,application_data(data)')
      .not('submitted_at', 'is', null).order('submitted_at', { ascending: false }).order('id')
    if (filters.position) query = query.eq('applied_rank', filters.position)
    if (filters.dateRange?.from) query = query.gte('submitted_at', filters.dateRange.from)
    if (filters.dateRange?.to) query = query.lte('submitted_at', `${filters.dateRange.to}T23:59:59.999`)
    return query
  })
  const [profiles, cases] = await Promise.all([
    readIds(client, 'profiles', 'id,full_name,email', 'id', applications.map(a => a.user_id)),
    readIds(client, 'recruitment_cases', 'id,application_id,prospect_id,requirement_id,status,cycle', 'application_id', applications.map(a => a.id)),
  ])
  const requirements = await readIds(client, 'requirements', 'id,req_id_display,company_id,ship_id', 'id', cases.map(c => c.requirement_id))
  const [companies, ships] = await Promise.all([
    readIds(client, 'client_companies', 'id,name', 'id', requirements.map(r => r.company_id)),
    readIds(client, 'client_ships', 'id,name,company_id', 'id', requirements.map(r => r.ship_id)),
  ])
  return { applications, profiles, cases, requirements, companies, ships }
}
