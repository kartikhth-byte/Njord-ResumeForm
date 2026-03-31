/* global process */
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'

loadPlaywrightEnv()

const recruiterEmail = process.env.PLAYWRIGHT_RECRUITER_EMAIL
const recruiterPassword = process.env.PLAYWRIGHT_RECRUITER_PASSWORD
const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(applicantStorageState)

test.describe('submitted application view flows', () => {
  test.describe('applicant view', () => {
    test.use({ storageState: applicantStorageState })
    test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')

    test('dashboard view application opens a read-only applicant summary', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page.getByText('Loading your applications...')).toHaveCount(0, { timeout: 15000 })

      const viewButton = page.getByRole('button', { name: /View application/i }).first()
      const hasViewButton = await viewButton.isVisible().catch(() => false)
      test.skip(!hasViewButton, 'No submitted application is visible on the applicant dashboard in this environment.')

      await viewButton.click()
      await page.waitForURL(/\/application\/view\/.+$/, { timeout: 15000 })

      await expect(page.getByText('Application Summary').first()).toBeVisible()
      await expect(page.getByText('Application Status')).toBeVisible()
      await expect(page.getByText('Decision Actions')).toHaveCount(0)
      await expect(page.getByText('Candidate Review')).toHaveCount(0)
    })
  })

  test.describe('recruiter view', () => {
    test.skip(!recruiterEmail || !recruiterPassword, 'Recruiter credentials not configured for automated smoke tests.')

    test('applications workspace view application keeps recruiter review controls visible', async ({ page }) => {
      await page.goto('/recruiter/applications')

      if (!page.url().includes('/recruiter/applications')) {
        await expect(page.getByText('Checking session...')).toHaveCount(0, { timeout: 15000 })
        await page.getByPlaceholder('recruiter@njordships.com').fill(recruiterEmail)
        await page.getByPlaceholder('Enter your password').fill(recruiterPassword)
        await page.getByRole('button', { name: 'Sign In' }).click()
      }

      await page.waitForURL(/\/recruiter\/(dashboard|applications)$/, { timeout: 30000 })

      if (!page.url().includes('/recruiter/applications')) {
        await page.goto('/recruiter/applications')
      }

      const viewButton = page.locator('button[title="View application"]').first()
      const hasViewButton = await viewButton.isVisible().catch(() => false)
      test.skip(!hasViewButton, 'No recruiter application row is visible in this environment.')

      await viewButton.click()
      await page.waitForURL(/\/application\/view\/.+$/, { timeout: 15000 })

      await expect(page.getByText('Candidate Review')).toBeVisible()
      await expect(page.getByText('Decision Actions')).toBeVisible()
      await expect(page.getByText('Application Status')).toHaveCount(0)
    })
  })
})
