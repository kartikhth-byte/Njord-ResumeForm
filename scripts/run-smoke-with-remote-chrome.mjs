import path from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PLAYWRIGHT_BIN = path.resolve(process.cwd(), 'node_modules', '.bin', 'playwright')

async function main() {
  const playwrightArgs = process.argv.slice(2)
  const existingWsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT

  let wsEndpoint = existingWsEndpoint
  let browserServer = null

  if (!wsEndpoint) {
    browserServer = await chromium.launchServer({
      headless: true,
    })
    wsEndpoint = browserServer.wsEndpoint()
  }

  const child = spawn(PLAYWRIGHT_BIN, ['test', '--project=chromium', ...playwrightArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_WS_ENDPOINT: wsEndpoint,
    },
  })

  const cleanup = () => {
    if (browserServer) {
      try {
        browserServer.close()
      } catch {
        // Best effort cleanup only.
      }
    }
  }

  process.on('SIGINT', () => {
    cleanup()
    child.kill('SIGINT')
  })

  process.on('SIGTERM', () => {
    cleanup()
    child.kill('SIGTERM')
  })

  child.on('close', (code, signal) => {
    cleanup()
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exitCode = code ?? 1
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
