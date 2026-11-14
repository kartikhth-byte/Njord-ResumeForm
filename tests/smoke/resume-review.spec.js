/* global process */
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession } from '../helpers/fleetFixture'

async function fixture(page, operator) {
  const state = createFleetFixture({role:'Recruiter', operator})
  await page.addInitScript(session=>localStorage.setItem('njord-auth-token',JSON.stringify(session)),fleetSession())
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url())
    const reply=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
    if(url.hostname==='supabase.invalid'){
      if(url.pathname.endsWith('/needle-token'))return reply({token:'synthetic'})
      const response=state.respond(url,req.method(),req.postData()?req.postDataJSON():null)
      return route.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(response.body)})
    }
    if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort()
    if(url.pathname==='/ai/auth/holmes')return reply({ok:true})
    if(url.pathname==='/ai/auth/me')return reply({authenticated:true})
    if(url.pathname==='/ai/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html><body><h1>Review frame fixture</h1><p id="route"></p><button id="open">Open synthetic version</button><button id="search">Go to search</button><script>
      const show=()=>document.getElementById('route').textContent=location.hash;
      show();document.getElementById('open').onclick=()=>{location.hash='/review?view=all&resume=synthetic&version=p2';show();parent.postMessage({type:'needle:route',path:location.hash.slice(1)},location.origin)};
      document.getElementById('search').onclick=()=>parent.postMessage({type:'needle:route',path:'/search'},location.origin);
      addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data.type==='holmes:navigate'){location.hash=e.data.path;show()}});
      </script></body></html>`})
    return route.continue()
  })
}
test.describe('Operator résumé review entry',()=>{
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE,'Synthetic server only')
  test.use({storageState:{cookies:[],origins:[]}})
  test('Operator entry, selected-version URL and reload',async({page})=>{
    await fixture(page,true);await page.goto('/operator?section=review')
    await page.getByRole('link',{name:'Open Résumé Review',exact:true}).click()
    const frame=page.frameLocator('iframe[title="Résumé Review"]')
    await expect(frame.getByRole('heading',{name:'Review frame fixture'})).toBeVisible()
    await frame.getByRole('button',{name:'Open synthetic version'}).click()
    await expect(page).toHaveURL(/\/recruiter\/ai\/review\?view=all&resume=synthetic&version=p2$/)
    await page.reload()
    await expect(page.frameLocator('iframe').locator('#route')).toHaveText('#/review?view=all&resume=synthetic&version=p2')
    await page.frameLocator('iframe').getByRole('button',{name:'Go to search'}).click()
    await expect(page).toHaveURL(/\/recruiter\/ai\/search$/)
  })
  test('Ordinary Recruiter cannot open review through a direct URL',async({page})=>{
    await fixture(page,false);await page.goto('/recruiter/ai/review?resume=synthetic')
    await expect(page).toHaveURL(/\/unauthorized$/)
    await expect(page.locator('iframe')).toHaveCount(0)
  })
})
