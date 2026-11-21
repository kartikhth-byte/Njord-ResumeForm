/* global process, Buffer */
import {test,expect} from '@playwright/test'
import {createCandidateDirectoryFixture} from '../helpers/candidateDirectoryFixture'
import {fleetSession} from '../helpers/fleetFixture'

// Needs a synthetic server built with VITE_FEATURE_RESUME_INTAKE=on.
const resume={resume_id:'d'.repeat(64),resume_version_id:'ver1',evidence_id:'ev1',status:'complete',page_count:1,matches:[],conflicts:[],
 fields:{full_name:[{value:'Arjun Testkumar',page:1,method:'pdf_text',confidence:.95,evidence:'Arjun Testkumar'}],
  email:[{value:'arjun.testkumar@example.invalid',page:1,method:'pdf_text',confidence:.95,evidence:'Email'}],
  phone:[{value:'+91 90000 00001',page:1,method:'pdf_text',confidence:.9,evidence:'Phone'}],
  present_rank:[{value:'Master',page:1,method:'pdf_text',confidence:.9,evidence:'Rank: Master'}]}}
async function fixture(page) {
 const state=createCandidateDirectoryFixture()
 await page.addInitScript(session=>localStorage.setItem('njord-auth-token',JSON.stringify(session)),fleetSession())
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url())
  if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
  if(url.hostname!=='supabase.invalid')return route.abort()
  const table=url.pathname.split('/').pop()
  if(table==='resume-intake'){state.calls.push({table});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({resumes:[resume]})})}
  const body=req.postData()?req.postDataJSON():null
  if(table==='resume_lead_drafts'&&url.searchParams.has('id'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state.drafts.find(d=>d.id===url.searchParams.get('id').replace('eq.','')))})
  if(table==='review_platform_resume'||table==='review_resume_lead'){state.calls.push({table,body});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({prospect_id:'pNew'})})}
  const result=state.respond(url,req.method(),body)
  return route.fulfill({status:result.status,contentType:'application/json',body:JSON.stringify(result.body)})
 })
 return state
}
test.describe('One add-candidate form with CV',()=>{
 test.skip(!process.env.HOLMES_INTAKE_UI_SMOKE,'Synthetic intake-on server required')
 test.use({storageState:{cookies:[],origins:[]}})
 test('CV fills the same form, needs a check, and saves with the chosen requirement',async({page})=>{
  const state=await fixture(page)
  await page.goto('/recruiter/candidates')
  await page.getByRole('button',{name:'Add candidate',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Add candidate'})
  await expect(dialog.getByRole('button',{name:'Add CV (optional)'})).toHaveCount(0)
  await expect(dialog.getByText('Date contacted')).toHaveCount(0)
  await dialog.getByLabel('CV (PDF, optional)').setInputFiles({name:'cv.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')})
  await expect(dialog.getByRole('textbox',{name:'Candidate name'})).toHaveValue('Arjun Testkumar')
  await expect(dialog.getByRole('textbox',{name:'Email',exact:true})).toHaveValue('arjun.testkumar@example.invalid')
  await expect(dialog.getByRole('combobox',{name:'Present rank'})).toHaveValue('rank1')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await dialog.getByRole('combobox',{name:'Attach to requirement (optional)'}).selectOption('R1')
  await expect(dialog.getByRole('combobox',{name:'Vessel type'})).toHaveValue('v1')
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await expect(dialog.getByRole('alert')).toContainText('checked the details')
  await dialog.getByRole('checkbox',{name:'I checked these details against the CV.'}).check()
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Candidate saved and attached.'})).toBeVisible()
  const call=state.calls.find(c=>c.table==='review_platform_resume')
  expect(call.body).toMatchObject({p_version:'ver1',p_decision:'new',p_requirement:'R1',p_fields:{name:'Arjun Testkumar',telephone:'+919000000001',rank_id:'rank1',vessel_type_id:'v1'}})
 })
 test('a no-CV record gets its CV in the same edit form',async({page})=>{
  const state=await fixture(page)
  state.drafts[0]={...state.drafts[0],rank_id:'rank1',vessel_type_id:'v1'}
  await page.goto('/recruiter/candidates')
  await page.getByRole('button',{name:'Edit Robin Patel'}).click()
  const dialog=page.getByRole('dialog',{name:'Edit candidate'})
  await dialog.getByLabel('CV (PDF, optional)').setInputFiles({name:'cv.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic')})
  await expect(dialog.getByRole('textbox',{name:'Candidate name'})).toHaveValue('Robin Patel')
  await dialog.getByRole('checkbox',{name:'I checked these details against the CV.'}).check()
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Candidate saved.'})).toBeVisible()
  expect(state.calls.find(c=>c.table==='review_resume_lead').body).toMatchObject({p_lead:'draft1',p_lead_version:1,p_fields:{name:'Robin Patel',notes:'Synthetic draft'}})
 })
})
