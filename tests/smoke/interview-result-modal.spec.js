import { test, expect } from '@playwright/test'

test('interview outcomes stay interactive and backdrop still dismisses', async ({ page }) => {
  await page.goto('/tests/fixtures/interview-result-modal.html')

  const modal = page.getByRole('heading', { name: 'Update interview result' })
  await expect(modal).toBeVisible()

  await page.getByRole('radio', { name: 'Passed' }).check()
  await expect(page.getByRole('radio', { name: 'Passed' })).toBeChecked()
  await expect(modal).toBeVisible()

  await page.getByRole('radio', { name: /Failed/ }).check()
  await expect(page.getByRole('radio', { name: /Failed/ })).toBeChecked()
  await expect(modal).toBeVisible()

  await page.locator('.recruiter-modal-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(page.getByTestId('modal-state')).toHaveText('closed')
})

test('passed interview saves a rating and requests the candidate email', async ({ page }) => {
  const requests = []
  await page.route(/\/(?:rest\/v1|functions\/v1)\//, async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH' && request.url().includes('/rest/v1/applications')) {
      requests.push({ kind: 'status', body: request.postDataJSON() })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"id":"synthetic-modal-test"}' })
    } else if (request.method() === 'POST' && request.url().includes('/functions/v1/send-interview-passed')) {
      requests.push({ kind: 'email', body: request.postDataJSON() })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":true}' })
    } else {
      await route.abort()
    }
  })

  await page.goto('/tests/fixtures/interview-result-modal.html')
  await page.getByRole('radio', { name: 'Passed' }).check()
  await expect(page.getByRole('button', { name: 'Update Result & Notify' })).toBeDisabled()
  await page.getByRole('button', { name: 'Rate 4 out of 5' }).click()
  await page.getByRole('button', { name: 'Update Result & Notify' }).click()
  await expect(page.getByTestId('result-status')).toHaveText('interview_passed')
  expect(requests).toEqual([
    expect.objectContaining({ kind: 'status', body: expect.objectContaining({ status: 'interview_passed' }) }),
    expect.objectContaining({ kind: 'email', body: expect.objectContaining({ applicantEmail: 'synthetic@example.invalid' }) }),
  ])
  expect(requests[1].body.recommendation).toBeUndefined()
})

test('failed interview saves rejection before requesting an email', async ({ page }) => {
  const requests = []
  await page.route(/\/(?:rest\/v1|functions\/v1)\//, async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH' && request.url().includes('/rest/v1/applications')) {
      requests.push({ kind: 'status', body: request.postDataJSON() })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"id":"synthetic-modal-test"}' })
    } else if (request.method() === 'POST' && request.url().includes('/functions/v1/send-rejection-email')) {
      requests.push({ kind: 'email', body: request.postDataJSON() })
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":true}' })
    } else {
      await route.abort()
    }
  })

  await page.goto('/tests/fixtures/interview-result-modal.html')
  await page.getByRole('radio', { name: /Failed/ }).check()
  await page.getByRole('button', { name: 'Update Result & Notify' }).click()
  await expect(page.getByTestId('result-status')).toHaveText('rejected')
  expect(requests[0]).toEqual(expect.objectContaining({ kind: 'status', body: expect.objectContaining({ status: 'rejected', rejection_category: 'failed_interview' }) }))
  expect(requests[1]).toEqual(expect.objectContaining({ kind: 'email', body: expect.objectContaining({ applicantEmail: 'synthetic@example.invalid' }) }))
})

test('a rejected zero-row status update never sends an email', async ({ page }) => {
  const requests = []
  const dialogs = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  await page.route(/\/(?:rest\/v1|functions\/v1)\//, async (route) => {
    const request = route.request()
    requests.push(request.url())
    if (request.method() === 'PATCH' && request.url().includes('/rest/v1/applications')) {
      await route.fulfill({ status: 406, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"code":"PGRST116","message":"The result contains 0 rows"}' })
    } else {
      await route.abort()
    }
  })

  await page.goto('/tests/fixtures/interview-result-modal.html')
  await page.getByRole('radio', { name: /Failed/ }).check()
  await page.getByRole('button', { name: 'Update Result & Notify' }).click()
  await expect(page.getByRole('heading', { name: 'Update interview result' })).toBeVisible()
  await expect.poll(() => dialogs.some((message) => message.includes('Failed to update interview result'))).toBe(true)
  expect(requests.some((url) => url.includes('/functions/v1/send-rejection-email'))).toBe(false)
})
