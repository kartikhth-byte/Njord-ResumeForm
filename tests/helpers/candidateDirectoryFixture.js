import { createFleetFixture } from './fleetFixture.js'
export function createCandidateDirectoryFixture(options) {
  const state = createFleetFixture(options)
  const base = state.respond
  state.prospects.splice(0, state.prospects.length,
    {id:'p1',name:'Alex Morgan',email:'alex@example.invalid',needle_resume_id:'a'.repeat(64),rank_applied_for_id:'rank1',vessel_type_id:'v1',status:'open',version:1},
    {id:'p2',name:'Jamie Reed',email:'jamie@example.invalid',needle_resume_id:'b'.repeat(64),rank_applied_for_id:'rank1',status:'open',version:1},
    {id:'p3',name:'Casey Taylor',email:'casey@example.invalid',needle_resume_id:'c'.repeat(64),rank_applied_for_id:'rank1',status:'open',version:1})
  state.requirements.push({...state.requirements[0],id:'R4',req_id_display:'SYN-R4'})
  state.cases.splice(0,state.cases.length,
    {id:'case1',prospect_id:'p1',requirement_id:'R1',status:'sourced'},
    {id:'case2',prospect_id:'p1',requirement_id:'R4',status:'contacted'},
    {id:'case3',prospect_id:'p1',requirement_id:'R3',status:'sourced'},
    {id:'case4',prospect_id:'p3',requirement_id:'CLOSED',status:'sourced'})
  state.drafts = [{id:'draft1',name:'Robin Patel',email:'robin@example.invalid',notes:'Synthetic draft',version:1}]
  state.cvAvailable = true
  state.respond = (url,method,body) => {
    const table = url.pathname.split('/').pop()
    if (table==='prospects' && url.searchParams.has('id')) return {status:200,body:state.prospects.find(p=>p.id===url.searchParams.get('id').replace('eq.','')) || null}
    if (table==='recruitment_cases' && url.searchParams.has('prospect_id')) return {status:200,body:state.cases.filter(c=>c.prospect_id===url.searchParams.get('prospect_id').replace('eq.',''))}
    if (table==='resume_lead_drafts'||table==='list_candidate_drafts') return {status:200,body:state.drafts}
    if (table==='needle_resume_registry') return {status:200,body:state.prospects.map(p=>({resume_id:p.needle_resume_id,status:'ready',original_available:true}))}
    if (table==='linked_platform_resume_version') return {status:200,body:null}
    if (table==='needle-integration' && body.action==='status') return {status:200,body:{status:'ready',original_available:state.cvAvailable}}
    if (['save_resume_lead_draft','update_resume_lead_draft','update_resume_candidate_contacts','recruitment_case_open'].includes(table)) {
      state.calls.push({table,body})
      if (state.failNext) {const message=state.failNext;state.failNext='';return {status:409,body:{message}}}
      if(options?.role==='Coordinator')return {status:403,body:{message:'permission_denied'}}
      if(table==='save_resume_lead_draft') {const row={id:'draft'+(state.drafts.length+1),...body.p_fields,version:1};state.drafts.push(row);return {status:200,body:row.id}}
      if(table==='update_resume_lead_draft'||table==='update_resume_candidate_contacts') {
        const row=(table==='update_resume_lead_draft'?state.drafts:state.prospects).find(p=>p.id===body.p_id)
        if(row.version!==body.p_expected_version)return {status:409,body:{message:'version_conflict'}}
        Object.assign(row,body.p_fields,{version:row.version+1});return {status:200,body:row.id}
      }
      if(table==='recruitment_case_open') {
        const requirement=state.requirements.find(r=>r.id===body.p_requirement_id)
        if(!state.cvAvailable)return {status:409,body:{message:'available_resume_required'}}
        if(requirement.status!=='open')return {status:409,body:{message:'requirement_not_open'}}
        const existing=state.cases.find(c=>c.prospect_id===body.p_prospect_id&&c.requirement_id===body.p_requirement_id)
        if(!existing)state.cases.push({id:'case'+(state.cases.length+1),prospect_id:body.p_prospect_id,requirement_id:body.p_requirement_id,status:'sourced'})
        return {status:200,body:existing||state.cases.at(-1)}
      }
    }
    if(table==='find_resume_candidate_matches')return {status:200,body:state.prospects.filter(p=>p.email===body.p_email).map(p=>({...p,reason:'email'}))}
    return base(url,method,body)
  }
  return state
}
