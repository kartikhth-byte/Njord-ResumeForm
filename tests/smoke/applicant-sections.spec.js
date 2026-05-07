/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'
import { prepareDraftApplicantState } from '../helpers/draftApplicantState.js'

loadPlaywrightEnv()

const applicantStorageState =
  process.env.PLAYWRIGHT_DRAFT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant-draft.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

const sections = [
  { number: 1, name: 'Availability & Application' },
  { number: 2, name: 'Personal & Contact Details' },
  { number: 3, name: 'Passport Details' },
  { number: 4, name: 'CDC / Seaman’s Book' },
  { number: 5, name: 'Visas' },
  { number: 6, name: 'Education Background' },
  { number: 7, name: 'Dependents' },
  { number: 8, name: 'Certificates of Competency' },
  { number: 9, name: 'GMDSS Certificates' },
  { number: 10, name: 'Medical & Vaccination' },
  { number: 11, name: 'Medical History' },
  { number: 12, name: 'Foreign Languages' },
  { number: 13, name: 'Physical & Uniform Details' },
  { number: 14, name: 'STCW & Marine Courses' },
  { number: 15, name: 'Flag State Documents' },
  { number: 16, name: 'Sea Service' },
  { number: 17, name: 'Experience Summary' },
  { number: 18, name: 'References' },
  { number: 19, name: 'Declaration & Consent' },
]

test.describe('applicant section route smoke', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')
  test.beforeEach(async () => {
    await prepareDraftApplicantState()
  })

  for (const section of sections) {
    test(`section ${section.number} loads correctly`, async ({ page }) => {
      await page.goto(`/application/form/section/${section.number}`)

      await expect(page.getByText('Loading application...')).toHaveCount(0, { timeout: 15000 })
      await expect(page).toHaveURL(new RegExp(`/application/form/section/${section.number}$`))
      await expect(page.getByText('Guided Form')).toBeVisible()
      const visibleLabel = FORM_SECTION_NUMBERS.indexOf(section.number) + 1
      await expect(page.getByText(`Section ${visibleLabel} of ${FORM_SECTION_NUMBERS.length}`)).toBeVisible()
      await expect(page.getByRole('button', { name: new RegExp(`Section ${section.number}:`) })).toBeVisible()
      await expect(page.locator('.applicant-panel').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Review & Submit/i })).toBeVisible()
    })
  }
})
import { FORM_SECTION_NUMBERS } from '../../src/constants/formSections.js'
