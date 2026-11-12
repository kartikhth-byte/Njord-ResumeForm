/* global process */
import {test,expect} from '@playwright/test'
import {createCandidateDirectoryFixture} from '../helpers/candidateDirectoryFixture'
import {fleetSession,fleetUser} from '../helpers/fleetFixture'
async function fixture(page,options={}) {
 const state=createCandidateDirectoryFixture(options),base=state.respond
 state.cases.forEach(c=>{c.version=1;c.cycle=1})
 state.assignments=[];state.history=[];state.events=[];state.credits=[]
 state.respond=(url,method,body)=>{
  const table=url.pathname.split('/').pop()
  if(table==='profiles'&&url.searchParams.get('id')?.startsWith('in.')){const r=base(url,method,body);return {...r,body:Array.isArray(r.body)?r.body:[r.body]}}
  if(table==='prospects'&&url.searchParams.get('id')?.startsWith('in.'))return {status:200,body:state.prospects}
  if(table==='recruitment_work_assignments')return {status:200,body:state.assignments}
  if(table==='recruitment_work_history')return {status:200,body:state.history}
  if(table==='recruitment_task_credits')return {status:200,body:state.credits}
  if(table==='recruitment_case_events')return {status:200,body:state.events}
  if(table==='recruitment_cases')return {status:200,body:state.cases.filter(c=>!url.searchParams.has('requirement_id')||c.requirement_id===url.searchParams.get('requirement_id').replace('eq.',''))}
  if(table==='recruitment_assign_work'){
   state.calls.push({table,body})
   if(state.failNext){state.failNext=false;return {status:409,body:{message:'version_conflict'}}}
   const prior=state.assignments.find(a=>a.case_id===body.p_case&&a.task_key===body.p_task)
   const result={case_id:body.p_case,task_key:body.p_task,assignee_id:body.p_assignee,due_at:body.p_due,started_at:body.p_start?new Date().toISOString():null,version:(prior?.version||0)+1}
   if(prior)Object.assign(prior,result);else state.assignments.push(result)
   state.history.push({id:'h'+state.history.length,...result,actor_id:fleetUser.id,action:'assigned',created_at:new Date().toISOString()})
   return {status:200,body:result}
  }
  if(table==='recruitment_workspace_transition'){
   const row=state.cases.find(c=>c.id===body.p_case);row.status=body.p_status;row.version++
   state.events.push({id:'e'+state.events.length,case_id:row.id,event_type:'transition',to_status:body.p_status,actor_id:fleetUser.id,created_at:new Date().toISOString(),payload:body.p_assessment})
   return {status:200,body:row}
  }
  return base(url,method,body)
 }
 await page.addInitScript(session=>localStorage.setItem('njord-auth-token',JSON.stringify(session)),fleetSession())
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
  if(url.hostname!=='supabase.invalid')return route.abort()
  const result=state.respond(url,req.method(),req.postData()?req.postDataJSON():null)
  return route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)})
 })
 return state
}
test.describe('Recruitment workspace',()=>{
 test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE,'Synthetic server required')
 test.use({storageState:{cookies:[],origins:[]}})
 test('company and ship groups are default, collapse independently and reveal filtered work',async({page})=>{
  const state=await fixture(page)
  state.cases.push({id:'case5',prospect_id:'p2',requirement_id:'R2',status:'sourced',version:1},{id:'case6',prospect_id:'p2',requirement_id:'LEGACY',status:'sourced',version:1},{id:'case7',prospect_id:'p2',requirement_id:'R1',status:'hired',version:1})
  // My work must include a task even when someone else owns the row.
  state.assignments=[{case_id:'case5',task_key:'case',assignee_id:'another-recruiter',version:1},{case_id:'case5',task_key:'interview',assignee_id:fleetUser.id,version:1}]
  await page.goto('/recruiter/recruitment')
  const groups=page.getByRole('region',{name:'Recruitment by company and ship'})
  const north=groups.locator('details').filter({has:page.locator('summary').filter({hasText:'Company · Northstar Shipping'})}).first()
  const company=north.locator(':scope > summary')
  await expect(company).toContainText('4 rows · 4 active')
  const aurora=north.locator('details').filter({has:page.locator('summary').filter({hasText:'Ship · MV Aurora'})})
  await expect(aurora.getByRole('button',{name:'Alex Morgan',exact:true})).toHaveCount(2)
  await expect(groups.getByText('Company · Company not mapped')).toBeVisible()
  await aurora.locator('summary').click()
  await expect(aurora.getByRole('table')).toBeHidden()
  await expect(north.getByRole('button',{name:'Jamie Reed',exact:true})).toBeVisible()
  await company.click()
  await page.getByLabel('Search',{exact:true}).fill('SYN-R4')
  await expect(groups.getByRole('button',{name:'Alex Morgan',exact:true})).toBeVisible()
  await expect(groups.locator(':scope > details')).toHaveCount(1)
  await expect(groups).toContainText('1 row · 1 active')
  await page.getByLabel('Search',{exact:true}).fill('')
  await page.getByLabel('Work',{exact:true}).selectOption('mine')
  await expect(groups.getByRole('button',{name:'Jamie Reed',exact:true})).toBeVisible()
  await expect(groups).toContainText('Ship · MV Horizon')
  await expect(groups.getByRole('button',{name:'Alex Morgan',exact:true})).toHaveCount(0)
  await page.reload()
  await expect(groups.getByRole('button',{name:'Jamie Reed',exact:true})).toBeVisible()
  await page.getByLabel('Work',{exact:true}).selectOption('')
  await page.getByRole('button',{name:/^Joined \(/}).click()
  await expect(groups).toContainText('1 row · 0 active')
  await page.getByRole('button',{name:'Active',exact:true}).click()
  await expect(groups).toContainText('6 recruitment rows shown')
  await page.screenshot({path:'test-results/recruitment-grouped-desktop.png',fullPage:true,animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/recruitment-grouped-mobile.png',fullPage:true,animations:'disabled'})
 })
 test('task outcomes remain explicit and old pre-joining links retain their results',async({page})=>{
  const state=await fixture(page)
  const row=state.cases.find(c=>c.id==='case1')
  row.status='documents_verified';row.application_id='synthetic-application'
  state.events=['confirmed','test_failed','interview_scheduled','documents_verified'].map((status,i)=>({id:`visual-${i}`,case_id:row.id,event_type:'transition',from_status:'confirmed',to_status:status,created_at:`2026-11-12T09:0${i}:00Z`,payload:{}}))
  await page.goto('/recruiter/recruitment?stage=Joining%20preparation')
  await expect(page.getByRole('button',{name:/^Pre-joining/})).toHaveAttribute('aria-pressed','true')
  const progress=page.getByRole('list',{name:'Task progress'})
  await expect(progress).toHaveCount(1)
  await expect(progress.getByRole('listitem')).toHaveCount(8)
  await expect(progress.getByText('— Confirmed',{exact:true})).toHaveClass(/text-success/)
  await expect(progress.getByText('— Test failed',{exact:true})).toHaveClass(/text-danger/)
  await expect(progress.getByText('— Interview scheduled',{exact:true})).toHaveClass(/text-warning/)
  await expect(progress.getByText('— Completed',{exact:true})).toHaveClass(/text-success/)
  await expect(progress.getByText('— Not started',{exact:true}).first()).toHaveClass(/text-fg-muted/)
  await page.reload()
  await expect(progress).toContainText('Documents verified')
  await page.screenshot({path:'test-results/recruitment-task-outcomes-desktop.png',fullPage:true,animations:'disabled'})
 })
 test('takeover, task progress, transition, URL reload and stale assignment',async({page})=>{
  const state=await fixture(page)
  await page.goto('/recruiter/recruitment?case=case1')
  const panel=page.getByRole('dialog')
  await expect(panel).toBeVisible()
  await panel.getByRole('button',{name:'Take over row',exact:true}).click()
  const interview=panel.getByRole('region',{name:'Interview',exact:true})
  await interview.getByRole('button',{name:'Start task',exact:true}).click()
  await expect(interview).toContainText('In progress')
  expect(state.assignments.find(a=>a.task_key==='case').assignee_id).toBe(fleetUser.id)
  expect(state.assignments.find(a=>a.task_key==='interview').assignee_id).toBe(fleetUser.id)
  await panel.getByRole('button',{name:'Mark contacted',exact:true}).click()
  await expect(panel.getByRole('button',{name:'Confirm interest',exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('region',{name:'Interview',exact:true})).toContainText('In progress')
  state.failNext=true
  await page.getByRole('dialog').getByRole('button',{name:'Take over row',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Someone updated')
  await page.getByRole('dialog').getByRole('button',{name:/Close alex/i}).click()
  await page.getByLabel('Work',{exact:true}).selectOption('mine')
  await expect(page.getByRole('button',{name:'Alex Morgan',exact:true})).toHaveCount(1)
  await page.screenshot({path:'test-results/recruitment-desktop.png',fullPage:true,animations:'disabled'})
 })
 test('Coordinator reads tasks but cannot take over or transition; mobile panel',async({page})=>{
  await fixture(page,{role:'Coordinator',operator:false})
  await page.setViewportSize({width:390,height:844})
  await page.goto('/recruiter/recruitment?case=case1')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button',{name:/Take over|Start task|Mark contacted/})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/recruitment-mobile.png',fullPage:true,animations:'disabled'})
 })
 test('KPI separates current workload from performer activity',async({page})=>{
  const state=await fixture(page)
  state.assignments=[{case_id:'case1',task_key:'case',assignee_id:fleetUser.id,version:1},{case_id:'case1',task_key:'interview',assignee_id:fleetUser.id,due_at:'2020-01-01',version:1}]
  const stamp=new Date().toISOString()
  state.events=[{id:'e1',case_id:'case1',event_type:'transition',from_status:'sourced',to_status:'contacted',actor_id:fleetUser.id,created_at:stamp},{id:'e2',case_id:'case1',event_type:'transition',from_status:'test_scheduled',to_status:'test_passed',actor_id:'another-recorder',created_at:stamp}]
  state.credits=[{event_id:'e2',case_id:'case1',performed_by:fleetUser.id,recorded_by:'another-recorder',occurred_at:stamp}]
  await page.goto('/recruiter/kpi')
  const section=page.getByRole('region',{name:'Recruiter work and activity'})
  await expect(section.getByRole('cell',{name:'Synthetic recruiter',exact:true})).toBeVisible()
  const cells=section.getByRole('row').nth(1).getByRole('cell')
  await expect(cells).toHaveText(['Synthetic recruiter','1','1','1','1','1','0','0'])
  await page.reload()
  await expect(cells).toHaveText(['Synthetic recruiter','1','1','1','1','1','0','0'])
  await page.screenshot({path:'test-results/recruitment-kpi.png',fullPage:true,animations:'disabled'})
 })
 test('candidate link opens the exact recruitment case',async({page})=>{
  await fixture(page)
  await page.goto('/recruiter/candidates?tab=attached')
  await page.getByRole('link',{name:'Open recruitment'}).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveURL(/recruitment\?case=case/)
 })
})
