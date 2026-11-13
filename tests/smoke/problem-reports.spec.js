/* global process, Buffer */
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession, fleetUser } from '../helpers/fleetFixture'

async function fixture(page, { role='Recruiter', operator=false, failFinalize=false, applicant=false, anonymous=false }={}) {
  const fleet=createFleetFixture({role,operator}), state={rows:[],uploads:0,images:[],finalizations:0}
  await page.addInitScript(({session,anonymous})=>{if(!anonymous)localStorage.setItem('njord-auth-token',JSON.stringify(session))},{session:fleetSession(),anonymous})
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop()
    const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(url.hostname==='supabase.invalid') {
      if(url.pathname.includes('/storage/v1/object/')) {
        if(req.method()==='POST') {
          state.uploads++
          if(state.uploads>1) return reply({statusCode:'400',error:'Duplicate',message:'The resource already exists'},400)
          const bytes=req.postDataBuffer(),start=bytes.indexOf(Buffer.from([137,80,78,71,13,10,26,10])),end=bytes.indexOf(Buffer.from('IEND'),start)+8
          state.images.push(bytes.subarray(start,end))
          return reply({Key:url.pathname,Id:'synthetic'})
        }
        return route.fulfill({contentType:'image/png',body:state.images[0]})
      }
      const body=req.postData()?req.postDataJSON():null
      if(table==='begin_problem_report') {
        let row=state.rows.find(r=>r.id===body.p_id)
        if(!row){row={id:body.p_id,report_number:17,reporter_id:fleetUser.id,page:body.p_page,app_version:body.p_app_version,description:body.p_description,status:'new',screenshot_path:`${fleetUser.id}/${body.p_id}.png`,created_at:new Date().toISOString(),screenshot_expires_at:new Date(Date.now()+7*86400000).toISOString()};state.rows.push(row)}
        return reply(row)
      }
      if(table==='submit_problem_report'){state.finalizations++;if(failFinalize&&state.finalizations===1)return reply({message:'Synthetic temporary failure'},503);const row=state.rows.find(r=>r.id===body.p_id);row.submitted_at=new Date().toISOString();return reply(row)}
      if(table==='problem_reports')return reply(state.rows)
      if(table==='set_problem_report_status'){state.rows.find(r=>r.id===body.p_id).status=body.p_status;return reply(null)}
      if(table==='needle-token')return reply({token:'synthetic'})
      let result=fleet.respond(url,req.method(),body)
      if(table==='profiles'&&applicant)result={status:200,body:{...fleetUser,user_type:'applicant'}}
      return reply(result.body,result.status)
    }
    if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort()
    if(url.pathname==='/ai/auth/holmes')return reply({ok:true})
    if(url.pathname==='/ai/auth/me')return reply({authenticated:true})
    if(url.pathname==='/ai/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:rgb(120,30,80);color:white"><h1>AI Search screenshot fixture</h1><input type="password" value="SYNTHETIC-SECRET"></body></html>'})
    return route.continue()
  })
  return state
}
const plus=page=>page.getByRole('button',{name:'Report a problem',exact:true})
const preview=page=>page.getByRole('img',{name:'Screenshot preview'})
async function open(page,path='/recruiter/companies') {
  await page.goto(path);await expect(plus(page)).toBeVisible()
  if(path.includes('companies'))await expect(page.getByRole('region',{name:'Northstar Shipping',exact:true})).toBeVisible()
  await plus(page).click();await expect(preview(page)).toBeVisible({timeout:20000})
}
async function capturePixels(page) {
  return preview(page).evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);const pixel=(a,b)=>Array.from(x.getImageData(Math.floor(a*c.width),Math.floor(b*c.height),1,1).data);return {width:c.width,height:c.height,middle:pixel(.5,.5),corner:pixel(.95,.95)}})
}
test.describe('Two-click problem reporting (synthetic only)',()=>{
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE,'Requires synthetic configuration')
  test.use({storageState:{cookies:[],origins:[]}})
  test('plus captures real page, Send submits without a description; no eager capture bundle',async({page},info)=>{
    const state=await fixture(page),scripts=[];page.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url())})
    await page.goto('/recruiter/companies?token=must-not-store')
    await expect(page.getByRole('region',{name:'Northstar Shipping',exact:true})).toBeVisible()
    expect(scripts.some(s=>s.includes('html2canvas'))).toBe(false)
    await plus(page).click();await expect(preview(page)).toBeVisible()
    expect(state.uploads).toBe(0)
    expect((await capturePixels(page)).width).toBeGreaterThan(1000)
    await page.screenshot({path:'test-results/problem-report-preview.png'})
    await page.getByRole('button',{name:'Send',exact:true}).click()
    await expect(page.getByRole('status')).toHaveText('Report #17 sent')
    expect(state.rows).toHaveLength(1);expect(state.rows[0].description).toBe('');expect(state.rows[0].page).toBe('/recruiter/companies')
    expect(state.rows[0].app_version).toBe('defect-report-test')
    expect(state.images[0].length).toBeGreaterThan(5000)
    await info.attach('captured-app.png',{body:state.images[0],contentType:'image/png'})
  })
  test('retry after successful upload and failed finalization reuses one immutable report',async({page})=>{
    const state=await fixture(page,{failFinalize:true});await open(page)
    await page.getByLabel('What went wrong?').fill('Synthetic layout issue')
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Could not finish')
    await expect(preview(page)).toBeVisible();await page.getByRole('button',{name:'Send',exact:true}).click()
    await expect(page.getByRole('status')).toContainText('sent');expect(state.rows).toHaveLength(1);expect(state.finalizations).toBe(2)
  })
  test('same-origin AI frame is rendered in capture',async({page},info)=>{
    const state=await fixture(page);await page.goto('/recruiter/ai/search');await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('AI Search screenshot fixture')
    await plus(page).click();await expect(preview(page)).toBeVisible({timeout:20000});expect((await capturePixels(page)).middle.slice(0,3)).toEqual([120,30,80])
    await expect(page.getByText(/could not be captured/)).toHaveCount(0)
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status')).toContainText('sent')
    await info.attach('captured-ai.png',{body:state.images[0],contentType:'image/png'})
  })
  test('capture masks private elements, leaves source intact and hides report controls',async({page})=>{
    await fixture(page);await page.goto('/recruiter/companies');await expect(plus(page)).toBeVisible()
    await page.evaluate(()=>{const box=document.createElement('div');box.style.cssText='position:fixed;left:400px;top:300px;width:200px;height:150px;background:rgb(10,100,20);z-index:9999';box.innerHTML='<div data-report-private style="width:100px;height:100px;background:rgb(255,0,255)">PRIVATE</div>';document.body.append(box)})
    await plus(page).click();await expect(preview(page)).toBeVisible()
    const pixel=await preview(page).evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return Array.from(ctx.getImageData(450*img.naturalWidth/innerWidth,350*img.naturalHeight/innerHeight,1,1).data)})
    expect(pixel.slice(0,3)).toEqual([10,100,20])
    await expect(page.locator('[data-report-private]')).toHaveText('PRIVATE')
  })
  test('PDF limitation is explicit; screenshot upload is available',async({page})=>{
    await fixture(page);await page.goto('/recruiter/companies');await expect(plus(page)).toBeVisible()
    await page.evaluate(()=>{const embed=document.createElement('embed');embed.type='application/pdf';embed.style.cssText='position:fixed;left:300px;top:100px;width:200px;height:200px';document.body.append(embed)})
    await plus(page).click();await expect(preview(page)).toBeVisible();await expect(page.getByText(/PDF or video content may be missing/)).toBeVisible()
    await expect(page.getByLabel('Upload screenshot')).toHaveAttribute('type','file')
    await page.getByLabel('Upload screenshot').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')})
    await expect(page.getByRole('alert')).toContainText('PNG, JPEG or WebP')
  })
  test('drag remembers position without opening; keyboard and Escape work',async({page})=>{
    await fixture(page);await page.goto('/recruiter/companies');await expect(plus(page)).toBeVisible();const b=await plus(page).boundingBox()
    await page.mouse.move(b.x+20,b.y+20);await page.mouse.down();await page.mouse.move(600,350,{steps:8});await page.mouse.up()
    await expect(page.getByRole('dialog')).not.toBeVisible();const moved=await plus(page).boundingBox();expect(moved.x).toBeLessThan(b.x)
    await page.reload();await expect(plus(page)).toBeVisible();expect((await plus(page).boundingBox()).x).toBe(moved.x)
    await plus(page).focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await expect(preview(page)).toBeVisible()
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(plus(page)).toBeFocused()
  })
  test('replacement decode blocks Send until the new screenshot is ready',async({page})=>{
    const state=await fixture(page);await open(page)
    const png=await preview(page).evaluate(async img=>Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())))
    await page.evaluate(()=>{const original=window.createImageBitmap;window.createImageBitmap=(...args)=>new Promise(resolve=>{window.finishReportDecode=()=>resolve(original(...args))})})
    await page.getByLabel('Upload screenshot').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(png)})
    await expect(page.getByRole('button',{name:'Loading image…'})).toBeDisabled();expect(state.uploads).toBe(0)
    await page.evaluate(()=>window.finishReportDecode());await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled()
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status')).toContainText('sent')
  })
  test('reporting remains accessible and captures an open native app dialog',async({page},info)=>{
    const state=await fixture(page);await page.goto('/recruiter/companies');await expect(plus(page)).toBeVisible()
    await page.evaluate(()=>{const d=document.createElement('dialog');d.id='match-modal-fixture';d.style.cssText='position:fixed;inset:0;margin:auto;width:80vw;height:80vh;background:rgb(20,70,120);color:white';d.innerHTML='<h2>Requirement match results</h2>';document.body.append(d);d.showModal()})
    await expect(page.locator('#match-modal-fixture').getByRole('button',{name:'Report a problem',exact:true})).toBeVisible()
    await plus(page).click();await expect(preview(page)).toBeVisible()
    expect((await capturePixels(page)).middle.slice(0,3)).toEqual([20,70,120])
    await page.getByRole('button',{name:'Close report'}).click();await expect(page.locator('#match-modal-fixture')).toBeVisible();await expect(plus(page)).toBeFocused()
    await plus(page).click();await expect(preview(page)).toBeVisible();await page.getByRole('button',{name:'Send',exact:true}).click()
    await expect.poll(()=>state.rows.length).toBe(1);await info.attach('captured-modal.png',{body:state.images[0],contentType:'image/png'})
  })
  test('actual Recruitment panel yields keyboard focus to reporting and shows confirmation',async({page})=>{
    await fixture(page);await page.goto('/recruiter/recruitment?case=case1')
    const panel=page.getByRole('dialog');await expect(panel).toBeVisible();await expect(panel.getByRole('button',{name:'Report a problem',exact:true})).toBeVisible()
    await plus(page).click();await expect(preview(page)).toBeVisible()
    await page.getByRole('button',{name:'Close report'}).focus();await page.keyboard.press('Tab');await expect(page.getByLabel('What went wrong?')).toBeFocused()
    await page.keyboard.press('Tab');await expect(page.getByLabel('Upload screenshot')).toBeFocused()
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Report #17 sent')
  })
  test('mobile capture and dialog fit viewport; Coordinator can report',async({page})=>{
    await page.setViewportSize({width:390,height:844});await fixture(page,{role:'Coordinator'});await open(page)
    expect((await page.getByRole('dialog').boundingBox()).width).toBeLessThanOrEqual(390)
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status')).toContainText('sent')
  })
  test('own history and operator review/status use submitted reports',async({page})=>{
    const state=await fixture(page,{operator:true});await open(page);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('status')).toContainText('sent')
    await plus(page).click();await expect(preview(page)).toBeVisible();await page.getByRole('button',{name:'My reports'}).click();await expect(page.getByText('Report #17',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Close report'}).click();await page.goto('/operator?section=problems');await expect(page.getByText('Report #17',{exact:true})).toBeVisible()
    await page.getByLabel('Status for report 17').selectOption('resolved');await expect.poll(()=>state.rows[0].status).toBe('resolved')
    await page.getByRole('button',{name:'View screenshot'}).click();await expect(page.getByRole('img',{name:'Reported problem screenshot'})).toBeVisible()
  })
  test('anonymous login has no reporter; applicant can report without recruiter privileges',async({page})=>{
    await fixture(page,{anonymous:true});await page.goto('/recruiter/login');await expect(page.getByRole('button',{name:/sign in/i})).toBeVisible();await expect(plus(page)).toHaveCount(0)
  })
  test('applicant portal includes report action',async({page})=>{
    await fixture(page,{applicant:true});await page.goto('/dashboard');await expect(plus(page)).toBeVisible();await plus(page).click();await expect(preview(page)).toBeVisible()
  })
})
