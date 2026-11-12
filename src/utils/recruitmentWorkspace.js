import { caseActionLabel, caseNextActions, caseStatusMeta, isCaseTerminal } from './recruitmentCase.js'
export const WORK_STAGES = ['New','Screening','Offer','Pre-joining','Joined','Closed']
export const TASKS = {contact:'Contact and availability',test:'Test',interview:'Interview',offer:'Offer',application:'Application form',documents:'Document checks',principal:'Principal handoff',joining:'Confirm joining'}
export function workStage(status) {
 if(status==='hired')return 'Joined'
 if(['withdrawn','rejected','closed'].includes(status))return 'Closed'
 if(['documents_pending','documents_verified','sent_to_principal','offer_accepted'].includes(status))return 'Pre-joining'
 if(['selected','offered','offer_declined'].includes(status))return 'Offer'
 if(['legacy','sourced','interested'].includes(status))return 'New'
 return 'Screening'
}
export function taskForStatus(status='') {
 if(['contacted','confirmed'].includes(status))return 'contact'
 if(status.startsWith('test_'))return 'test'
 if(status.startsWith('interview_'))return 'interview'
 if(['selected','offered','offer_accepted','offer_declined'].includes(status))return 'offer'
 if(status.startsWith('documents_'))return 'documents'
 if(status==='sent_to_principal')return 'principal'
 if(status==='hired')return 'joining'
 return null
}
const completed = new Set(['confirmed','test_passed','test_failed','test_waived','test_no_show','interview_passed','interview_failed','interview_no_show','offer_accepted','offer_declined','documents_verified','sent_to_principal','hired'])
export function taskProgress(row,events=[],assignments=[]) {
 const ordered=events.filter(e=>e.case_id===row.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at))
 return Object.entries(TASKS).map(([key,label])=>{
  const history=ordered.filter(e=>e.from_status!=='legacy'&&((['transition','principal_send_attested'].includes(e.event_type)&&taskForStatus(e.to_status)===key) || (key==='application'&&(e.event_type==='form_invited'||['application_linked','invited_application_started'].includes(e.payload?.action)))))
  const last=history.at(-1),assignment=assignments.find(a=>a.case_id===row.id&&a.task_key===key)
  const done=key==='application' ? Boolean(row.application_id&&row.application?.submitted_at) : Boolean(last&&completed.has(last.to_status))
  const scheduled=last?.to_status?.endsWith('_scheduled')
  const status=done?'Completed':scheduled?'Scheduled':assignment?.started_at||(key==='application'&&row.application_id)?'In progress':history.length?'In progress':'Not started'
  return {key,label,assignment,done,status,outcome:key==='application'?(done?'Submitted':row.application_id?'Draft in progress':history.length?'Invited':null):last?caseStatusMeta(last.to_status).label:null,
   due:assignment?.due_at||(scheduled?last.payload?.scheduled_at:null),
   last,history}
 })
}
export function nextWork(row) {
 if(isCaseTerminal(row.status))return 'Complete'
 if(row.status==='legacy')return 'Review earlier record'
 if(row.status==='documents_verified')return 'Record principal handoff'
 return caseActionLabel(caseNextActions(row.status)[0]) || 'Review progress'
}
// Group by identity, not display name; retain each candidate/requirement cycle.
export function groupRecruitmentRows(rows) {
 const companies=new Map()
 for(const row of rows) {
  const companyId=row.requirement?.company_id||row.company?.id||'unmapped'
  const shipId=row.requirement?.ship_id||row.ship?.id||'unmapped'
  if(!companies.has(companyId))companies.set(companyId,{id:companyId,name:row.company?.name||'Company not mapped',ships:new Map(),count:0,active:0})
  const company=companies.get(companyId)
  if(!company.ships.has(shipId))company.ships.set(shipId,{id:shipId,name:row.ship?.name||'Ship not mapped',rows:[],active:0})
  const ship=company.ships.get(shipId),active=!isCaseTerminal(row.status)
  ship.rows.push(row);ship.active+=Number(active);company.count++;company.active+=Number(active)
 }
 const byName=(a,b)=>a.name.localeCompare(b.name)||String(a.id).localeCompare(String(b.id))
 return [...companies.values()].sort(byName).map(company=>({...company,ships:[...company.ships.values()].sort(byName)}))
}
// Activity belongs to the performer at the time, never the current owner.
export function workScorecard({cases=[],events=[],assignments=[],credits=[],recruiters=[],periodStart=null,now=new Date()}) {
 const ids=new Set(cases.map(c=>c.id)),creditMap=new Map(credits.map(c=>[c.event_id,c]))
 const active=new Set(cases.filter(c=>!isCaseTerminal(c.status)).map(c=>c.id))
 const inPeriod=d=>!periodStart||new Date(d)>=new Date(periodStart)
 return recruiters.map(r=>{
  const activity=events.filter(e=>ids.has(e.case_id)&&e.event_type==='transition'&&e.from_status!=='legacy'&&(creditMap.get(e.id)?.performed_by||e.actor_id)===r.id&&inPeriod(creditMap.get(e.id)?.occurred_at||e.created_at))
  const count=statuses=>activity.filter(e=>statuses.includes(e.to_status)).length
  const tasks=cases.filter(c=>active.has(c.id)).flatMap(c=>taskProgress(c,events,assignments)).filter(t=>t.assignment?.assignee_id===r.id&&!t.done)
  return {id:r.id,name:r.full_name||r.email||r.id,rows:assignments.filter(a=>a.task_key==='case'&&a.assignee_id===r.id&&active.has(a.case_id)).length,
   pending:tasks.length,overdue:tasks.filter(t=>t.due&&new Date(t.due)<now).length,
   contacts:count(['contacted']),tests:count(['test_passed','test_failed']),interviews:count(['interview_passed','interview_failed']),documents:count(['documents_verified'])}
 })
}
