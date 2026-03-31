/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'
import {
  SECTION_SEQUENCE,
  captureCurrentSectionFieldState,
  expectCurrentSectionFieldState,
  fillCurrentSection,
  navigateToSection,
  startBlankApplication,
} from '../helpers/applicantFormFill.js'

loadPlaywrightEnv()

const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

test.describe('applicant section persistence smoke', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')

  test('persists visible field values when navigating away and back for every section', async ({ page }) => {
    test.setTimeout(420_000)

    await startBlankApplication(page)

    for (const section of SECTION_SEQUENCE) {
      if (section.number !== 1) {
        await navigateToSection(page, section)
      }

      await fillCurrentSection(page, { skipFileInputs: true })
      const fieldState = await captureCurrentSectionFieldState(page)
      const emptyState = page.locator('.applicant-empty-state').first()
      const hasVisibleEmptyState = await emptyState.isVisible().catch(() => false)

      if (fieldState.length === 0 && hasVisibleEmptyState) {
        const adjacentSection =
          section.number < SECTION_SEQUENCE.length
            ? SECTION_SEQUENCE[section.number]
            : SECTION_SEQUENCE[section.number - 2]

        await page.waitForTimeout(500)
        await expect(page.getByText(/Save failed/i)).toHaveCount(0)

        await navigateToSection(page, adjacentSection)
        await navigateToSection(page, section)
        await expect(page.locator('.applicant-empty-state').first()).toBeVisible()
        continue
      }

      expect(fieldState.length, `No visible named fields captured for section ${section.number} (${section.shortTitle})`).toBeGreaterThan(0)

      const adjacentSection =
        section.number < SECTION_SEQUENCE.length
          ? SECTION_SEQUENCE[section.number]
          : SECTION_SEQUENCE[section.number - 2]

      await page.waitForTimeout(500)
      await expect(page.getByText(/Save failed/i)).toHaveCount(0)

      await navigateToSection(page, adjacentSection)
      await navigateToSection(page, section)
      await expectCurrentSectionFieldState(page, fieldState)
    }
  })
})
