import { test, expect } from '@playwright/test'

test.describe('public routes', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('applicant login page renders correctly', async ({ page }) => {
    await page.goto('/applicant/login')

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Email me a link' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
    await expect(page.getByText('Holmes', { exact: true })).toBeVisible()
  })

  test('recruiter login page renders correctly', async ({ page }) => {
    await page.goto('/recruiter/login')

    await expect(page.getByRole('heading', { name: 'Recruiter sign in' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('applicant session stays on recruiter recovery pages with account guidance', async ({ page }) => {
    const userId = '00000000-0000-4000-8000-000000000001'
    const email = 'applicant@example.com'

    await page.addInitScript(({ userId, email }) => {
      localStorage.setItem('njord-auth-token', JSON.stringify({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: userId, email, role: 'authenticated', aud: 'authenticated' },
      }))
      localStorage.setItem('njord-authz-cache', JSON.stringify({
        userId,
        profile: { id: userId, email, user_type: 'applicant' },
        userType: 'applicant',
        role: null,
        permissions: [],
        cachedAt: Date.now(),
      }))
    }, { userId, email })

    await page.route('**/rest/v1/profiles**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: userId, email, user_type: 'applicant' }),
      })
    })

    await page.goto('/recruiter/login')
    await expect(page.getByRole('heading', { name: 'Recruiter sign in' })).toBeVisible()
    await expect(page.getByText(/This browser is signed in as an applicant/)).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Forgot?' }).click()
    await expect(page.getByText(/This is your applicant account/)).toBeVisible()

    await page.goto('/recruiter/reset-password')
    await expect(page).toHaveURL(/\/recruiter\/reset-password$/)
    await expect(page.getByText('Applicant account detected')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0)
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

    await page.waitForURL('**/applicant/login')
    await expect(page).toHaveURL(/\/applicant\/login$/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })
})
