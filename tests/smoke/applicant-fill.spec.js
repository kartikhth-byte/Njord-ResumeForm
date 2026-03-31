/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'
import { SECTION_SEQUENCE, fillCurrentSection, navigateToSection, startBlankApplication } from '../helpers/applicantFormFill.js'

loadPlaywrightEnv()

const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

test.describe('applicant full test-data fill', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')

  test('fills visible fields across all applicant sections', async ({ page }) => {
    test.setTimeout(180_000)

    await startBlankApplication(page)

    for (const section of SECTION_SEQUENCE) {
      if (section.number !== 1) {
        await navigateToSection(page, section)
      }

      await fillCurrentSection(page)
      await expect(page).toHaveURL(new RegExp(`/application/form/section/${section.number}$`))
    }

    await page.waitForTimeout(5_000)
    await expect(page).toHaveURL(/\/application\/form\/section\/19$/)
    await expect(page.getByRole('button', { name: /Review & Submit/i })).toBeVisible()
    await expect(page.getByText(/Save failed/i)).toHaveCount(0)
  })
})
