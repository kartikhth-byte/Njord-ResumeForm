/* global process */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'

const authFile = process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'

test.setTimeout(5 * 60 * 1000)

test('capture applicant Google auth session', async ({ page, context, baseURL }) => {
  const authDir = path.dirname(authFile)
  fs.mkdirSync(authDir, { recursive: true })
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile)
  }

  await page.goto(`${baseURL}/login`)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

  await page.getByRole('button', { name: 'Continue with Google' }).click()

  await page.waitForURL(/\/dashboard$/, { timeout: 5 * 60 * 1000 })
  await context.storageState({ path: authFile })
})
