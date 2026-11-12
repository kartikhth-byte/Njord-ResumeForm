/* global process, Buffer */
import { jsPDF } from 'jspdf'
import { test, expect } from '@playwright/test'
import { createFleetFixture, fleetSession } from '../helpers/fleetFixture'

async function fixture(page, { role = 'Recruiter', applicant = false, denied = false, multiple = false, cv = true } = {}) {
  const pdf = new jsPDF(); pdf.text('SYNTHETIC Application Review CV', 20, 20)
  const base = createFleetFixture({ role, operator: false })
  const data = { section1: { appliedForRank: 'master', vesselType: 'bulk_carrier' }, section2: { firstName: 'Synthetic', surname: 'Review', email: 'synthetic@example.invalid' }, section3: { passportNumber: 'SYNTHETIC' }, section16: { seaService: [{ vesselName: 'Synthetic Vessel', rank: 'master' }] }, section19: { agreedToTerms: true } }
  const app = { id: 'a1', prospect_id: 'p1', user_id: fleetSession().user.id, public_token: 'synthetic-review', reference_number: 'FORM-REVIEW', status: 'submitted', submitted_at: '2026-11-12T00:00:00Z', application_data: { data } }
  const state = { reads: [], writes: [], failTable: '', failCv: false, cases: [{ id: 'case1', application_id: 'a1', prospect_id: 'p1', requirement_id: 'R1', cycle: 1 }], cvCalls: [] }
  if (multiple) state.cases.push({ id: 'case2', application_id: 'a1', prospect_id: 'p1', requirement_id: 'R2', cycle: 2 })
  await page.addInitScript(session => localStorage.setItem('njord-auth-token', JSON.stringify(session)), fleetSession())
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), table = url.pathname.split('/').pop()
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
    if (url.hostname !== 'supabase.invalid') return route.abort()
    const body = req.postData() ? req.postDataJSON() : null
    state.reads.push({ table, query: Object.fromEntries(url.searchParams) })
    if (table === state.failTable) return route.fulfill({ status: 503, json: { message: 'Synthetic read failure' } })
    if (table === 'manage-runtime-settings') return route.fulfill({ json: { settings: {} } })
    if (table === 'linked_platform_resume_version') { state.cvCalls.push(body); return route.fulfill({ json: null }) }
    if (table === 'needle-integration') {
      state.cvCalls.push(body)
      return state.failCv ? route.fulfill({ status: 503, json: { message: 'Synthetic PDF failure' } }) : route.fulfill({ contentType: 'application/pdf', body: Buffer.from(pdf.output('arraybuffer')) })
    }
    if (req.method() !== 'GET' && table !== 'is_platform_operator') state.writes.push(table)
    let result
    if (table === 'profiles' && url.searchParams.get('id')?.startsWith('in.')) result = [{ id: app.user_id, full_name: 'Synthetic Review', email: 'synthetic@example.invalid' }]
    else if (table === 'profiles' && applicant) result = { ...fleetSession().user, user_type: 'applicant', full_name: 'Synthetic Review' }
    else if (table === 'role_permissions' && denied) result = []
    else if (table === 'user_roles' && applicant) result = []
    else if (table === 'applications') {
      const rows = url.searchParams.has('public_token') && url.searchParams.get('public_token') !== 'eq.synthetic-review' ? [] : [app]
      result = req.headers().accept?.includes('object') ? rows[0] || null : rows
    } else if (table === 'application_data') result = { application_id: 'a1', data }
    else if (table === 'prospects') result = { id: 'p1', needle_resume_id: cv ? 'a'.repeat(64) : null }
    else if (table === 'recruitment_cases') result = state.cases.filter(row => url.searchParams.get('application_id') === `eq.${row.application_id}` || !url.searchParams.has('application_id'))
    else if (table === 'requirement_nationalities') result = []
    else if (table === 'requirements') result = base.requirements.filter(row => !url.searchParams.has('id') || url.searchParams.get('id').includes(row.id))
    else {
      const response = base.respond(url, req.method(), body)
      return route.fulfill({ status: response.status, json: response.body })
    }
    return route.fulfill({ json: result })
  })
  return state
}

