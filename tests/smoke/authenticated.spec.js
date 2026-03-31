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

test.describe('authenticated recruiter smoke', () => {
  test.skip(!recruiterEmail || !recruiterPassword, 'Recruiter credentials not configured for automated smoke tests.')

  test('recruiter can sign in and reach dashboard', async ({ page }) => {
    await page.goto('/recruiter/login')

    if (!page.url().includes('/recruiter/dashboard')) {
      await expect(page.getByText('Checking session...')).toHaveCount(0, { timeout: 15000 })
      await page.getByPlaceholder('recruiter@njordships.com').fill(recruiterEmail)
      await page.getByPlaceholder('Enter your password').fill(recruiterPassword)
      await page.getByRole('button', { name: 'Sign In' }).click()
    }

    await page.waitForURL('**/recruiter/dashboard', { timeout: 30000 })
    await expect(page).toHaveURL(/\/recruiter\/dashboard$/)
    await expect(page.getByRole('heading', { name: /queue-first recruiting operations/i })).toBeVisible()
  })
})

test.describe('authenticated applicant smoke', () => {
  test.use({ storageState: applicantStorageState })
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet. Run npm run test:auth:applicant first.')

  test('stored applicant session can reach dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('Loading your applications...')).toHaveCount(0, { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Manage your maritime application journey' })).toBeVisible()
  })
})
