/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'
import {
  SECTION_SEQUENCE,
  captureVisibleRequiredFieldState,
  expectVisibleRequiredFieldsFilled,
  fillCurrentSection,
  navigateToSection,
  startBlankApplication,
} from '../helpers/applicantFormFill.js'

loadPlaywrightEnv()

const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

test.describe('applicant required-field coverage', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')

  for (const section of SECTION_SEQUENCE) {
    test(`section ${section.number} fills all visible required fields`, async ({ page }) => {
      test.setTimeout(60_000)

      await startBlankApplication(page)
      if (section.number !== 1) {
        await navigateToSection(page, section)
      }

      const requiredFields = await captureVisibleRequiredFieldState(page)
      await fillCurrentSection(page)

      if (requiredFields.length > 0) {
        await expectVisibleRequiredFieldsFilled(page, requiredFields)
      }

      await expect(page.getByText(/Save failed/i)).toHaveCount(0)
    })
  }
})
