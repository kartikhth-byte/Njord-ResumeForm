import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('submitted application route rejects missing secure access token', async ({ page }) => {
  const publicToken = 'b4638c73-3adc-469e-9dd5-29b4bc5fe518'

  await page.goto(`/application/view/${publicToken}`)
  await expect(page.getByText('This application link is missing secure access credentials')).toBeVisible()
})
