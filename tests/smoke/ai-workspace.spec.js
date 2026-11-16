/* global process */
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession } from '../helpers/fleetFixture'

// Uses the real, isolated Needle fixture and production-built Needle UI.
// No production credentials, private résumés or model calls.
const fixtureUrl = process.env.NEEDLE_WORKSPACE_FIXTURE_URL || 'http://127.0.0.1:5196'
async function setup(page, request, { role = 'Recruiter', operator = false } = {}) {
  const state = createFleetFixture({ role, operator })
  const calls = { token: 0, me: 0 }
  await page.addInitScript(session => localStorage.setItem('njord-auth-token', JSON.stringify(session)), fleetSession())
  await page.route('https://supabase.invalid/**', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.pathname.endsWith('/needle-token')) {
      calls.token++
      const response = await request.get(`${fixtureUrl}/_fixture/token?role=${operator ? 'admin' : 'user'}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: await response.text() })
    }
    const result = state.respond(url, req.method(), req.postData() ? req.postDataJSON() : null)
    return route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
  })
  page.on('request', req => { if (new URL(req.url()).pathname === '/ai/auth/me') calls.me++ })
  calls.state = state
  return calls
}
const frame = page => page.frameLocator('iframe[title="AI search"]')
async function ready(page) {
  await page.goto('/recruiter/ai/search')
  await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
}
async function savedSearch(page) {
  const project = await (await page.request.post('/ai/api/workspace/projects', { data: { name: 'Workspace smoke ' + Date.now() } })).json()
  const chat = await (await page.request.post(`/ai/api/workspace/projects/${project.id}/chats`, { data: { title: 'Chief officers' } })).json()
  const run = await (await page.request.post(`/ai/api/workspace/chats/${chat.id}/runs`)).json()
  const response = await page.request.post(`/ai/api/workspace/runs/${run.id}/stages/stream`, { data: { filters: { present_ranks: ['chief_officer'] } } })
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('complete')
  await page.goto(`/recruiter/ai/search/${project.id}/${chat.id}`)
  await expect(frame(page).getByPlaceholder("Describe who you're looking for…")).toBeVisible()
  return { project, chat }
}

test.describe('Unified AI workspace', () => {
  test.skip(!process.env.NEEDLE_WORKSPACE_SMOKE, 'Requires synthetic loopback fixture')
  test.use({ storageState: { cookies: [], origins: [] } })
  test('static frame boots during delayed SSO without reading an existing cookie', async ({ page, request }) => {
    const calls = await setup(page, request)
    // Leave an old valid cookie in place: the early frame must not use it.
    const old = await request.get(`${fixtureUrl}/_fixture/token?role=admin`)
    await page.request.post('/ai/auth/holmes', { data: { token: (await old.json()).token } })
    let release
    const gate = new Promise(resolve => { release = resolve })
    await page.route('https://supabase.invalid/functions/v1/needle-token', async route => {
      await gate
      const token = await request.get(`${fixtureUrl}/_fixture/token?role=user`)
      await route.fulfill({ status: 200, contentType: 'application/json', body: await token.text() })
    })
    const protectedCalls = []
    page.on('request', req => {
      if (/\/ai\/(api|repository|candidate-facts|auth\/me)/.test(new URL(req.url()).pathname)) protectedCalls.push(req.url())
    })
    await page.goto('/recruiter/ai/search', { waitUntil: 'domcontentloaded' })
    await expect(frame(page).getByText('Loading…', { exact: true })).toBeAttached()
    expect(calls.me).toBe(0)
    expect(protectedCalls).toEqual([])
    await expect(page.getByText('Opening AI Search…', { exact: true })).toBeVisible()
    release()
    await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    expect(calls.me).toBe(1)
    await expect(frame(page).getByRole('link', { name: 'Résumé Review', exact: true })).toHaveCount(0)
  })
  test('failed sign-in never unlocks the early frame and Retry recovers', async ({ page, request }) => {
    const calls = await setup(page, request)
    await page.route('https://supabase.invalid/functions/v1/needle-token', route => route.fulfill({ status: 403, body: '{}' }))
    await page.goto('/recruiter/ai/search')
    await expect(page.getByText('AI search is unavailable right now.')).toBeVisible()
    expect(calls.me).toBe(0)
    await page.unroute('https://supabase.invalid/functions/v1/needle-token')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    expect(calls.me).toBe(1)
  })
  test('dropped first cookie and repeated boot signal do not interrupt slow recovery', async ({ page, request }) => {
    await setup(page, request)
    let exchanges = 0, release, entered
    const gate = new Promise(resolve => { release = resolve })
    const started = new Promise(resolve => { entered = resolve })
    await page.route('**/ai/auth/holmes', async route => {
      exchanges++
      if (exchanges === 1) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      entered(); await gate; await route.continue()
    })
    await page.goto('/recruiter/ai/search', { waitUntil: 'domcontentloaded' })
    await started
    await frame(page).locator('body').evaluate(() => window.parent.postMessage({ type: 'needle:booted' }, location.origin))
    // A round trip after the duplicate boot allows any mistaken auth-required
    // replay to reach Holmes while the real recovery is deliberately held.
    await expect(frame(page).getByText('Connecting…', { exact: true })).toBeVisible()
    const lateCheck = page.waitForResponse(r => r.url().endsWith('/ai/auth/me'))
    await frame(page).locator('body').evaluate(() => window.dispatchEvent(new Event('njord:unauthorized')))
    await lateCheck
    await expect(frame(page).getByText('Connecting…', { exact: true })).toBeVisible()
    release()
    await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    expect(exchanges).toBe(2)
  })
  test('one cookie check, persistent projects, rail, theme and library/PDF access', async ({ page, request }) => {
    const calls = await setup(page, request)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await ready(page)
    expect(calls.token).toBe(1); expect(calls.me).toBe(1)
    await expect(page.locator('#holmes-navigation')).toBeVisible()
    await expect(frame(page).getByRole('heading', { name: 'Projects & chats' })).toBeVisible()
    await expect(frame(page).getByRole('button', { name: 'Projects & chats' })).toBeHidden()
    await expect(frame(page).getByRole('link', { name: 'Résumé Review', exact: true })).toHaveCount(0)
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
    await expect(frame(page).locator('html')).toHaveAttribute('data-theme', 'light')
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect(frame(page).locator('html')).toHaveAttribute('data-theme', 'dark')
    await frame(page).getByRole('link', { name: 'Résumé library', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/ai\/repository$/)
    await expect(frame(page).getByText('Synthetic Seafarer', { exact: true })).toBeVisible()
    await frame(page).getByRole('button', { name: /Synthetic Seafarer/ }).first().click()
    await expect(frame(page).getByRole('heading', { name: 'Synthetic Seafarer', exact: true })).toBeVisible()
    const pdf = frame(page).getByRole('link', { name: 'Download PDF', exact: true })
    const response = await page.request.get(await pdf.getAttribute('href'))
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
    await page.screenshot({ path: 'test-results/ai-workspace-library.png' })
  })
  test('library Match Resume works with intake off and requires a reviewed requirement', async ({ page, request }) => {
    const calls = await setup(page, request)
    await ready(page)
    await frame(page).getByRole('link', { name: 'Résumé library', exact: true }).click()
    await frame(page).getByRole('button', { name: /Synthetic Seafarer/ }).first().click()
    await frame(page).getByRole('button', { name: 'Match Resume', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Match Resume', exact: true })
    await expect(dialog.getByRole('textbox', { name: 'Candidate name' })).toHaveValue('Synthetic Match')
    await expect(dialog.getByRole('combobox', { name: 'Requirement', exact: true }).locator('option:checked')).toHaveText('Choose a requirement')
    await expect(dialog.getByRole('button', { name: 'Add to requirement', exact: true })).toBeDisabled()
    await dialog.getByRole('checkbox', { name: 'I reviewed the original résumé, the chosen fields and the identity decision.' }).check()
    await expect(dialog.getByRole('button', { name: 'Add to requirement', exact: true })).toBeDisabled()
    await dialog.getByRole('combobox', { name: 'Requirement', exact: true }).selectOption('R1')
    await dialog.getByRole('checkbox', { name: 'I reviewed the original résumé, the chosen fields and the identity decision.' }).check()
    await dialog.getByRole('button', { name: 'Add to requirement', exact: true }).click()
    await expect(dialog.getByText('Added to requirement.', { exact: false })).toBeVisible()
    expect(calls.state.calls.filter(c => c.table === 'review_existing_resume').at(-1).body).toMatchObject({ p_requirement: 'R1', p_requirement_version: 1, p_decision: 'new' })
    expect(calls.state.calls.some(c => c.table === 'resume-intake')).toBe(false)
  })
  test('conversation fills its pane, explicit results, follow-up, fresh search and reload', async ({ page, request }) => {
    await setup(page, request); await page.setViewportSize({ width: 1440, height: 1000 }); await ready(page)
    await savedSearch(page)
    const ai = frame(page), prompt = ai.getByPlaceholder("Describe who you're looking for…")
    await prompt.fill('Keep this draft')
    await expect(ai.getByRole('separator')).toHaveCount(0)
    await expect(ai.getByText(/Choose Show results/)).toHaveCount(0)
    await page.screenshot({ path: 'test-results/ai-workspace-conversation.png' })
    const copy = ai.getByRole('button', { name: 'Copy response', exact: true }).first()
    await copy.focus()
    await expect(ai.getByRole('tooltip', { name: 'Copy response', exact: true }).first()).toBeVisible()
    await ai.locator('body').evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.syntheticCopiedText = text } } }) })
    await copy.click()
    await expect(ai.getByRole('status').filter({ hasText: /^Copied$/ })).toBeVisible()
    expect(await ai.locator('body').evaluate(() => window.syntheticCopiedText)).toContain('matching candidate')
    await ai.getByRole('button', { name: /Show results/ }).first().click()
    await expect(ai.getByRole('button', { name: '← Back to conversation' })).toBeVisible()
    await expect(ai.getByText('Synthetic Seafarer', { exact: true }).first()).toBeVisible()
    await expect(ai.getByText('2 years 6 months in present rank', { exact: true }).first()).toBeVisible()
    await expect(ai.getByText('Company continuity · 3 consecutive voyages · Synthetic Shipping', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/ai-workspace-continuity.png' })
    await expect(ai.getByRole('button', { name: 'Match Resume', exact: true }).first()).toBeEnabled()
    await ai.getByRole('button', { name: 'Match Resume', exact: true }).first().click()
    await expect(page.getByRole('dialog', { name: 'Match Resume', exact: true })).toBeVisible()
    await page.getByRole('dialog', { name: 'Match Resume', exact: true }).getByRole('button', { name: 'Close', exact: true }).click()
    await page.screenshot({ path: 'test-results/ai-workspace-results.png' })
    await ai.getByRole('button', { name: '← Back to conversation' }).click()
    await expect(prompt).toHaveValue('Keep this draft')
    await ai.getByRole('button', { name: /Follow up/ }).first().click()
    await expect(ai.getByPlaceholder('Ask a question or adjust this search…')).toBeVisible()
    await ai.getByRole('button', { name: 'New search', exact: true }).click()
    await expect(prompt).toHaveValue('')
    await expect(prompt).toBeFocused()
    await expect(ai.getByRole('separator')).toHaveCount(0)
    await page.reload()
    await expect(ai.getByRole('button', { name: /Show results/ }).first()).toBeVisible()
    await expect(ai.getByRole('button', { name: '← Back to conversation' })).toHaveCount(0)
  })
  test('narrow projects drawer preserves composer and dismisses with Escape', async ({ page, request }) => {
    await setup(page, request); await ready(page); await savedSearch(page)
    await page.setViewportSize({ width: 390, height: 844 })
    const ai = frame(page), prompt = ai.getByPlaceholder("Describe who you're looking for…")
    await prompt.fill('Narrow draft')
    await ai.getByRole('button', { name: 'Projects & chats' }).click()
    await expect(ai.getByRole('heading', { name: 'Projects & chats' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(ai.getByRole('heading', { name: 'Projects & chats' })).toBeHidden()
    await expect(ai.getByRole('button', { name: 'Projects & chats' })).toBeFocused()
    await expect(prompt).toHaveValue('Narrow draft')
    expect(await ai.locator('html').evaluate(node => node.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: 'test-results/ai-workspace-mobile.png' })
  })
  test('lost cookie renews once and repeated failure offers Retry', async ({ page, request }) => {
    await setup(page, request); await ready(page)
    for (let i = 0; i < 2; i++) {
      const renewed = i === 0 ? page.waitForResponse(r => r.url().endsWith('/ai/auth/holmes')) : null
      await page.request.post('/ai/auth/logout')
      await frame(page).locator('body').evaluate(() => { setTimeout(() => location.reload(), 0) })
      if (renewed) { expect((await renewed).status()).toBe(200); await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible() }
    }
    await expect(page.getByText('AI search is unavailable right now.')).toBeVisible()
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
  })
  test('navigation during delayed cookie renewal still resumes the same frame', async ({ page, request }) => {
    await setup(page, request); await ready(page)
    await frame(page).getByRole('link', { name: 'Résumé library', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/ai\/repository$/)
    let release, entered
    const gate = new Promise(resolve => { release = resolve })
    const started = new Promise(resolve => { entered = resolve })
    await page.route('https://supabase.invalid/functions/v1/needle-token', async route => {
      entered(); await gate
      const token = await request.get(`${fixtureUrl}/_fixture/token?role=user`)
      await route.fulfill({ status: 200, contentType: 'application/json', body: await token.text() })
    })
    await page.request.post('/ai/auth/logout')
    await frame(page).locator('body').evaluate(() => { setTimeout(() => location.reload(), 0) })
    await started
    await page.getByRole('button', { name: 'AI search', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/ai\/search$/)
    release()
    await expect(frame(page).getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/recruiter\/ai\/search$/)
  })

})
