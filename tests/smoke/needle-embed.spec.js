/* global process */
import { test, expect } from '@playwright/test'

// Synthetic-only: tests/fixtures/holmes_embed_server.py in the Needle worktree.
// NEEDLE_DEV_URL must point there; Supabase requests are intercepted below.
const SOURCE = 'a'.repeat(64)
const FOREIGN = 'f'.repeat(64)
const USER = { id: '00000000-0000-4000-8000-000000000099', email: 'operator@example.invalid',
  role: 'authenticated', aud: 'authenticated' }

test.describe('Needle inside Holmes (synthetic local fixture)', () => {
  test.skip(!process.env.NEEDLE_EMBED_SYNTHETIC_SMOKE, 'Requires the local synthetic Needle fixture')
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page, request }) => {
    await page.addInitScript(({ user }) => {
      localStorage.setItem('njord-auth-token', JSON.stringify({
        access_token: 'synthetic-local-access-token', refresh_token: 'synthetic-refresh-token',
        token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user,
      }))
    }, { user: USER })
    await page.route('https://supabase.invalid/**', async route => {
      const path = new URL(route.request().url()).pathname
      let body = []
      if (path.endsWith('/needle-token')) {
        const response = await request.get('http://127.0.0.1:5191/_fixture/token')
        body = await response.json()
      } else if (path.includes('/profiles')) {
        body = { ...USER, full_name: 'Synthetic Operator', user_type: 'recruiter' }
      } else if (path.endsWith('/is_platform_operator')) {
        body = true
      } else if (path.endsWith('/user')) {
        body = USER
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
  })

  test('roleless operator reaches review queue and its /ai PDF links', async ({ page }) => {
    await page.goto('/operator?section=ai')
    await page.getByRole('link', { name: 'Review queue', exact: true }).click()
    const frame = page.frameLocator('iframe[title="AI search"]')
    await expect(frame.getByRole('heading', { name: 'Review queue', exact: true })).toBeVisible()
    await frame.getByRole('button', { name: /Synthetic conversion issue.pdf/ }).click()
    const pdf = frame.getByRole('link', { name: 'Open original PDF' })
    await expect(pdf).toHaveAttribute('href', '/ai/api/workspace/candidates/' + 'b'.repeat(64) + '/pdf')
    await expect(frame.getByRole('link', { name: 'Open page 2' })).toHaveAttribute('href', /\/ai\/.*\/pdf#page=2$/)
    await frame.getByText('Converted text', { exact: true }).click()
    await expect(frame.getByText('Synthetic converted source.', { exact: false })).toBeVisible()
    const response = await page.request.get(await pdf.getAttribute('href'))
    expect(response.headers()['content-type']).toContain('application/pdf')
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
    await page.screenshot({ path: 'test-results/needle-operator-review.png', fullPage: true })
  })

  test('repository, streaming search and foreign-source denial use the authenticated proxy', async ({ page }) => {
    await page.goto('/recruiter/ai/search')
    const frame = page.frameLocator('iframe[title="AI search"]')
    await expect(frame.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    const cookies = await page.context().cookies()
    expect(cookies.some(c => c.name === 'njordhr_ai_session' && c.path === '/ai' && c.httpOnly)).toBe(true)
    await frame.getByRole('link', { name: 'Repository', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/ai\/repository$/)
    await expect(frame.getByText('Synthetic Seafarer', { exact: true })).toBeVisible()
    await expect(frame.getByText('Foreign Private Person', { exact: true })).toHaveCount(0)
    await frame.getByRole('button', { name: /Synthetic Seafarer/ }).first().click()
    await expect(frame.getByRole('heading', { name: 'Synthetic Seafarer', exact: true })).toBeVisible()
    const download = frame.getByRole('link', { name: 'Download PDF', exact: true })
    await expect(download).toHaveAttribute('href', /^\/ai\/api\/workspace\/candidates\/.*\/pdf\?download=1$/)
    expect((await page.request.get(await download.getAttribute('href'))).headers()['content-type']).toContain('application/pdf')
    await frame.locator('[title="Close (Esc)"]').click()
    await page.goBack()
    await expect(page).toHaveURL(/\/recruiter\/ai\/search$/)
    await expect(frame.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    const project = await (await page.request.post('/ai/api/workspace/projects', { data: { name: 'Synthetic search smoke' } })).json()
    const chat = await (await page.request.post(`/ai/api/workspace/projects/${project.id}/chats`, { data: {} })).json()
    const run = await (await page.request.post(`/ai/api/workspace/chats/${chat.id}/runs`)).json()
    const search = await page.request.post(`/ai/api/workspace/runs/${run.id}/stages/stream`, {
      data: { filters: { present_ranks: ['chief_officer'] } },
    })
    expect(search.status()).toBe(200)
    expect(search.headers()['content-type']).toContain('text/event-stream')
    const events = await search.text()
    expect(events).toContain(SOURCE)
    expect(events).not.toContain(FOREIGN)
    expect(events).toContain('complete')
    for (const suffix of ['/pdf', '/markdown', '/facts']) {
      expect((await page.request.get(`/ai/api/workspace/candidates/${FOREIGN}${suffix}`)).status()).toBe(404)
    }
    await page.reload()
    await expect(frame.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
  })

  test('lost engine session renews once, then offers Retry; sign-out clears it', async ({ page }) => {
    await page.goto('/recruiter/ai/search')
    const frame = page.frameLocator('iframe[title="AI search"]')
    await expect(frame.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    for (let i = 0; i < 2; i += 1) {
      const renewed = i === 0 ? page.waitForResponse(response => response.url().endsWith('/ai/auth/holmes')) : null
      await page.request.post('/ai/auth/logout')
      await frame.locator('body').evaluate(() => window.location.reload())
      if (renewed) {
        expect((await renewed).status()).toBe(200)
        await expect(frame.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
      }
    }
    await expect(page.getByText('AI search is unavailable right now.')).toBeVisible()
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(frame.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    await page.goto('/operator')
    await page.getByRole('button', { name: /Synthetic Operator operator@example.invalid/ }).click()
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect.poll(async () => (await (await page.request.get('/ai/auth/me')).json()).authenticated).toBe(false)
  })
  for (const width of [311, 375, 640]) {
    test(`embedded search uses the full ${width}px pane and its menu remains usable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 656 })
      await page.goto('/recruiter/ai/search')
      const frame = page.frameLocator('iframe[title="AI search"]')
      const heading = frame.getByRole('heading', { name: 'Projects', exact: true })
      await expect(heading).toBeVisible()
      expect(await page.locator('body').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width)
      const bounds = await page.locator('iframe[title="AI search"]').boundingBox()
      expect(bounds.width).toBe(width)
      expect(bounds.y).toBeLessThanOrEqual(80)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(656)
      await expect(frame.getByRole('complementary', { name: 'Search navigation' })).toBeHidden()
      await frame.getByRole('button', { name: 'Search menu', exact: true }).click()
      await expect(frame.getByRole('button', { name: 'Search menu', exact: true })).toHaveAttribute('aria-expanded', 'true')
      await frame.getByRole('link', { name: 'Repository', exact: true }).click()
      await expect(page).toHaveURL(/\/recruiter\/ai\/repository$/)
      await expect(frame.getByText('Synthetic Seafarer', { exact: true })).toBeVisible()
      await expect(frame.getByRole('complementary', { name: 'Search navigation' })).toBeHidden()
      const menu = frame.getByRole('button', { name: 'Search menu', exact: true })
      await menu.press('Enter')
      const close = frame.getByRole('button', { name: 'Close search menu', exact: true })
      await expect(close).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(frame.getByRole('link', { name: 'Search', exact: true })).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(close).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(frame.getByRole('complementary', { name: 'Search navigation' })).toContainText('Search')
      await page.keyboard.press('Tab')
      await expect(close).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(frame.getByRole('complementary', { name: 'Search navigation' })).toBeHidden()
      await expect(menu).toBeFocused()
      await page.screenshot({ path: `test-results/needle-pane-${width}.png`, fullPage: true })
    })
  }

})
