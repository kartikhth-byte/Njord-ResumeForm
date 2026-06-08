/* global process */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadPlaywrightEnv } from './loadPlaywrightEnv.js'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function getBaseOrigin() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
  return new URL(baseUrl).origin
}

function getOriginEntry(storageState) {
  return storageState.origins?.[0] || null
}

function getLocalStorageEntry(storageState, key) {
  const originEntry = getOriginEntry(storageState)
  return originEntry?.localStorage?.find((entry) => entry.name === key) || null
}

async function writeApplicantStateFromProfile({ authPath, storageState, session, profile, origin }) {
  storageState.origins = [
    {
      origin,
      localStorage: [
        {
          name: 'njord-auth-token',
          value: JSON.stringify(session),
        },
        {
          name: 'njord-authz-cache',
          value: JSON.stringify({
            userId: profile.id,
            profile,
            userType: 'applicant',
            role: null,
            permissions: [],
            cachedAt: Date.now(),
          }),
        },
      ],
    },
  ]
  writeJson(authPath, storageState)
}

async function refreshApplicantStorageState(rootDir) {
  const authFile = process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
  const authPath = path.resolve(rootDir, authFile)
  const currentOrigin = getBaseOrigin()

  if (!fs.existsSync(authPath)) {
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return
  }

  const storageState = readJson(authPath)
  const originEntry = getOriginEntry(storageState)
  const tokenEntry = getLocalStorageEntry(storageState, 'njord-auth-token')

  if (!tokenEntry) {
    return
  }

  const currentSession = JSON.parse(tokenEntry.value)
  const now = Math.floor(Date.now() / 1000)
  const isFresh = currentSession.expires_at && currentSession.expires_at > now + 60
  const hasAuthzCache = Boolean(getLocalStorageEntry(storageState, 'njord-authz-cache'))

  if (isFresh && hasAuthzCache && originEntry?.origin === currentOrigin) {
    return
  }

  const userId = currentSession.user?.id || null
  const email = currentSession.user?.email || null

  try {
    if (currentSession.refresh_token) {
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: currentSession.refresh_token,
        }),
      })

      if (response.ok) {
        const refreshedSession = await response.json()
        const profileResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${refreshedSession.access_token}`,
          },
        })

        if (!profileResponse.ok) {
          return
        }

        const refreshedUser = await profileResponse.json()
        const profile = {
          id: refreshedUser.id,
          full_name: refreshedUser.user_metadata?.full_name || refreshedUser.user_metadata?.name || refreshedUser.email?.split('@')[0] || 'Applicant',
          email: refreshedUser.email || email,
          user_type: 'applicant',
        }

        await writeApplicantStateFromProfile({
          authPath,
          storageState,
          session: refreshedSession,
          profile,
          origin: currentOrigin,
        })
        return
      }
    }

    if (!serviceRoleKey || !userId || !email) {
      return
    }

    const password = process.env.PLAYWRIGHT_APPLICANT_PASSWORD || 'Playwright-Applicant-Fallback-123456!'
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    })

    if (updateError) {
      return
    }

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData?.session) {
      return
    }

    const { data: profileData, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, user_type')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profileData) {
      return
    }

    await writeApplicantStateFromProfile({
      authPath,
      storageState,
      session: signInData.session,
      profile: profileData,
      origin: currentOrigin,
    })
  } catch (error) {
    console.warn('Skipping applicant storage refresh because Supabase is unreachable:', error?.message || error)
  }
}

export default async function globalSetup() {
  const rootDir = process.cwd()
  loadPlaywrightEnv(rootDir)
  loadPlaywrightEnv(rootDir, '.env.local')
  loadPlaywrightEnv(rootDir, '.env')
  await refreshApplicantStorageState(rootDir)
}
