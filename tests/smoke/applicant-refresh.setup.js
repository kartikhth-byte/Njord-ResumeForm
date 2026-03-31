/* global process */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'

loadPlaywrightEnv()
loadPlaywrightEnv(process.cwd(), '.env.local')
loadPlaywrightEnv(process.cwd(), '.env')

const authFile = process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const hasApplicantStorageState = fs.existsSync(authFile)
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

test.setTimeout(2 * 60 * 1000)

async function fallbackApplicantReauth(page, context, baseURL, authFile) {
  const cachedEmail = await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('njord-authz-cache')
      return raw ? JSON.parse(raw)?.profile?.email || null : null
    } catch {
      return null
    }
  })

  await page.getByRole('button', { name: 'Continue with Google' }).click()

  await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 })

  const storedAccountOption = cachedEmail
    ? page.locator('div[role="link"]').filter({ hasText: cachedEmail }).first()
    : page.locator('div[role="link"]').filter({ hasNotText: 'Use another account' }).first()

  if (await storedAccountOption.isVisible().catch(() => false)) {
    await storedAccountOption.click()
  } else if (cachedEmail) {
    const emailTextOption = page.getByText(cachedEmail, { exact: true })
    await emailTextOption.waitFor({ state: 'visible', timeout: 15_000 })
    await emailTextOption.click()
  }

  await page.waitForURL(/\/dashboard$/, { timeout: 90_000 })

  const authPath = path.resolve(process.cwd(), authFile)
  await context.storageState({ path: authPath })
}

test('refresh applicant stored session if expired', async ({ page, context, baseURL }) => {
  test.skip(!hasApplicantStorageState, 'Applicant storage state not captured yet.')
  test.skip(!supabaseUrl || !supabaseAnonKey, 'Supabase env not configured for applicant session refresh.')

  await page.goto(`${baseURL}/login`)

  const refreshResult = await page.evaluate(async ({ url, anonKey }) => {
    const raw = window.localStorage.getItem('njord-auth-token')
    if (!raw) {
      return { refreshed: false, reason: 'missing-token' }
    }

    const currentSession = JSON.parse(raw)
    const now = Math.floor(Date.now() / 1000)
    const { supabase } = await import('/src/lib/supabase.js')

    if (currentSession.expires_at && currentSession.expires_at > now + 60) {
      const { data, error } = await supabase.auth.getSession()
      return {
        refreshed: false,
        reason: 'already-fresh',
        sessionUserId: data?.session?.user?.id || null,
        sessionError: error?.message || null,
      }
    }

    if (!currentSession.refresh_token) {
      return { refreshed: false, reason: 'missing-refresh-token' }
    }

    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: currentSession.refresh_token,
      }),
    })

    if (!response.ok) {
      return { refreshed: false, reason: `refresh-failed-${response.status}` }
    }

    const refreshedSession = await response.json()
    const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
      access_token: refreshedSession.access_token,
      refresh_token: refreshedSession.refresh_token,
    })

    if (setSessionError) {
      window.localStorage.setItem('njord-auth-token', JSON.stringify(refreshedSession))
      return {
        refreshed: false,
        reason: 'set-session-failed',
        setSessionError: setSessionError.message,
      }
    }

    const persistedRaw = window.localStorage.getItem('njord-auth-token')
    const persistedSession = persistedRaw ? JSON.parse(persistedRaw) : null

    return {
      refreshed: true,
      reason: 'refreshed',
      sessionUserId: setSessionData?.session?.user?.id || null,
      persistedExpiresAt: persistedSession?.expires_at || null,
    }
  }, { url: supabaseUrl, anonKey: supabaseAnonKey })

  if (refreshResult.reason === 'missing-token' || refreshResult.reason === 'missing-refresh-token') {
    throw new Error(`Applicant storage refresh cannot proceed: ${refreshResult.reason}`)
  }

  if (refreshResult.reason.startsWith('refresh-failed')) {
    await fallbackApplicantReauth(page, context, baseURL, authFile)
    return
  }

  if (refreshResult.reason === 'set-session-failed') {
    throw new Error(`Applicant storage refresh failed: ${JSON.stringify(refreshResult)}`)
  }

  await page.reload()
  await expect.poll(async () => {
    const state = await page.evaluate(async () => {
      const { supabase } = await import('/src/lib/supabase.js')
      const { data, error } = await supabase.auth.getSession()
      return {
        userId: data?.session?.user?.id || null,
        error: error?.message || null,
        hasLoginButton: !!document.querySelector('button'),
      }
    })
    return state.userId
  }, {
    timeout: 15000,
    message: `Expected applicant session after refresh. Refresh result: ${JSON.stringify(refreshResult)}`,
  }).not.toBeNull()

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0, { timeout: 15000 })

  const authPath = path.resolve(process.cwd(), authFile)
  await context.storageState({ path: authPath })
})
