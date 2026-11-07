// Filter each actual case against all selected dimensions together. A person
// whose company matches case A and stage matches case B must not appear.
export function candidateCaseMatches(prospectId,cases,requirements,filter) {
  if(!Object.values(filter).some(Boolean))return true
  const reqs=new Map(requirements.map(r=>[r.id,r]))
  return cases.some(c=>{
    const r=reqs.get(c.requirement_id)
    return c.prospect_id===prospectId&&r&&!r.deleted_at&&
      (!filter.company||r.company_id===filter.company)&&(!filter.ship||r.ship_id===filter.ship)&&
      (!filter.requirement||r.id===filter.requirement)&&(!filter.stage||c.status===filter.stage)
  })
}
