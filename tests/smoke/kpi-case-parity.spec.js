/* global process */
import { test, expect } from '@playwright/test'

// Synthetic HTTP fixtures only. No staging/production credentials or writes.
const USER = { id: '00000000-0000-4000-8000-000000000091', email: 'kpi@example.invalid',
  role: 'authenticated', aud: 'authenticated' }
const OTHER = '00000000-0000-4000-8000-000000000092'
const stamp = '2026-11-06T00:00:00Z'
const requirements = [
  { id: 'r1', req_id_display: 'SYN-KPI-1', status: 'open', positions_required: 3,
    date_opened: '2026-11-01', target_days: 30, owner_recruiter_id: USER.id, updated_at: stamp },
  { id: 'r2', req_id_display: 'SYN-KPI-2', status: 'open', positions_required: 2,
    date_opened: '2026-11-01', target_days: 30, owner_recruiter_id: OTHER, updated_at: stamp },
]
const junctions = [
  { id: 'j1', requirement_id: 'r1', prospect_id: 'legacy1', status: 'joined', updated_at: stamp },
  { id: 'j2', requirement_id: 'r2', prospect_id: 'legacy2', status: 'joined', updated_at: stamp },
  { id: 'j3', requirement_id: 'r2', prospect_id: 'legacy3', status: 'joined', updated_at: stamp },
]
const cases = [
  { id: 'c1', requirement_id: 'r1', prospect_id: 'p1', status: 'hired', updated_at: stamp },
  { id: 'c2', requirement_id: 'r1', prospect_id: 'p1', status: 'hired', updated_at: stamp },
  { id: 'c3', requirement_id: 'r1', prospect_id: 'p2', status: 'hired', updated_at: stamp },
  { id: 'c4', requirement_id: 'r2', prospect_id: 'p3', status: 'interview_passed', updated_at: stamp },
]

async function fixture(page, { mode = 'cases', role = 'Master Recruiter' } = {}) {
  await page.addInitScript(user => {
    localStorage.setItem('njord-auth-token', JSON.stringify({
      access_token: 'synthetic-local-token', refresh_token: 'synthetic-local-refresh',
      token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user,
    }))
  }, USER)
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
    if (url.hostname !== 'supabase.invalid') return route.abort()
    const table = url.pathname.split('/').pop()
    const profile = { ...USER, full_name: 'Synthetic KPI owner', user_type: 'recruiter' }
    let body = []
    let status = 200
    if (table === 'user') body = USER
    else if (table === 'profiles') body = url.searchParams.has('id') ? profile : [profile,
      { id: OTHER, full_name: 'Other recruiter', user_roles: [{ roles: { name: 'Recruiter' } }] }]
    else if (table === 'user_roles') body = [{ role_id: 'fixture-role', roles: { name: role } }]
    else if (table === 'role_permissions') body = ['view_requirements', 'view_prospects', 'view_analytics',
      ...(role === 'Coordinator' ? [] : ['export_csv'])].map(name => ({ permissions: { name } }))
    else if (table === 'is_platform_operator') body = false
    else if (table === 'requirements') body = requirements
    else if (table === 'prospect_requirements') body = junctions
    else if (table === 'recruitment_cases' || table === 'recruitment_case_events') {
      if (mode === 'missing' || mode === 'denied') {
        status = mode === 'missing' ? 404 : 403
        body = { code: mode === 'missing' ? 'PGRST205' : '42501', message: mode === 'missing' ? 'Table missing' : 'Permission denied' }
      } else if (table === 'recruitment_cases') {
        expect((url.searchParams.get('select') || '').split(',').map(s => s.trim())).toContain('prospect_id')
        body = mode === 'empty' ? [] : cases
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

async function expectDesktopInset(page) {
  const layout = await page.evaluate(() => {
    const sidebar = document.querySelector('.recruiter-sidebar')
    const main = document.querySelector('main')
    return {
      shell: document.documentElement.dataset.shell,
      panelClass: sidebar?.parentElement.className,
      mainLeft: main?.getBoundingClientRect().left,
      sidebarRight: sidebar?.getBoundingClientRect().right,
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
    }
  })
  expect(layout.mainLeft, JSON.stringify(layout)).toBeGreaterThanOrEqual(layout.sidebarRight - 1)
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
}

const cardValue = (page, label) => page.locator('.stat-card')
  .filter({ has: page.getByText(label, { exact: true }) }).locator('.stat-card__value')

test.describe('KPI case parity (synthetic only)', () => {
  test.skip(!process.env.HOLMES_KPI_SYNTHETIC_SMOKE, 'Requires synthetic-only Vite configuration')
  test.use({ storageState: { cookies: [], origins: [] } })

  test('KPI uses distinct hires, scopes recruiters and keeps counts after refresh', async ({ page }) => {
    await fixture(page)
    await page.goto('/recruiter/kpi')
    await expect(cardValue(page, 'Joined vs required')).toHaveText('2 / 5')
    await expect(cardValue(page, 'Open positions')).toHaveText('3')
    await expectDesktopInset(page)
    await page.getByRole('combobox', { name: 'Recruiter', exact: true }).selectOption(USER.id)
    await expect(cardValue(page, 'Joined vs required')).toHaveText('2 / 3')
    await expect(cardValue(page, 'Open positions')).toHaveText('1')
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(cardValue(page, 'Joined vs required')).toHaveText('2 / 3')
    await expectDesktopInset(page)
    await page.getByRole('tab', { name: 'Charts', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Open positions by rank' })).toBeVisible()
    await expectDesktopInset(page)
    await page.screenshot({ path: 'test-results/kpi-case-charts.png' })
    await expectDesktopInset(page)
  })

  for (const path of ['/recruiter/requirements', '/recruiter/dashboard']) {
    test(`${path} shares the distinct hired total`, async ({ page }) => {
      await fixture(page)
      await page.goto(path)
      await expect(page.getByRole('row').filter({ hasText: 'SYN-KPI-1' })).toContainText('2 / 3')
      await expectDesktopInset(page)
    })
  }

  for (const [mode, filled, open] of [['missing', '3 / 5', '2'], ['empty', '0 / 5', '5']]) {
    test(`KPI ${mode} case data uses the correct authority`, async ({ page }) => {
      await fixture(page, { mode })
      await page.goto('/recruiter/kpi')
      await expect(cardValue(page, 'Joined vs required')).toHaveText(filled)
      await expect(cardValue(page, 'Open positions')).toHaveText(open)
      await expect(page.getByRole('heading', { name: 'Recruitment cases', exact: true })).toHaveCount(mode === 'missing' ? 0 : 1)
    })
  }

  test('case permission errors fail visibly instead of showing legacy totals', async ({ page }) => {
    await fixture(page, { mode: 'denied' })
    await page.goto('/recruiter/kpi')
    await expect(page.getByText('Could not load the live dashboard.', { exact: true })).toBeVisible()
    await expect(cardValue(page, 'Joined vs required')).toHaveCount(0)
  })

  test('Coordinator can read KPI and charts without report/export controls', async ({ page }) => {
    await fixture(page, { role: 'Coordinator' })
    await page.goto('/recruiter/kpi')
    await expect(cardValue(page, 'Joined vs required')).toHaveText('2 / 5')
    await expect(page.getByRole('tab', { name: 'Reports', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Download|Export/ })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Charts', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Open positions by rank' })).toBeVisible()
  })
})
