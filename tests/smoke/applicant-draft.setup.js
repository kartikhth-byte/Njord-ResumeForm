import { test } from '@playwright/test'
import { prepareDraftApplicantState } from '../helpers/draftApplicantState.js'

test.setTimeout(120_000)

test('prepare draft applicant storage state', async () => {
  const result = await prepareDraftApplicantState()

  test.skip(
    !result.prepared,
    `Draft applicant storage state was not prepared: ${result.reason}`,
  )
})
