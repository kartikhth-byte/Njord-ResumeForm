/* global process */
import fs from 'node:fs'
import path from 'node:path'
import { loadPlaywrightEnv } from './loadPlaywrightEnv.js'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function getApplicantTokenEntry(storageState) {
  const localhostOrigin = storageState.origins?.find((origin) => origin.origin === 'http://localhost:3000')
  return localhostOrigin?.localStorage?.find((entry) => entry.name === 'njord-auth-token') || null
}

async function refreshApplicantStorageState(rootDir) {
  const authFile = process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
  const authPath = path.resolve(rootDir, authFile)

  if (!fs.existsSync(authPath)) {
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return
  }

  const storageState = readJson(authPath)
  const tokenEntry = getApplicantTokenEntry(storageState)

  if (!tokenEntry) {
    return
  }

  const currentSession = JSON.parse(tokenEntry.value)
  const now = Math.floor(Date.now() / 1000)

  if (currentSession.expires_at && currentSession.expires_at > now + 60) {
    return
  }

  if (!currentSession.refresh_token) {
    return
  }

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

  if (!response.ok) {
    return
  }

  const refreshedSession = await response.json()
  tokenEntry.value = JSON.stringify(refreshedSession)
  writeJson(authPath, storageState)
}

export default async function globalSetup() {
  const rootDir = process.cwd()
  loadPlaywrightEnv(rootDir)
  loadPlaywrightEnv(rootDir, '.env.local')
  loadPlaywrightEnv(rootDir, '.env')
  await refreshApplicantStorageState(rootDir)
}
