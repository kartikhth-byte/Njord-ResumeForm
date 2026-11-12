/* global process */
import {test,expect} from '@playwright/test'
import {fleetSession,fleetUser} from '../helpers/fleetFixture'
async function fixture(page,{preferred=null,draft=false,legacy=false,history=false}={}) {
 const claims=[{case_id:'case-1',prospect_id:'p1',organization_name:'Synthetic agency',requirement_reference:'REQ-1',application_id:draft&&!legacy?'draft-1':null},{case_id:'case-2',prospect_id:'p1',organization_name:'Synthetic agency',requirement_reference:'REQ-2',application_id:null}]
 const state={claimedCase:'case-2',claims,starts:[],writes:[],fail:false,applications:draft?[{id:'draft-1',user_id:fleetUser.id,prospect_id:'p1',status:'new',submitted_at:null,updated_at:'2026-11-12T00:00:00Z',application_data:{data:{}}}]:[]}
 if(history)state.applications.push({id:'old',status:'withdrawn',submitted_at:'2026-10-12T00:00:00Z',created_at:'2026-10-01T00:00:00Z',reference_number:'OLD',application_data:{data:{}}})
 await page.addInitScript(({session,preferred})=>{
  localStorage.setItem('njord-auth-token',JSON.stringify(session))
  sessionStorage.setItem('njord-login-intent','applicant')
  if(preferred&&!sessionStorage.getItem('synthetic-preference-seeded')){sessionStorage.setItem('njord-applicant-case-id',preferred);sessionStorage.setItem('synthetic-preference-seeded','1')}
 },{session:fleetSession(),preferred})
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop()
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
  if(url.hostname!=='supabase.invalid')return route.abort()
  const body=req.postData()?req.postDataJSON():null
  let value=[],status=200
  if(table==='user')value=fleetUser
  else if(table==='verify')value=fleetSession()
  else if(table==='claim_applicant_magic_link')value={prospect_id:'p1',case_id:state.claimedCase,organization_id:'synthetic-org'}
  else if(table==='profiles')value={...fleetUser,user_type:'applicant',full_name:'Synthetic applicant'}
  else if(table==='get_applicant_claims'){value=state.claims;if(state.fail){status=503;value={message:'Synthetic read failure'}}}
  else if(table==='applications'){
   if(req.method()!=='GET')state.writes.push({table,method:req.method(),body})
   value=url.searchParams.has('id')?state.applications.find(a=>a.id===url.searchParams.get('id').slice(3)):state.applications
  }
  else if(table==='application_data'){
   if(req.method()!=='GET')state.writes.push({table,method:req.method(),body})
   value={application_id:'draft-1',data:{}}
  }
  else if(table==='start_claimed_application_for_case'){
   state.starts.push(body);value='new-draft'
   state.applications=[{id:'new-draft',user_id:fleetUser.id,status:'new',submitted_at:null,prospect_id:'p1',updated_at:new Date().toISOString(),application_data:{data:{}}}]
   state.claims=state.claims.map(c=>c.case_id===body.p_case_id?{...c,application_id:value}:c)
  }
  else if(table==='manage-runtime-settings')value={settings:{}}
  else if(req.method()!=='GET')state.writes.push({table,method:req.method(),body})
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)})
 })
 return state
}
test.describe('Invited application binding',()=>{
 test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE,'Synthetic server required')
 test.use({storageState:{cookies:[],origins:[]}})
 test('invite redemption preserves the exact case through redirect and clears stale context for generic sign-in',async({page})=>{
  const state=await fixture(page,{preferred:'case-1'})
  await page.goto('/auth/callback?token_hash=synthetic-token&type=email')
  await expect(page).toHaveURL(/dashboard$/)
  await expect(page.getByLabel('Invited requirement')).toHaveValue('case-2')
  state.claimedCase=null
  await page.goto('/auth/callback?token_hash=synthetic-reissue&type=email')
  await expect(page).toHaveURL(/dashboard$/)
  await expect(page.getByLabel('Invited requirement')).toHaveValue('')
  expect(state.starts).toEqual([])
 })
 test('multiple invitations require explicit requirement selection and the exact case is sent',async({page})=>{
  const state=await fixture(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('button',{name:'Start application',exact:true})).toBeDisabled()
  await page.getByLabel('Invited requirement').selectOption('case-2')
  await page.getByRole('button',{name:'Start application',exact:true}).click()
  await expect(page).toHaveURL(/application\/form\/section\/1/)
  expect(state.starts).toEqual([{p_case_id:'case-2',p_initial_data:{}}])
  await page.goto('/dashboard');await page.reload()
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeVisible()
  await expect(page.getByText(/This draft has no active/)).toHaveCount(0)
  expect(state.writes).toEqual([])
 })
 test('the case in the invite is preferred; an unavailable preference never chooses another case',async({page})=>{
  const state=await fixture(page,{preferred:'case-2'})
  await page.goto('/dashboard')
  await expect(page.getByLabel('Invited requirement')).toHaveValue('case-2')
  state.claims=state.claims.map(c=>({...c,case_id:c.case_id+'-other'}))
  await page.reload()
  await expect(page.getByLabel('Invited requirement')).toHaveValue('')
  await expect(page.getByRole('button',{name:'Start application',exact:true})).toBeDisabled()
 })
 test('an empty bound draft is preserved even with submitted history',async({page})=>{
  const state=await fixture(page,{draft:true,history:true})
  await page.goto('/dashboard')
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeVisible()
  expect(state.writes).toEqual([])
 })
 test('legacy drafts display correction guidance without guessing a link',async({page})=>{
  const state=await fixture(page,{draft:true,legacy:true})
  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('This draft has no active, invited recruitment link')
  await expect(page.getByRole('button',{name:'Discard draft',exact:true})).toBeVisible()
  expect(state.starts).toEqual([]);expect(state.writes).toEqual([])
 })
 test('invitation read failure is visible, retry recovers and no draft starts',async({page})=>{
  const state=await fixture(page);state.fail=true
  await page.goto('/dashboard')
  await expect(page.getByRole('alert')).toContainText('Could not load your applications and invitations')
  state.fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click()
  await expect(page.getByLabel('Invited requirement')).toBeVisible()
  expect(state.starts).toEqual([])
 })
})
