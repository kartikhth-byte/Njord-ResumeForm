import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareDraftApplicantState } from './draftApplicantState.js'

test('draft setup refuses production even when its ref is explicitly allowed', async () => {
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousRef = process.env.PLAYWRIGHT_DRAFT_TEST_PROJECT_REF

  try {
    process.env.VITE_SUPABASE_URL = 'https://btbqdviuqcpauojmorvx.supabase.co'
    process.env.PLAYWRIGHT_DRAFT_TEST_PROJECT_REF = 'btbqdviuqcpauojmorvx'

    for (const resetApplication of [false, true]) {
      const result = await prepareDraftApplicantState({ resetApplication })
      assert.equal(result.prepared, false)
      assert.match(result.reason, /non-production/)
    }
  } finally {
    if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = previousUrl
    if (previousRef === undefined) delete process.env.PLAYWRIGHT_DRAFT_TEST_PROJECT_REF
    else process.env.PLAYWRIGHT_DRAFT_TEST_PROJECT_REF = previousRef
  }
})
