/* global process */
import fs from 'node:fs'
import path from 'node:path'

export function loadPlaywrightEnv(rootDir = process.cwd(), fileName = '.env.playwright') {
  const envPath = path.join(rootDir, fileName)

  if (!fs.existsSync(envPath)) {
    return
  }

  const raw = fs.readFileSync(envPath, 'utf8')

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
