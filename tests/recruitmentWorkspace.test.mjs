import test from 'node:test'
import assert from 'node:assert/strict'
import { workStage,taskProgress,workScorecard,groupRecruitmentRows } from '../src/utils/recruitmentWorkspace.js'
const c={id:'c',status:'interview_scheduled'},date='2026-11-12T09:00:00Z'
const e=(id,status,actor='a')=>({id,case_id:'c',event_type:'transition',from_status:'confirmed',to_status:status,actor_id:actor,created_at:date,payload:{}})
test('fleet groups retain separate identities, cycles, unmapped cases and active counts',()=>{
 const row=(id,company,ship,status='sourced')=>({id,status,company:{id:company,name:'Same company'},ship:{id:ship,name:'Same ship'},requirement:{company_id:company,ship_id:ship}})
 const groups=groupRecruitmentRows([row('a','c1','s1'),row('b','c1','s1','hired'),row('c','c1','s2'),row('d','c2','s3'),{id:'legacy',status:'legacy'}])
 assert.equal(groups.length,3)
 const company=groups.find(g=>g.id==='c1')
 assert.equal(company.count,3);assert.equal(company.active,2);assert.equal(company.ships.length,2)
 assert.deepEqual(company.ships[0].rows.map(r=>r.id),['a','b'])
 assert.equal(company.ships[0].active,1)
 assert.equal(groups.find(g=>g.id==='unmapped').ships[0].rows[0].id,'legacy')
})
test('broad stages preserve stored status meanings',()=>{
 assert.equal(workStage('test_failed'),'Screening');assert.equal(workStage('offer_declined'),'Offer');assert.equal(workStage('hired'),'Joined');assert.equal(workStage('rejected'),'Closed')
})
test('tasks derive from evidence, not a later stage; no invented completion',()=>{
 const tasks=taskProgress(c,[e('1','test_passed'),{...e('2','interview_scheduled'),payload:{scheduled_at:'2026-11-13'}}])
 assert.equal(tasks.find(t=>t.key==='contact').done,false)
 assert.equal(tasks.find(t=>t.key==='test').done,true)
 assert.equal(tasks.find(t=>t.key==='interview').status,'Scheduled')
})
test('handover changes workload, not historic activity; performer can differ from recorder',()=>{
 const data={cases:[c],events:[e('1','contacted'),e('2','interview_passed','b')],assignments:[{case_id:'c',task_key:'case',assignee_id:'b'}],credits:[{event_id:'2',performed_by:'a',recorded_by:'b',occurred_at:date}],recruiters:[{id:'a'},{id:'b'}]}
 const rows=workScorecard(data)
 assert.equal(rows[0].contacts,1);assert.equal(rows[0].interviews,1);assert.equal(rows[0].rows,0);assert.equal(rows[1].rows,1);assert.equal(rows[1].interviews,0)
 assert.equal(workScorecard({...data,periodStart:'2026-11-13'})[0].contacts,0)
})
test('closed work and no-shows do not inflate pending or completed work',()=>{
 const rows=workScorecard({cases:[{...c,status:'closed'}],events:[e('1','test_no_show')],assignments:[{case_id:'c',task_key:'test',assignee_id:'a',due_at:'2020-01-01'}],recruiters:[{id:'a'}]})
 assert.equal(rows[0].tests,0);assert.equal(rows[0].pending,0);assert.equal(rows[0].overdue,0)
})

test('an invited draft is in progress, and only a submitted form completes the task',()=>{
 const event={...e('form','interview_passed'),event_type:'source_added',payload:{action:'invited_application_started'}}
 const row={...c,application_id:'form',application:{submitted_at:null}}
 let task=taskProgress(row,[event]).find(t=>t.key==='application')
 assert.equal(task.done,false);assert.equal(task.status,'In progress');assert.equal(task.outcome,'Draft in progress')
 task=taskProgress({...row,application:{submitted_at:date}},[event]).find(t=>t.key==='application')
 assert.equal(task.done,true);assert.equal(task.outcome,'Submitted')
 const invite={...event,event_type:'form_invited',payload:{}}
 assert.equal(taskProgress(c,[invite]).find(t=>t.key==='application').done,false)
 const workload={cases:[row],events:[event],assignments:[{case_id:'c',task_key:'application',assignee_id:'a'}],recruiters:[{id:'a'}]}
 assert.equal(workScorecard(workload)[0].pending,1)
 assert.equal(workScorecard({...workload,cases:[{...row,application:{submitted_at:date}}]})[0].pending,0)
})
