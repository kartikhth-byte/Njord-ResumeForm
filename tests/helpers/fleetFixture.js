// Synthetic-only HTTP fixture shared by browser tests and the local visual page.
export const fleetUser = {id: '00000000-0000-4000-8000-000000000091', email: 'fleet@example.invalid', role: 'authenticated', aud: 'authenticated'}
export function fleetSession() {
  return {access_token: 'synthetic-local-token', refresh_token: 'synthetic-local-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: fleetUser}
}
export function createFleetFixture({role = 'Master Recruiter', operator = role === 'Master Recruiter'} = {}) {
  const companies = [{id:'c1',name:'Northstar Shipping',version:1},{id:'c2',name:'Bluewater Marine',version:1},{id:'c3',name:'No requirements company',version:1}]
  const ships = [{id:'s1',name:'MV Aurora',company_id:'c1',vessel_type_id:'v1',version:1},{id:'s2',name:'MV Horizon',company_id:'c1',vessel_type_id:'v2',version:1},{id:'s3',name:'MV Pacific',company_id:'c2',vessel_type_id:'v1',version:1}]
  const vesselTypes = [{id:'v1',name:'Bulk Carrier',code:'bulk_carrier'},{id:'v2',name:'Gas Tanker',code:'gas_tanker'}]
  const requirement = (id, company, ship, extra={}) => ({id, req_id_display:`SYN-${id}`, company_id:company, ship_id:ship, customer_name:companies.find(c=>c.id===company)?.name, vessel_name:ships.find(s=>s.id===ship)?.name, location_reviewed_at:'2026-11-09T00:00:00Z', version:1, status:'open', positions_required:2, target_days:30, rank_id:'rank1', vessel_type_id:'v1', date_opened:'2026-11-09', owner_recruiter_id:fleetUser.id, ...extra})
  const requirements = [requirement('R1','c1','s1'),requirement('R2','c1','s2',{vessel_type_id:'v2'}),requirement('R3','c2','s3'),requirement('CLOSED','c1','s1',{status:'closed'}),requirement('DRAFT',null,null,{status:'draft',location_reviewed_at:null}),requirement('LEGACY',null,null,{location_reviewed_at:null,vessel_name:'Historical label'})]
  const prospects=[{id:'p1',name:'Synthetic Candidate',email:'original@example.invalid',status:'open'}]
  const cases=[{id:'case1',prospect_id:'p1',requirement_id:'R1',status:'hired'}]
  const state = {companies, ships, requirements, prospects, cases, links:{}, duplicate:false, calls:[], failNext:'', emptyMatch:false, failRead:false}
  state.respond = (url, method, body) => {
    const table = url.pathname.split('/').pop()
    let result = []
    const profile = {...fleetUser, full_name:'Synthetic recruiter', user_type:'recruiter', user_roles:[{roles:{name:role}}]}
    if (table==='user') result=fleetUser
    else if (table==='profiles') result=url.searchParams.has('id')?profile:[profile]
    else if (table==='user_roles') result=[{role_id:'fixture-role', roles:{name:role}}]
    else if (table==='role_permissions') result=['view_requirements','view_prospects',...(role==='Coordinator'?[]:['edit_requirements','create_requirements','create_prospects','edit_prospects','edit_junction_status'])].map(name=>({permissions:{name}}))
    else if (table==='is_platform_operator') result=operator
    else if (table==='client_companies' || table==='client_ships') {
      if (state.failRead) return {status:503,body:{message:'Synthetic directory unavailable'}}
      result=table==='client_companies'?companies:ships
    }
    else if (table==='vessel_types') result=vesselTypes
    else if (table==='ranks') result=[{id:'rank1',name:'Master',code:'master'}]
    else if (table==='requirements') result=requirements
    else if (table==='prospects') result=prospects
    else if (table==='recruitment_cases') result=cases
    else if (table==='list_candidate_drafts') result=[]
    else if (table==='save_client_fleet_record') {
      state.calls.push({table,body})
      if (state.failNext) {const message=state.failNext;state.failNext='';return {status:409,body:{message}}}
      const list=body.p_kind==='company'?companies:ships
      const existing=list.find(row=>row.id===body.p_id)
      if(existing && existing.version!==body.p_expected_version) return {status:409,body:{message:'version_conflict'}}
      const row={id:existing?.id||`synthetic-${list.length+1}`,name:body.p_name,version:(existing?.version||0)+1,...(body.p_kind==='ship'?{company_id:body.p_company_id,vessel_type_id:body.p_vessel_type_id}:{})}
      if(existing) Object.assign(existing,row); else list.push(row)
      result=row
    }
    else if (table==='save_platform_requirement_for_recruiter') {
      state.calls.push({table,body})
      const row=requirement('NEW',body.p_fields.company_id,body.p_fields.ship_id,body.p_fields)
      requirements.push(row); result=row
    }
    else if (table==='find_resume_candidate_matches') {
      state.calls.push({table,body})
      const id=state.links[body.p_resume_id]
      result=id ? [{id,name:prospects.find(p=>p.id===id).name,reason:'resume'}] : state.duplicate&&body.p_email ? [{id:'p1',name:'Synthetic Candidate',email:'original@example.invalid',reason:'email'}] : []
    }
    else if (table==='review_existing_resume') {
      state.calls.push({table,body})
      if(state.failNext){const message=state.failNext;state.failNext='';return {status:409,body:{message}}}
      const req=requirements.find(r=>r.id===body.p_requirement)
      if(req.status!=='open'||req.version!==body.p_requirement_version)return {status:409,body:{message:'version_conflict'}}
      const hash='a'.repeat(64)
      let id=state.links[hash]||body.p_link
      if(!id){id='p'+(prospects.length+1);prospects.push({id,...body.p_fields,status:'open',needle_resume_id:hash})}
      state.links[hash]=id
      if(!cases.some(c=>c.prospect_id===id&&c.requirement_id===req.id))cases.push({id:'case'+(cases.length+1),prospect_id:id,requirement_id:req.id,status:'sourced'})
      result={prospect_id:id}
    }
    else if (table==='needle-integration') {
      state.calls.push({table,body})
      const hash='a'.repeat(64),linked=prospects.find(p=>p.id===state.links[hash])
      if(body.action==='review_existing'){const response=state.respond(new URL('/rest/v1/rpc/review_existing_resume',url),method,body);return response.status>=400?{...response,body:{error:response.body.message}}:response}
      if(body.action==='prepare')result={resumes:[{resume_id:hash,review_source:'existing_resume',evidence_id:'synthetic-evidence',filename:'synthetic.pdf',prefill:{full_name:'Synthetic Match',email:'new@example.invalid'},matches:linked?[{id:linked.id,name:linked.name,reason:'resume'}]:[]}]}
      else if(body.action==='match_preview')result={page:1,page_count:1,image:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XvIAAAAASUVORK5CYII='}
      else result={stage_id:'synthetic-stage',offset:0,total:state.emptyMatch?0:1,next_offset:null,rows:state.emptyMatch?[]:[{resume_id:hash,full_name:'Synthetic Match',present_rank:'master',public_bucket:'confirmed_match',existing_candidate:linked?{id:linked.id,name:linked.name}:null,cases:linked?cases.filter(c=>c.prospect_id===linked.id):[],verdicts:[{family:'present_rank',verdict:'PASS',required:true},{family:'experience_ship_type',verdict:'PASS',required:true}]}]}
    }
    else if (method!=='GET' && table!=='logout') return {status:400,body:{message:'Unexpected synthetic request'}}
    return {status:200,body:result}
  }
  return state
}
