/* global process */
import {test,expect} from '@playwright/test'
import {createFleetFixture,fleetSession} from '../helpers/fleetFixture'
async function fixture(page,{role='Recruiter',many=false}={}) {
 const base=createFleetFixture({role,operator:false})
 const form=(id,name,status='submitted',prospect='p1')=>({id,user_id:'applicant',prospect_id:prospect,reference_number:`FORM-${id}`,public_token:`synthetic-${id}`,submitted_at:'2026-11-10T10:00:00Z',status,applied_rank:'master',application_data:{data:{section1:{appliedForRank:'master',vesselType:'bulk_carrier'},section2:{firstName:name,nationality:'indian'}}}})
 const state={...base,applications:[form('a1','Alex'),form('a2','Jamie','hired','p2'),form('a3','Robin','withdrawn','p3'),{...form('draft','Draft'),submitted_at:null}],reads:[],writes:[],failTable:''}
 state.cases=[{id:'case1',application_id:'a1',prospect_id:'p1',requirement_id:'R1',status:'interview_passed',cycle:1},{id:'case2',application_id:'a1',prospect_id:'p1',requirement_id:'CLOSED',status:'closed',cycle:2},{id:'case3',application_id:'a1',prospect_id:'p1',requirement_id:'R3',status:'hired',cycle:1},{id:'unrelated',application_id:null,prospect_id:'p2',requirement_id:'R2',status:'sourced'}]
 if(many)for(let i=4;i<=24;i++)state.applications.push(form(`a${i}`,`Person ${i}`))
 await page.addInitScript(session=>localStorage.setItem('njord-auth-token',JSON.stringify(session)),fleetSession())
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop()
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
  if(url.hostname!=='supabase.invalid')return route.abort()
  const clientConfigRead = table==='manage-runtime-settings' && req.postDataJSON()?.action==='get_client_config'
  if(clientConfigRead)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({settings:{}})})
  if(req.method()!=='GET' && !['is_platform_operator','logout'].includes(table))state.writes.push({table,method:req.method()})
  state.reads.push({table,query:Object.fromEntries(url.searchParams)})
  if(table==='applications' && state.delayNextApplication){state.delayNextApplication=false;await new Promise(resolve=>setTimeout(resolve,750))}
  if(state.failTable===table)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic lookup failed'})})
  let result
  if(table==='profiles'&&url.searchParams.get('id')?.startsWith('in.'))result={status:200,body:[{id:'applicant',full_name:'Synthetic applicant',email:'synthetic@example.invalid'}]}
  else if(table==='applications'||table==='recruitment_cases'||['requirements','client_companies','client_ships'].includes(table)) {
   let rows=table==='applications'?state.applications:table==='recruitment_cases'?state.cases:table==='requirements'?state.requirements:table==='client_companies'?state.companies:state.ships
   for(const [key,filter] of url.searchParams){
    if(filter.startsWith('in.')){const ids=filter.slice(4,-1).split(',');rows=rows.filter(r=>ids.includes(r[key]))}
    if(filter.startsWith('eq.'))rows=rows.filter(r=>r[key]===filter.slice(3))
    if(filter==='not.is.null')rows=rows.filter(r=>r[key]!=null)
    if(filter.startsWith('gte.'))rows=rows.filter(r=>r[key]>=filter.slice(4))
    if(filter.startsWith('lte.'))rows=rows.filter(r=>r[key]<=filter.slice(4))
   }
   const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000)
   result={status:200,body:rows.slice(offset,offset+limit)}
  } else result=base.respond(url,req.method(),req.postData()?req.postDataJSON():null)
  return route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)})
 })
 return state
}
test.describe('Applications directory',()=>{
 test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE,'Synthetic server required')
 test.use({storageState:{cookies:[],origins:[]}})
 test('submitted forms group by exact fleet links; unlinked and closed forms remain visible',async({page})=>{
  const state=await fixture(page)
  await page.goto('/recruiter/applications')
  await expect(page.getByRole('button',{name:'All submitted (3)',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Linked (1)',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Not linked (2)',exact:true})).toBeVisible()
  const groups=page.getByRole('region',{name:'Applications by company and ship'})
  await expect(groups.getByText('Draft',{exact:true})).toHaveCount(0)
  await expect(groups.getByRole('button',{name:'View application'})).toHaveCount(4)
  await expect(groups.getByRole('link',{name:'SYN-CLOSED',exact:true})).toHaveAttribute('href','/recruiter/recruitment?case=case2')
  await expect(groups.getByRole('link',{name:'SYN-R2',exact:true})).toHaveCount(0)
  await expect(page.getByRole('group',{name:'Pipeline stage'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:/Schedule Test|Mark as|Take over/})).toHaveCount(0)
  const company=groups.locator('summary').filter({hasText:'Company · Northstar Shipping'})
  await company.click()
  await page.getByLabel('Search',{exact:true}).fill('SYN-R1')
  await expect(groups.getByText('Alex',{exact:true})).toHaveCount(1)
  await expect(groups.getByText('Alex',{exact:true})).toBeVisible()
  await expect(page.getByRole('status')).toContainText('1 submitted application')
  await page.getByLabel('Search',{exact:true}).fill('')
  await page.screenshot({path:'test-results/applications-desktop.png',fullPage:true,animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/applications-mobile.png',fullPage:true,animations:'disabled'})
  expect(state.writes).toHaveLength(0)
 })
 test('same-placement filters persist on reload and company changes clear dependent filters',async({page})=>{
  await fixture(page)
  await page.goto('/recruiter/applications?company=c1&requirement=R3')
  await expect(page.getByText('No submitted applications match these filters.')).toBeVisible()
  await page.getByLabel('Company',{exact:true}).selectOption('c2')
  await expect(page.getByRole('link',{name:'SYN-R3',exact:true})).toBeVisible()
  await page.getByLabel('Ship',{exact:true}).selectOption('s3')
  await page.getByLabel('Document checks').selectOption('red')
  await page.reload()
  await expect(page.getByLabel('Company',{exact:true})).toHaveValue('c2')
  await expect(page.getByLabel('Ship',{exact:true})).toHaveValue('s3')
  await expect(page.getByRole('link',{name:'SYN-R3',exact:true})).toBeVisible()
  await page.getByLabel('Search',{exact:true}).fill('no such candidate')
  await expect(page.getByText('No submitted applications match these filters.')).toBeVisible()
 })
 test('Coordinator reads forms and links without workflow or contract mutation controls',async({page})=>{
  const state=await fixture(page,{role:'Coordinator'})
  await page.goto('/recruiter/applications')
  await expect(page.getByRole('button',{name:'All submitted (3)',exact:true})).toBeVisible()
  await expect(page.getByLabel(/Contract ends/)).toHaveCount(0)
  await expect(page.getByRole('link',{name:'Open recruitment',exact:true})).toHaveAttribute('href','/recruiter/recruitment?case=case3')
  await page.getByRole('button',{name:'Not linked (2)',exact:true}).click()
  await expect(page.getByRole('link',{name:'Open recruitment',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'View application',exact:true}).first().click()
  await expect(page).toHaveURL(/\/application\/view\/synthetic-a2$/)
  expect(state.writes).toHaveLength(0)
 })
 test('lookup failure is not mistaken for an empty or unlinked result and retry recovers',async({page})=>{
  const state=await fixture(page);state.failTable='recruitment_cases'
  await page.goto('/recruiter/applications')
  await expect(page.getByRole('alert')).toContainText('Could not load applications and their recruitment links')
  await expect(page.getByRole('region',{name:'Applications by company and ship'})).toHaveCount(0)
  state.failTable=''
  await page.getByRole('button',{name:'Retry',exact:true}).click()
  await expect(page.getByRole('button',{name:'All submitted (3)',exact:true})).toBeVisible()
 })
 test('saved status links remain explicit and can be cleared; advanced filters apply and reload',async({page})=>{
  const state=await fixture(page)
  await page.goto('/recruiter/applications?status=hired')
  await expect(page.getByRole('button',{name:'All submitted (1)',exact:true})).toBeVisible()
  await expect(page.getByText('Saved status filter: Hired')).toBeVisible()
  await page.getByRole('button',{name:'Clear status filter'}).click()
  await expect(page.getByRole('button',{name:'All submitted (3)',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'More filters',exact:true}).click()
  await page.getByLabel('Rank',{exact:true}).selectOption('master')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(page).toHaveURL(/filters=/)
  await page.reload()
  await expect(page.getByRole('button',{name:'More filters (1)',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'More filters (1)',exact:true}).click()
  await expect(page.getByLabel('Rank',{exact:true})).toHaveValue('master')
  await page.getByRole('button',{name:'Clear',exact:true}).click()
  await expect(page).not.toHaveURL(/filters=/)
  expect(state.writes).toHaveLength(0)
 })
 test('filter application supersedes an in-flight refresh without sticking the loading state',async({page})=>{
  const state=await fixture(page)
  await page.goto('/recruiter/applications')
  await expect(page.getByRole('button',{name:'All submitted (3)',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'More filters',exact:true}).click()
  state.delayNextApplication=true
  await page.getByRole('button',{name:'Refresh',exact:true}).click()
  await page.getByLabel('Rank',{exact:true}).selectOption('chief_officer')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(page.getByText('No submitted applications match these filters.')).toBeVisible()
  await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeEnabled()
  await expect(page.getByRole('status')).not.toContainText('Refreshing')
 })
 test('existing Teams callback resumes only the eligible form without sending anything',async({page})=>{
  const state=await fixture(page)
  state.applications[0].status='test_passed'
  await page.addInitScript(()=>localStorage.setItem('reopen_interview_modal','a1'))
  await page.goto('/recruiter/applications?teams_connected=true')
  await expect(page.getByRole('heading',{name:'Schedule interview',exact:true})).toBeVisible()
  await expect(page).not.toHaveURL(/teams_connected/)
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Schedule interview',exact:true})).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
 })
 test('pagination counts unique applications and remains usable after narrowing results',async({page})=>{
  await fixture(page,{many:true})
  await page.goto('/recruiter/applications')
  await expect(page.getByRole('button',{name:'All submitted (24)',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Next',exact:true}).last().click()
  await expect(page.getByRole('region',{name:'Applications by company and ship'}).getByRole('button',{name:'View application'})).toHaveCount(4)
  await page.getByLabel('Search',{exact:true}).fill('Jamie')
  await expect(page.getByRole('status')).toContainText('1 submitted application')
  await expect(page.getByText('Jamie',{exact:true})).toBeVisible()
 })
})
