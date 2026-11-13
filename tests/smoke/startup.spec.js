/* global process */
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession, fleetUser } from '../helpers/fleetFixture'

async function fixture(page, { cached = true, role = 'Master Recruiter', applicant = false, delay = 0, holdProfile, roleFailure = false } = {}) {
  const state = createFleetFixture({ role, operator: false })
  const timings = []
  await page.addInitScript(({ session, cached }) => {
    localStorage.setItem('njord-auth-token', JSON.stringify(session))
    if (cached) localStorage.setItem('njord-authz-cache', JSON.stringify({
      userId: session.user.id, userType: 'recruiter', role: 'Master Recruiter',
      profile: { id: session.user.id, user_type: 'recruiter' }, permissions: [], isOperator: true,
    }))
  }, { session: fleetSession(), cached })
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
    if (url.hostname !== 'supabase.invalid') return route.abort()
    const table = url.pathname.split('/').pop()
    const authRead = ['profiles', 'user_roles', 'role_permissions', 'is_platform_operator'].includes(table)
    const timing = { table, start: Date.now() }
    if (authRead) timings.push(timing)
    if (table === 'profiles' && holdProfile) await holdProfile
    if (authRead && delay) await new Promise(resolve => setTimeout(resolve, delay))
    let result = state.respond(url, req.method(), req.postData() ? req.postDataJSON() : null)
    if (table === 'profiles' && applicant) result = { status: 200, body: { ...fleetUser, user_type: 'applicant' } }
    if (table === 'user_roles' && roleFailure) result = { status: 503, body: { message: 'Synthetic unavailable' } }
    timing.end = Date.now()
    await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
  })
  return timings
}

test.describe('Startup regression (synthetic only)', () => {
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE, 'Requires synthetic API configuration')
  test.use({ storageState: { cookies: [], origins: [] } })

  test('measures authenticated startup with identical delayed API reads', async ({ page }, info) => {
    const timings = await fixture(page, { delay: 300 })
    const start = Date.now()
    await page.goto('/recruiter/companies')
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('njord-authz-cache') || '{}').isOperator)).toBe(false)
    await expect(page.getByRole('button', { name: 'Add company', exact: true })).toBeEnabled()
    const durationMs = Date.now() - start
    const resources = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(r => new URL(r.name).pathname.endsWith('.js')).map(r => ({ path: new URL(r.name).pathname, bytes: r.decodedBodySize })))
    await info.attach('startup-measurement', { body: JSON.stringify({ durationMs, timings, resources }, null, 2), contentType: 'application/json' })
    console.log('Startup measurement:', JSON.stringify({ durationMs, authSpanMs: Math.max(...timings.map(t => t.end)) - Math.min(...timings.map(t => t.start)), scriptBytes: resources.reduce((sum, r) => sum + r.bytes, 0) }))
  })

  test('returning recruiter reads overlap but operator route waits for fresh authority', async ({ page }) => {
    let release
    const holdProfile = new Promise(resolve => { release = resolve })
    const timings = await fixture(page, { holdProfile })
    await page.goto('/operator')
    await expect.poll(() => timings.some(t => t.table === 'is_platform_operator')).toBe(true)
    expect(timings.find(t => t.table === 'profiles').end).toBeUndefined()
    await expect(page.getByLabel('Loading', { exact: true })).toBeVisible()
    release()
    await expect(page).toHaveURL(/unauthorized/)
  })

  test('fresh recruiter login without cache still resolves roles and page', async ({ page }) => {
    await fixture(page, { cached: false })
    await page.goto('/recruiter/companies')
    await expect(page.getByRole('button', { name: 'Add company', exact: true })).toBeEnabled()
  })

  test('fresh Coordinator authority replaces cached Master controls', async ({ page }) => {
    await fixture(page, { role: 'Coordinator' })
    await page.goto('/recruiter/companies')
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('njord-authz-cache') || '{}').role)).toBe('Coordinator')
    await expect(page.getByRole('button', { name: 'Add company', exact: true })).toHaveCount(0)
    await page.goto('/recruiter/expiry')
    await expect(page).toHaveURL(/unauthorized/)
  })

  test('applicant identity ignores speculative recruiter reads and redirects safely', async ({ page }) => {
    const timings = await fixture(page, { applicant: true, roleFailure: true })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/recruiter/companies')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('njord-authz-cache') || '{}').userType)).toBe('applicant')
    expect(timings.some(t => t.table === 'user_roles')).toBe(true)
    expect(errors).toEqual([])
    await expect(page.getByRole('button', { name: 'Add company', exact: true })).toHaveCount(0)
  })

  test('uncached applicant skips recruiter bootstrap', async ({ page }) => {
    const timings = await fixture(page, { cached: false, applicant: true })
    await page.goto('/recruiter/companies')
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(timings.some(t => t.table === 'user_roles' || t.table === 'is_platform_operator')).toBe(false)
  })

  test('production entry loads just the requested screen; navigation and reload load the next screen', async ({ page }) => {
    await fixture(page)
    const scripts = []
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()) })
    await page.goto('/recruiter/companies')
    await expect(page.getByRole('heading', { name: 'Companies & ships' })).toBeVisible()
    expect(scripts.some(url => /RecruiterCompaniesPage-/.test(url))).toBe(true)
    expect(scripts.some(url => /FormSection-|ViewApplication-|recruiterReportExportService-/.test(url))).toBe(false)
    await page.getByRole('button', { name: 'Requirements', exact: true }).click()
    await expect(page.getByRole('article', { name: 'SYN-R1', exact: true })).toBeVisible()
    expect(scripts.some(url => /RecruiterRequirementsPage-/.test(url))).toBe(true)
    await page.reload()
    await expect(page.getByRole('article', { name: 'SYN-R1', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Companies & ships' })).toBeVisible()
    await page.screenshot({ path: 'test-results/startup-companies.png', fullPage: true, animations: 'disabled' })
  })
})
