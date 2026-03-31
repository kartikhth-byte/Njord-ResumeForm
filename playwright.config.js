/* global process */
import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPlaywrightEnv } from './tests/loadPlaywrightEnv.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

loadPlaywrightEnv(__dirname)

const PORT = 3000
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`
const applicantStorageState =
  process.env.PLAYWRIGHT_APPLICANT_STORAGE_STATE || 'playwright/.auth/applicant.json'
const applicantStorageStatePath = path.resolve(__dirname, applicantStorageState)
const hasApplicantStorageState = fs.existsSync(applicantStorageStatePath)

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
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
      name: 'chromium',
      dependencies: hasApplicantStorageState ? ['refresh-applicant'] : [],
      use: {
        ...devices['Desktop Chrome'],
        storageState: hasApplicantStorageState ? applicantStorageStatePath : undefined,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: PORT,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
