/* global process */
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession } from '../helpers/fleetFixture'

async function fixture(page, { collapsed = '0', role = 'Recruiter', operator = false } = {}) {
  const state = createFleetFixture({ role, operator })
  await page.addInitScript(({ session, collapsed }) => {
    localStorage.setItem('njord-auth-token', JSON.stringify(session))
    localStorage.setItem('holmes.sidebar.collapsed', collapsed)
  }, { session: fleetSession(), collapsed })
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    const reply = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.hostname === 'supabase.invalid') {
      if (url.pathname.endsWith('/needle-token')) return reply({ token: 'synthetic' })
      const result = state.respond(url, req.method(), req.postData() ? req.postDataJSON() : null)
      return route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
    }
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort()
    if (url.pathname === '/ai/auth/holmes') return reply({ ok: true })
    if (url.pathname === '/ai/auth/me') return reply({ authenticated: true })
    if (url.pathname === '/ai/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><h1>AI Search fixture</h1><input aria-label="Search resumes"></body></html>' })
    return route.continue()
  })
  return state
}
const sidebar = page => page.locator('#holmes-navigation')
async function ready(page) {
  await page.goto('/recruiter/ai/search')
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'AI Search fixture' })).toBeVisible()
}

test.describe('AI Search Holmes rail', () => {
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE, 'Requires synthetic Vite server with AI Search on')
  test.use({ storageState: { cookies: [], origins: [] } })
  for (const role of ['Master Recruiter', 'Recruiter']) test(`${role} opens AI Search and retains the rail after reload`, async ({ page }) => {
    await fixture(page, { role })
    await page.goto('/recruiter/companies')
    await page.getByRole('button', { name: 'AI search', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-rail', 'collapsed')
    await expect(sidebar(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Holmes' })).toBeVisible()
    await page.reload()
    await expect(page.frameLocator('iframe').getByRole('heading', { name: 'AI Search fixture' })).toBeVisible()
    await expect(sidebar(page)).toBeVisible()
  })
  test('Operator identity and organization role remain available in account menu', async ({ page }) => {
    await fixture(page, { operator: true }); await ready(page)
    await expect(page.getByRole('button', { name: 'Operator', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Account', exact: true }).click()
    await expect(page.getByRole('menu').getByText('Operator', { exact: true })).toBeVisible()
    await expect(page.getByRole('menu').getByText('Organization role: Recruiter', { exact: true })).toBeVisible()
  })
  test('desktop rail leaves search state and frame stable while navigating', async ({ page }) => {
    await fixture(page); await ready(page)
    const frame = page.locator('iframe'), before = await frame.boundingBox()
    expect(before.x).toBeGreaterThanOrEqual(64)
    await page.frameLocator('iframe').getByLabel('Search resumes').fill('keep my search')
    await page.getByRole('button', { name: 'AI search', exact: true }).focus()
    await expect(page.frameLocator('iframe').getByLabel('Search resumes')).toHaveValue('keep my search')
    expect(await frame.boundingBox()).toEqual(before)
    await page.screenshot({ path: 'test-results/ai-search-rail.png', animations: 'disabled' })
  })
  test('keyboard can leave AI Search and ordinary sidebar preference returns', async ({ page }) => {
    await fixture(page, { collapsed: '0' }); await ready(page)
    const back = page.getByRole('button', { name: 'Back to Holmes' })
    await back.focus(); await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/recruiter\/dashboard$/)
    await expect(page.locator('html')).toHaveAttribute('data-rail', 'expanded')
    expect(await page.evaluate(() => localStorage.getItem('holmes.sidebar.collapsed'))).toBe('0')
  })
  test('collapsed ordinary sidebar preference is preserved', async ({ page }) => {
    await fixture(page, { collapsed: '1' }); await ready(page)
    await page.getByRole('button', { name: 'Companies & ships', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-rail', 'collapsed')
    await expect(sidebar(page)).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('holmes.sidebar.collapsed'))).toBe('1')
  })
  test('mobile menu opens and closes without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await fixture(page); await ready(page)
    await expect(sidebar(page)).toBeHidden()
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('button', { name: 'Applications', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close menu' }).click()
    await expect(sidebar(page)).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  })
  test('Coordinator has no AI Search or Companies navigation', async ({ page }) => {
    await fixture(page, { role: 'Coordinator' })
    await page.goto('/recruiter/requirements')
    await expect(page.getByRole('button', { name: 'AI search', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Companies & ships', exact: true })).toHaveCount(0)
    await page.goto('/recruiter/companies')
    await expect(page).toHaveURL(/\/unauthorized$/)
    await page.goto('/recruiter/ai/search')
    await expect(page).toHaveURL(/\/unauthorized$/)
  })
})
