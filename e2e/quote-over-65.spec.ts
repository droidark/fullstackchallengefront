import { expect, test } from '@playwright/test'
import { syntheticApplicant } from './support/data'
import {
  assertAuthenticatedCrossOriginRequest,
  assertNoBrowserMock,
  fillPersonalForm,
  hasNoHorizontalOverflow,
  monitorRuntime,
  realQuote,
  waitForApiResponse,
} from './support/quoteFlow'

test.use({ viewport: { width: 375, height: 812 } })

test('real age-66 flow sends exact explicit medical answers and reaches Review', async ({ page }) => {
  const runtimeIssues = monitorRuntime(page)
  const applicant = syntheticApplicant(66, 'ConditionalLongEmail')

  await page.goto('/')
  await assertNoBrowserMock(page)
  await fillPersonalForm(page, applicant)
  const createResponsePromise = waitForApiResponse(page, 'POST', /^\/quotes$/)
  await page.getByRole('button', { name: 'Continue' }).click()
  const createResponse = await createResponsePromise
  await assertAuthenticatedCrossOriginRequest(createResponse)
  const draft = await realQuote(createResponse, 'DRAFT')
  expect(draft.age).toBe(66)
  expect(draft.conditions).toEqual([])
  expect(draft.hasPreexistingConditions).toBeNull()

  await expect(page.getByRole('heading', { level: 2, name: 'Coverage' })).toBeFocused()
  const preexisting = page.getByRole('group', { name: 'Do you have pre-existing conditions?' })
  await expect(preexisting).toBeVisible()
  await expect(page.getByRole('group', { name: 'Do you take prescription medication?' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Do you use tobacco?' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Do you need spouse coverage?' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Conditions', exact: true })).toHaveCount(0)

  await page.getByRole('radio', { name: 'PREMIUM' }).press('Space')
  await preexisting.getByRole('radio', { name: 'Yes' }).press('Space')
  const conditions = page.getByRole('group', { name: 'Conditions', exact: true })
  await expect(conditions).toBeVisible()
  await page.getByRole('checkbox', { name: 'Hypertension' }).press('Space')
  await page.getByRole('group', { name: 'Do you take prescription medication?' })
    .getByRole('radio', { name: 'No' }).press('Space')
  await page.getByRole('group', { name: 'Do you use tobacco?' })
    .getByRole('radio', { name: 'No' }).press('Space')
  await page.getByRole('group', { name: 'Do you need spouse coverage?' })
    .getByRole('radio', { name: 'Yes' }).press('Space')

  const expectedCoverage = {
    coverageType: 'PREMIUM',
    hasPreexistingConditions: true,
    conditions: ['HYPERTENSION'],
    takesPrescriptionMedication: false,
    usesTobacco: false,
    needsSpouseCoverage: true,
  }
  const coverageResponsePromise = waitForApiResponse(
    page,
    'PATCH',
    new RegExp(`^/quotes/${draft.id}/coverage$`),
  )
  await page.getByRole('button', { name: 'Continue to Review' }).press('Enter')
  const coverageResponse = await coverageResponsePromise
  await assertAuthenticatedCrossOriginRequest(coverageResponse)
  expect(coverageResponse.request().postDataJSON()).toEqual(expectedCoverage)
  const covered = await realQuote(coverageResponse, 'DRAFT')
  expect(covered.id).toBe(draft.id)
  expect(covered.hasPreexistingConditions).toBe(true)
  expect(covered.conditions).toEqual(['HYPERTENSION'])
  expect(covered.takesPrescriptionMedication).toBe(false)
  expect(covered.usesTobacco).toBe(false)
  expect(covered.needsSpouseCoverage).toBe(true)
  expect(typeof covered.monthlyPremium).toBe('number')

  await expect(page.getByRole('heading', { level: 2, name: 'Review and Submit' })).toBeFocused()
  await expect(page.getByText(applicant.email)).toBeVisible()
  await expect(page.getByText('Hypertension')).toBeVisible()
  await expect(page.getByText(covered.monthlyPremium?.toFixed(2) ?? '')).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Supplemental Answers' })).toBeVisible()
  expect(await hasNoHorizontalOverflow(page)).toBe(true)

  const backBox = await page.getByRole('button', { name: 'Back to Coverage' }).boundingBox()
  const submitBox = await page.getByRole('button', { name: 'Submit Quote' }).boundingBox()
  expect(backBox).not.toBeNull()
  expect(submitBox).not.toBeNull()
  if (backBox !== null && submitBox !== null) expect(submitBox.y).toBeGreaterThan(backBox.y)
  expect(runtimeIssues).toEqual([])
})