test.describe('Submitted form review', () => {
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE, 'Synthetic server required')
  test.use({ storageState: { cookies: [], origins: [] } })
  for (const role of ['Master Recruiter', 'Recruiter', 'Coordinator']) test(`${role}: exact links, read-only findings, CV and layout`, async ({ page }) => {
    const state = await fixture(page, { role })
    await page.goto('/application/view/synthetic-review')
    await expect(page.getByRole('region', { name: 'Review findings', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review findings · SYN-R1' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open recruitment', exact: true })).toHaveAttribute('href', '/recruiter/recruitment?case=case1')
    await expect(page.getByText('No review flags.', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Schedule|Reopen|Mark as|Handled by/ })).toHaveCount(0)
    const popup = page.waitForEvent('popup')
    const downloaded = page.context().waitForEvent('page').then(tab => tab.waitForEvent('download'))
    await page.getByRole('button', { name: 'View CV', exact: true }).click()
    const cvTab = await popup
    const download = await downloaded
    expect(download.url()).toMatch(/^blob:/)
    await cvTab.close()
    expect(state.cvCalls).toEqual([{ p_prospect: 'p1', p_hash: 'a'.repeat(64) }, { action: 'view', prospect_id: 'p1', resume_id: 'a'.repeat(64) }])
    expect(state.reads.some(r => r.table === 'prospect_requirements')).toBe(false)
    expect(state.reads.find(r => r.table === 'recruitment_cases').query.application_id).toBe('eq.a1')
    await page.getByRole('link', { name: 'Documents', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Passport Details', exact: true })).toBeInViewport()
    if (role === 'Recruiter') {
      await page.goto('/application/view/synthetic-review')
      await expect(page.getByRole('link', { name: 'Open recruitment', exact: true })).toBeVisible()
      const sidebar = await page.getByRole('complementary', { name: 'Main', exact: true }).boundingBox()
      await expect.poll(async () => (await page.getByRole('button', { name: 'Back', exact: true }).boundingBox()).x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width)
      await page.screenshot({ path: 'test-results/application-review-desktop.png' })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'View CV', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (role === 'Recruiter') await page.screenshot({ path: 'test-results/application-review-mobile.png', fullPage: false })
    expect(state.writes).toEqual([])
  })
  test('multiple case links require selection; selection reloads without inventing a requirement', async ({ page }) => {
    await fixture(page, { multiple: true })
    await page.goto('/recruiter/applications?q=FORM-REVIEW')
    await page.getByRole('button', { name: 'View application', exact: true }).first().click()
    await expect(page.getByLabel('Linked recruitment')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open recruitment' })).toHaveCount(0)
    await page.getByLabel('Linked recruitment').selectOption('case2')
    await page.reload()
    await expect(page.getByLabel('Linked recruitment')).toHaveValue('case2')
    await expect(page.getByRole('link', { name: 'Open recruitment' })).toHaveAttribute('href', '/recruiter/recruitment?case=case2')
    await expect(page.getByRole('heading', { name: 'Review findings · SYN-R2' })).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/applications\?q=FORM-REVIEW$/)
  })
  test('missing links and missing CV are explicit; lookup failure can retry', async ({ page }) => {
    const state = await fixture(page, { cv: false }); state.cases = []; state.failTable = 'recruitment_cases'
    await page.goto('/application/view/synthetic-review')
    await expect(page.getByRole('alert')).toContainText('Could not load the CV and recruitment links')
    await expect(page.getByRole('region', { name: 'Personal & Contact Details' })).toBeVisible()
    state.failTable = ''
    await page.getByRole('button', { name: 'Retry links' }).click()
    await expect(page.getByText('No CV linked.', { exact: true })).toBeVisible()
    await expect(page.getByText(/No verified recruitment link/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open recruitment' })).toHaveCount(0)
  })
  test('CV error preserves form; Back uses safe directory fallback on direct load', async ({ page }) => {
    const state = await fixture(page); state.failCv = true
    await page.goto('/application/view/synthetic-review')
    await page.getByRole('button', { name: 'View CV' }).click()
    await expect(page.getByRole('alert')).toContainText('Could not open the CV')
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/applications$/)
  })
  test('Back preserves list filters after viewing and reloading', async ({ page }) => {
    await fixture(page)
    await page.goto('/recruiter/applications?q=FORM-REVIEW')
    await page.getByRole('button', { name: 'View application', exact: true }).first().click()
    await expect(page.getByRole('region', { name: 'Review findings', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Documents', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Passport Details', exact: true })).toBeInViewport()
    await page.reload()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page).toHaveURL(/\/recruiter\/applications\?q=FORM-REVIEW$/)
  })
  test('unauthorised recruiter cannot read form or context', async ({ page }) => {
    const state = await fixture(page, { denied: true })
    await page.goto('/application/view/synthetic-review')
    await expect(page.getByText('Your account cannot view applications')).toBeVisible()
    expect(state.reads.filter(r => ['applications', 'application_data', 'recruitment_cases', 'prospects'].includes(r.table))).toEqual([])
  })
  test('account switch hides the prior form while new authorization loads', async ({ page }) => {
    await fixture(page)
    await page.goto('/application/view/synthetic-review')
    await expect(page.getByRole('heading', { name: 'Synthetic Review' })).toBeVisible()
    await page.route('**/rest/v1/profiles*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      await route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000092', user_type: 'recruiter' } })
    })
    await page.evaluate(() => {
      const oldValue = localStorage.getItem('njord-auth-token')
      const session = JSON.parse(oldValue)
      session.user.id = '00000000-0000-4000-8000-000000000092'
      session.access_token = 'different-synthetic-token'
      const newValue = JSON.stringify(session)
      localStorage.setItem('njord-auth-token', newValue)
      const channel = new BroadcastChannel('njord-auth-token')
      channel.postMessage({ event: 'SIGNED_IN', session })
      channel.close()
    })
    await expect(page.getByText('Loading application...')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Synthetic Review' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'View CV' })).toHaveCount(0)
  })
  test('applicant retains own read-only form and never loads recruiter context', async ({ page }) => {
    const state = await fixture(page, { applicant: true })
    await page.goto('/application/view/synthetic-review')
    await expect(page.getByRole('heading', { name: 'Synthetic Review' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open recruitment' })).toHaveCount(0)
    expect(state.reads.filter(r => ['recruitment_cases', 'prospects'].includes(r.table))).toEqual([])
    expect(state.reads.find(r => r.table === 'applications').query.user_id).toBe(`eq.${fleetSession().user.id}`)
  })
})
