/* global process */
import { test, expect } from '@playwright/test'
import { fillCurrentSection, captureCurrentSectionFieldState, expectCurrentSectionFieldState, captureVisibleRequiredFieldState, expectVisibleRequiredFieldsFilled } from '../helpers/applicantFormFill'
import { fleetSession, fleetUser } from '../helpers/fleetFixture'

async function fixture(page, { failure, data = {} } = {}) {
  const state = { data, writes: [], claims: 0 }
  await page.addInitScript(({ session, failure }) => {
    if (!failure) localStorage.setItem('njord-auth-token', JSON.stringify(session))
    sessionStorage.setItem('njord-login-intent', 'applicant')
  }, { session: fleetSession(), failure })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop()
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue()
    if (url.hostname !== 'supabase.invalid') return route.abort()
    let body = [], status = 200
    if (table === 'user') body = fleetUser
    else if (table === 'verify') {
      body = failure === 'otp' ? { message: 'Token has expired or is invalid', error_code: 'otp_expired' } : fleetSession()
      if (failure === 'otp') status = 403
    } else if (table === 'claim_applicant_magic_link') {
      state.claims++
      status = 403; body = { message: 'Claim not eligible' }
    } else if (table === 'profiles') body = { ...fleetUser, user_type: 'applicant', full_name: 'Synthetic applicant' }
    else if (table === 'applications') body = { id: 'draft-1', user_id: fleetUser.id, status: 'new', submitted_at: null }
    else if (table === 'application_data') {
      if (request.method() === 'PATCH') {
        state.data = request.postDataJSON().data
        state.writes.push(state.data)
      }
      body = { id: 'data-1', application_id: 'draft-1', data: state.data }
    } else if (table === 'manage-runtime-settings') body = { settings: {} }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return state
}

test.describe('Applicant recovery and saved form validation', () => {
  test.skip(!process.env.HOLMES_FLEET_SYNTHETIC_SMOKE, 'Synthetic server required')
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const failure of ['otp', 'claim']) {
    test(`${failure} failure offers recovery without bypassing invitation checks`, async ({ page }) => {
      const state = await fixture(page, { failure })
      await page.goto('/auth/callback?token_hash=synthetic-used-token&type=email')
      await expect(page.getByRole('heading', { name: 'Link unavailable' })).toBeVisible()
      await expect(page).toHaveURL(/\/auth\/callback$/)
      await expect(page.getByText(/Your saved draft is kept/)).toBeVisible()
      expect(state.claims).toBe(failure === 'otp' ? 0 : 1)
      if (failure === 'otp') await page.screenshot({ path: 'test-results/link-recovery.png', fullPage: true, animations: 'disabled' })
      await page.getByRole('link', { name: 'Request a new sign-in link' }).click()
      await expect(page).toHaveURL(/\/applicant\/login$/)
      expect(state.writes).toEqual([])
    })
  }

  test('No is an explicit saved answer and survives reload; Yes requires details', async ({ page }) => {
    const state = await fixture(page)
    await page.goto('/application/form/section/11')
    await expect(page.getByRole('radio', { name: 'No', exact: true })).not.toBeChecked()
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).not.toBeChecked()
    expect(state.writes).toEqual([])
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await expect.poll(() => state.data.section11?.medicalHistory?.signedOffMedical).toBe(false)
    await page.reload()
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await page.locator('[name="vesselName"]').fill('Synthetic vessel')
    await page.locator('[name="description"]').fill('short')
    await expect(page.getByText(/at least 10 characters/)).toBeVisible()
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await expect(page.locator('[name="vesselName"]')).toHaveCount(0)
    await expect.poll(() => state.data.section11?.medicalHistory?.vesselName).toBe('')
    await page.reload()
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked()
    await page.screenshot({ path: 'test-results/medical-no.png', fullPage: true, animations: 'disabled' })
  })

  test('shared smoke helper preserves radio selections and medical details after reload', async ({ page }) => {
    const state = await fixture(page)
    await page.goto('/application/form/section/11')
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeVisible()
    const required = await captureVisibleRequiredFieldState(page)
    await fillCurrentSection(page, { skipFileInputs: true })
    await expectVisibleRequiredFieldsFilled(page, required)
    const fields = await captureCurrentSectionFieldState(page)
    await expect.poll(() => state.data.section11?.medicalHistory?.description).toBeTruthy()
    await page.reload()
    await expectCurrentSectionFieldState(page, fields)
  })

  test('uniform requirements show feedback, save and reload', async ({ page }) => {
    const state = await fixture(page, { data: { section13: { height: '178', weight: '78' } } })
    await page.goto('/application/form/section/13')
    await page.getByLabel('Sizing system', { exact: true }).focus()
    await page.getByLabel('Shoe size', { exact: true }).focus()
    await expect(page.getByText('Shoe size unit is required', { exact: true })).toBeVisible()
    await page.getByLabel('Height', { exact: true }).fill('0')
    await expect(page.getByText('Please enter a valid height', { exact: true })).toBeVisible()
    await page.getByLabel('Height', { exact: true }).fill('178')
    await page.getByLabel('Shoe size', { exact: true }).fill('42')
    await page.getByLabel('Sizing system', { exact: true }).selectOption('EU')
    await page.locator('[name="boilerSuitSize"]').selectOption('L')
    await page.locator('[name="uniformShirtSize"]').fill('40')
    await page.locator('[name="uniformTrouserSize"]').fill('32')
    await expect.poll(() => state.data.section13.uniformTrouserSize).toBe('32')
    await page.reload()
    await expect(page.getByLabel('Sizing system', { exact: true })).toHaveValue('EU')
    await expect(page.locator('[name="uniformTrouserSize"]')).toHaveValue('32')
    await page.screenshot({ path: 'test-results/uniform-complete.png', fullPage: true, animations: 'disabled' })
  })
})
