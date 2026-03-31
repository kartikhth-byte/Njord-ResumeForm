import { test, expect } from '@playwright/test'

test.describe('public routes', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('applicant login page renders correctly', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Applicant login' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await expect(page.getByText('Njordships Careers')).toBeVisible()
  })

  test('recruiter login page renders correctly', async ({ page }) => {
    await page.goto('/recruiter/login')

    await expect(page.getByRole('heading', { name: 'Recruiter sign in' })).toBeVisible()
    await expect(page.getByPlaceholder('recruiter@njordships.com')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('privacy policy page renders legal content', async ({ page }) => {
    await page.goto('/privacy-policy')

    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Information We Collect' })).toBeVisible()
  })

  test('terms page renders legal content', async ({ page }) => {
    await page.goto('/terms-conditions')

    await expect(page.getByRole('heading', { name: 'Terms and Conditions' })).toBeVisible()
    await expect(page.getByText('Acceptance of Terms')).toBeVisible()
  })

  test('auth callback without session returns to applicant login', async ({ page }) => {
    await page.goto('/auth/callback')

    await page.waitForURL('**/login')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Applicant login' })).toBeVisible()
  })
})
