/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'

const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

test.describe('section 14 migrated data sanity', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet.')

  test('submitted application view shows normalized Section 14 fields only', async ({ page }) => {
    test.setTimeout(60_000)

    const publicToken = 'b4638c73-3adc-469e-9dd5-29b4bc5fe518'
    await page.goto(`/application/view/${publicToken}`)

    await expect(page.getByText('Loading application...')).toHaveCount(0, { timeout: 30000 })
    await expect(page.getByText('Application Summary').first()).toBeVisible({ timeout: 30000 })
    const section14Heading = page.getByRole('heading', { name: 'Additional Courses & Training' })
    await expect(section14Heading).toBeVisible()
    const section14 = section14Heading.locator('xpath=..')

    await expect(section14.getByText('Course Name').first()).toBeVisible()
    await expect(section14.getByText('IMO Model Course').first()).toBeVisible()
    await expect(section14.getByText('Reference- Regulation').first()).toBeVisible()
    await expect(section14.getByText('Certificate Number').first()).toBeVisible()
    await expect(section14.getByText('Date of Issue').first()).toBeVisible()
    await expect(section14.getByText('Date of Expiry').first()).toBeVisible()
    await expect(section14.getByText('Issuing Authority')).toHaveCount(0)
    await expect(section14.getByText('Place of Issue')).toHaveCount(0)
  })
})
