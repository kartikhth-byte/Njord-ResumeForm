/* global process */
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession, fleetUser } from '../helpers/fleetFixture'

async function fixture(page, { events = [], applications = [], expiringDocuments = [] } = {}) {
  const state = createFleetFixture()
  const base = state.respond
  await page.addInitScript(session => localStorage.setItem('njord-auth-token', JSON.stringify(session)), fleetSession())
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
    if (url.hostname !== 'supabase.invalid') return route.abort()
    const table = url.pathname.split('/').pop()
    let result
    if (table === 'scheduled_events') result = { status: 200, body: events }
    else if (table === 'applications') result = { status: 200, body: applications }
    else if (table === 'v_expiring_documents') result = { status: 200, body: expiringDocuments }
    else if (table === 'profiles' && url.searchParams.get('user_type') === 'eq.recruiter') result = { status: 200, body: [
      { id: fleetUser.id, full_name: 'Synthetic recruiter', email: fleetUser.email, user_type: 'recruiter', user_roles: [{ roles: { id: 'master', name: 'Master Recruiter' } }] },
      { id: 'teammate', full_name: 'Teammate', email: 'teammate@example.invalid', user_type: 'recruiter', user_roles: [{ roles: { id: 'recruiter', name: 'Recruiter' } }] },
    ] }
    else result = base(url, request.method(), request.postData() ? request.postDataJSON() : null)
    await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })
  })
}

test.describe('UI refinement (synthetic only)', () => {
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE, 'Requires synthetic-only Vite configuration')
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Home action opens the exact application and expiry windows filter records', async ({ page }) => {
    await fixture(page, {
      applications: [{ id: 'needs-owner', display_id: 'APP-000123', status: 'submitted', submitted_at: new Date().toISOString(), handling_recruiter_id: null }],
      expiringDocuments: [
        { application_id: 'app-1', document_key: 'passport', document_name: 'Passport', document_type: 'passport', applicant_name: 'Expired Seafarer', reference_number: 'FORM-1', expiry_date: '2026-11-01', days_until_expiry: -14, urgency_level: 'expired' },
        { application_id: 'app-2', document_key: 'medical', document_name: 'Medical', document_type: 'medical', applicant_name: 'Due Seafarer', reference_number: 'FORM-2', expiry_date: '2026-11-30', days_until_expiry: 15, urgency_level: 'critical' },
      ],
    })
    await page.goto('/recruiter/dashboard')
    const action = page.getByRole('region', { name: 'Needs action' }).getByRole('link', { name: 'Review' })
    await expect(action).toHaveAttribute('href', '/recruiter/applications?q=APP-000123')
    await page.goto('/recruiter/expiry')
    await expect(page.getByRole('row', { name: /Expired Seafarer/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Due Seafarer/ })).toBeVisible()
    await page.getByRole('tab', { name: /Expired/ }).click()
    await expect(page.getByRole('row', { name: /Expired Seafarer/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Due Seafarer/ })).toHaveCount(0)
  })

  test('recruiter sign-in error stays beside the password field', async ({ page }) => {
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
      if (url.hostname !== 'supabase.invalid') return route.abort()
      if (url.pathname.endsWith('/token')) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await page.goto('/recruiter/login')
    await page.getByLabel('Email').fill('recruiter@example.invalid')
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    const password = page.getByLabel('Password')
    const error = page.getByRole('alert')
    await expect(error).toContainText('Invalid login credentials')
    await expect(password).toHaveAttribute('aria-describedby', 'recruiter-signin-error')
    expect((await error.boundingBox()).y).toBeGreaterThan((await password.boundingBox()).y)
  })

  test('Calendar shows the next event from an empty selected day', async ({ page }) => {
    const next = new Date(); next.setDate(next.getDate() + 1)
    const date = [next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), String(next.getDate()).padStart(2, '0')].join('-')
    await fixture(page, { events: [{ id: 'next-event', event_title: 'Synthetic interview', event_type: 'interview', scheduled_date: date, scheduled_time: '10:00:00', status: 'scheduled' }] })
    await page.goto('/recruiter/calendar')
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: /All events/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Next events' })).toBeVisible()
    await page.getByRole('button', { name: /Synthetic interview/ }).last().click()
    await expect(page.getByRole('heading', { name: 'Next events' })).toHaveCount(0)
    await page.screenshot({ path: 'test-results/calendar-refined-desktop.png', fullPage: true, animations: 'disabled' })
  })

  test('Operator health retains evidence behind a compact table', async ({ page }) => {
    await fixture(page)
    await page.goto('/operator')
    const table = page.getByLabel('Operational health').getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('cell', { name: 'Intake worker' })).toBeVisible()
    await expect(page.getByText('Not observed').first()).toBeVisible()
    await page.getByText('Technical evidence').click()
    await expect(page.getByText(/Corpus \/ conversion/)).toBeVisible()
    await page.screenshot({ path: 'test-results/operator-refined-desktop.png', fullPage: true, animations: 'disabled' })
  })

  test('Settings keeps team actions behind three dots, with Remove last', async ({ page }) => {
    await fixture(page)
    await page.goto('/recruiter/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByLabel('Actions for Teammate').click()
    const menu = page.locator('details.team-actions[open]')
    await expect(menu.getByRole('button', { name: 'Send reset email' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Remove' })).toBeVisible()
    await page.screenshot({ path: 'test-results/settings-refined-desktop.png', fullPage: true, animations: 'disabled' })
  })
})
