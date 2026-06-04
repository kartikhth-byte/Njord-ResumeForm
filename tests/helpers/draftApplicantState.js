/* global process */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadPlaywrightEnv } from '../loadPlaywrightEnv.js'

const DEFAULT_DRAFT_EMAIL = 'playwright-draft-applicant@example.invalid'
const DEFAULT_DRAFT_PASSWORD = 'Playwright-Draft-Applicant-123456!'
const DEFAULT_DRAFT_STATE = 'playwright/.auth/applicant-draft.json'

function loadEnv() {
  loadPlaywrightEnv()
  loadPlaywrightEnv(process.cwd(), '.env.local')
  loadPlaywrightEnv(process.cwd(), '.env')
}

function getBaseOrigin() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
  return new URL(baseUrl).origin
}

function isRetryableAuthError(error) {
  const message = `${error?.name || ''} ${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('connecttimeout') ||
    message.includes('und_err_connect_timeout') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  )
}

async function withRetry(operation, attempts = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isRetryableAuthError(error)) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    }
  }

  throw lastError
}

async function findAuthUserByEmail(adminClient, email) {
  const perPage = 100

  return withRetry(async () => {
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (error) throw error

      const user = data?.users?.find((candidate) => candidate.email === email)
      if (user) return user

      if (!data?.users || data.users.length < perPage) {
        return null
      }
    }

    return null
  })
}

async function upsertDraftAuthUser(adminClient, email, password) {
  const existingUser = await findAuthUserByEmail(adminClient, email)

  if (existingUser) {
    const { data, error } = await withRetry(() => adminClient.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password,
      user_metadata: {
        full_name: 'Playwright Draft Applicant',
        name: 'Playwright Draft Applicant',
      },
    }))

    if (error) throw error
    return data.user
  }

  const { data, error } = await withRetry(() => adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Playwright Draft Applicant',
      name: 'Playwright Draft Applicant',
    },
  }))

  if (error) throw error
  return data.user
}

export function getDraftApplicantStorageStatePath() {
  return process.env.PLAYWRIGHT_DRAFT_APPLICANT_STORAGE_STATE || DEFAULT_DRAFT_STATE
}

export async function prepareDraftApplicantState() {
  loadEnv()

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return {
      prepared: false,
      reason: 'missing-supabase-env',
      statePath: getDraftApplicantStorageStatePath(),
    }
  }

  const email = process.env.PLAYWRIGHT_DRAFT_APPLICANT_EMAIL || DEFAULT_DRAFT_EMAIL
  const password = process.env.PLAYWRIGHT_DRAFT_APPLICANT_PASSWORD || DEFAULT_DRAFT_PASSWORD
  const statePath = getDraftApplicantStorageStatePath()
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

  const user = await upsertDraftAuthUser(adminClient, email, password)
  const profile = {
    id: user.id,
    full_name: 'Playwright Draft Applicant',
    email,
    user_type: 'applicant',
  }

  const { error: profileError } = await withRetry(() => adminClient
    .from('profiles')
    .upsert(profile, { onConflict: 'id' }))

  if (profileError) throw profileError

  const { error: deleteError } = await withRetry(() => adminClient
    .from('applications')
    .delete()
    .eq('user_id', user.id))

  if (deleteError) throw deleteError

  const { data: application, error: applicationError } = await withRetry(() => adminClient
    .from('applications')
    .insert({
      user_id: user.id,
      status: 'new',
      applicant_name: profile.full_name,
      applicant_email: email,
    })
    .select('id')
    .single())

  if (applicationError) throw applicationError

  const { error: dataError } = await withRetry(() => adminClient
    .from('application_data')
    .insert({
      application_id: application.id,
      data: {},
    }))

  if (dataError) throw dataError

  const { data: sessionData, error: sessionError } = await authClient.auth.signInWithPassword({
    email,
    password,
  })

  if (sessionError) throw sessionError

  const absoluteStatePath = path.resolve(process.cwd(), statePath)
  fs.mkdirSync(path.dirname(absoluteStatePath), { recursive: true })
  fs.writeFileSync(absoluteStatePath, JSON.stringify({
    cookies: [],
    origins: [
      {
        origin: getBaseOrigin(),
        localStorage: [
          {
            name: 'njord-auth-token',
            value: JSON.stringify(sessionData.session),
          },
          {
            name: 'njord-authz-cache',
            value: JSON.stringify({
              userId: user.id,
              profile,
              userType: 'applicant',
              role: null,
              permissions: [],
              cachedAt: Date.now(),
            }),
          },
        ],
      },
    ],
  }, null, 2))

  return {
    prepared: true,
    userId: user.id,
    email,
    applicationId: application.id,
    statePath,
  }
}
