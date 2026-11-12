// A submitted form is reviewed against its explicit case links. A candidate's
// other requirements must never supply this context.
export async function loadApplicationReviewContext(client, application, { canReadCandidate, canReadRecruitment }) {
  const read = async query => {
    const { data, error } = await query
    if (error) throw error
    return data
  }
  const [candidate, cases] = await Promise.all([
    canReadCandidate && application.prospect_id
      ? read(client.from('prospects').select('id,needle_resume_id').eq('id', application.prospect_id).maybeSingle()) : null,
    canReadRecruitment
      ? read(client.from('recruitment_cases').select('id,application_id,prospect_id,requirement_id,cycle,status').eq('application_id', application.id).order('id')) : [],
  ])
  const ids = [...new Set((cases || []).map(row => row.requirement_id).filter(Boolean))]
  const [requirements, nationalities] = ids.length ? await Promise.all([
    read(client.from('requirements').select('id,req_id_display,customer_name,rank_id,vessel_type_id').in('id', ids)),
    read(client.from('requirement_nationalities').select('requirement_id,country_id,countries(id,code,name)').in('requirement_id', ids)),
  ]) : [[], []]
  return { candidate, cases: cases || [], requirements: requirements || [], nationalities: nationalities || [] }
}
