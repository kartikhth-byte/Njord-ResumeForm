/* global process */
import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlaywrightEnv } from './tests/loadPlaywrightEnv.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const viteBin = path.resolve(__dirname, 'node_modules', '.bin', 'vite')

loadPlaywrightEnv(__dirname)

const PORT = 3000
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`
const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const applicantStorageStatePath = path.resolve(__dirname, applicantStorageState)
const hasApplicantStorageState = fs.existsSync(applicantStorageStatePath)
const shouldRefreshApplicantState =
  process.env.PLAYWRIGHT_REFRESH_APPLICANT === '1' && hasApplicantStorageState
const connectOptions = process.env.PLAYWRIGHT_WS_ENDPOINT
  ? { wsEndpoint: process.env.PLAYWRIGHT_WS_ENDPOINT }
  : undefined

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    chromiumSandbox: true,
    connectOptions,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'setup-applicant',
      testMatch: /.*applicant-auth\.setup\.js/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'refresh-applicant',
      testMatch: /.*applicant-refresh\.setup\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: hasApplicantStorageState ? applicantStorageStatePath : undefined,
      },
    },
    {
      name: 'setup-draft-applicant',
      testMatch: /.*applicant-draft\.setup\.js/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'chromium',
      dependencies: [
        ...(shouldRefreshApplicantState ? ['refresh-applicant'] : []),
        'setup-draft-applicant',
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: hasApplicantStorageState ? applicantStorageStatePath : undefined,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: viteBin,
        port: PORT,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
