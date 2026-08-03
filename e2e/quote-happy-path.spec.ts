import { expect, test } from '@playwright/test'
import { syntheticApplicant } from './support/data'
import {
  assertAuthenticatedCrossOriginRequest,
  assertNoBrowserMock,
  backendOrigin,
  monitorRuntime,
  realQuote,
  waitForApiResponse,
} from './support/quoteFlow'

test('real age-65 create, coverage, review, keyboard focus, submit, and reset', async ({ page }) => {
  const runtimeIssues = monitorRuntime(page)
  const applicant = syntheticApplicant(65, 'HappyPath')
  const quoteRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).origin === backendOrigin && new URL(request.url()).pathname.startsWith('/quotes')) {
      quoteRequests.push(`${request.method()} ${new URL(request.url()).pathname}`)
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible()
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  expect(quoteRequests).toEqual([])
  await assertNoBrowserMock(page)

  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/^Full name/)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/^Email/)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/^Age/)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/^ZIP code/)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel(/^Full name/)).toBeFocused()

  await page.keyboard.type(applicant.name)
  await page.keyboard.press('Tab')
  await page.keyboard.type(applicant.email)
  await page.keyboard.press('Tab')
  await page.keyboard.type(String(applicant.age))
  await page.keyboard.press('Tab')
  await page.keyboard.type(applicant.zipCode)

  const createResponsePromise = waitForApiResponse(page, 'POST', /^\/quotes$/)
  await page.keyboard.press('Enter')
  const createResponse = await createResponsePromise
  expect(createResponse.status()).toBe(201)
  await assertAuthenticatedCrossOriginRequest(createResponse)
  expect(createResponse.request().headers()['content-type']).toContain('application/json')
  expect(createResponse.request().postDataJSON()).toEqual(applicant)
  const draft = await realQuote(createResponse, 'DRAFT')
  expect(draft.coverageType).toBeNull()
  expect(draft.monthlyPremium).toBeNull()
  expect(draft.conditions).toEqual([])
  expect(draft.hasPreexistingConditions).toBeNull()
  expect(createResponse.headers().location).toContain(`/quotes/${draft.id}`)

  const coverageHeading = page.getByRole('heading', { level: 2, name: 'Coverage' })
  await expect(coverageHeading).toBeFocused()
  await expect(page.getByText(/pre-existing conditions/i)).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('radio', { name: 'BASIC' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Back to personal information' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Continue to Review' })).toBeFocused()

  const coverageResponsePromise = waitForApiResponse(
    page,
    'PATCH',
    new RegExp(`^/quotes/${draft.id}/coverage$`),
  )
  await page.keyboard.press('Enter')
  const coverageResponse = await coverageResponsePromise
  await assertAuthenticatedCrossOriginRequest(coverageResponse)
  expect(coverageResponse.request().postDataJSON()).toEqual({ coverageType: 'STANDARD' })
  const covered = await realQuote(coverageResponse, 'DRAFT')
  expect(covered.id).toBe(draft.id)
  expect(covered.coverageType).toBe('STANDARD')
  expect(typeof covered.monthlyPremium).toBe('number')

  const reviewHeading = page.getByRole('heading', { level: 2, name: 'Review and Submit' })
  await expect(reviewHeading).toBeFocused()
  await expect(page.getByText(applicant.name)).toBeVisible()
  await expect(page.getByText(applicant.email)).toBeVisible()
  await expect(page.getByText(applicant.zipCode)).toBeVisible()
  await expect(page.getByText('Standard')).toBeVisible()
  await expect(page.getByText('Draft')).toBeVisible()
  await expect(page.getByText(covered.monthlyPremium?.toFixed(2) ?? '')).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Back to Coverage' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Submit Quote' })).toBeFocused()
  const submitResponsePromise = waitForApiResponse(
    page,
    'POST',
    new RegExp(`^/quotes/${draft.id}/submit$`),
  )
  await page.keyboard.press('Enter')
  let submitResponse = await submitResponsePromise
  await assertAuthenticatedCrossOriginRequest(submitResponse)
  expect(submitResponse.request().postData()).toBeNull()
  expect(submitResponse.request().headers()['content-type']).toBeUndefined()

  if (!submitResponse.ok()) {
    const errorPayload: unknown = await submitResponse.json()
    const errorCode = typeof errorPayload === 'object' && errorPayload !== null && 'code' in errorPayload
      ? errorPayload.code
      : undefined
    expect(['INSURER_SUBMISSION_FAILED', 'INSURER_TIMEOUT']).toContain(errorCode)
    await expect(page.getByRole('alert')).toBeFocused()
    const retryResponsePromise = waitForApiResponse(
      page,
      'POST',
      new RegExp(`^/quotes/${draft.id}/submit$`),
    )
    await page.getByRole('button', { name: 'Retry Submission' }).press('Enter')
    submitResponse = await retryResponsePromise
    await assertAuthenticatedCrossOriginRequest(submitResponse)
    expect(submitResponse.request().postData()).toBeNull()
    expect(submitResponse.request().headers()['content-type']).toBeUndefined()
  }

  const submitted = await realQuote(submitResponse, 'SUBMITTED')
  expect(submitted.id).toBe(draft.id)
  expect(submitted.monthlyPremium).toBe(covered.monthlyPremium)

  const resultHeading = page.getByRole('heading', { level: 2, name: 'Quote submitted' })
  await expect(resultHeading).toBeFocused()
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start New Quote' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry Submission' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Back to Coverage' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit Quote' })).toHaveCount(0)

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Start New Quote' })).toBeFocused()
  const requestCountBeforeReset = quoteRequests.length
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeFocused()
  expect(quoteRequests).toHaveLength(requestCountBeforeReset)
  expect(runtimeIssues).toEqual([])
})
