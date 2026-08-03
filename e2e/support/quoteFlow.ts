import { expect, type Page, type Response } from '@playwright/test'
import type { SyntheticApplicant } from './data'
import { parseQuoteResponse, type QuoteResponse, type QuoteStatus } from '../../src/features/quote/models/quote'

export const frontendOrigin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
export const backendOrigin = 'http://localhost:8080'

const quoteFields = [
  'id',
  'name',
  'email',
  'age',
  'zipCode',
  'coverageType',
  'hasPreexistingConditions',
  'conditions',
  'takesPrescriptionMedication',
  'usesTobacco',
  'needsSpouseCoverage',
  'monthlyPremium',
  'status',
  'createdAt',
  'modifiedAt',
] as const

export function monitorRuntime(page: Page): string[] {
  const issues: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console error: ${message.text()}`)
  })
  page.on('pageerror', (error) => { issues.push(`page error: ${error.message}`) })
  page.on('requestfailed', (request) => {
    if (['document', 'script', 'stylesheet', 'fetch', 'xhr'].includes(request.resourceType())) {
      issues.push(`request failed: ${request.method()} ${request.url()}`)
    }
  })
  return issues
}

export async function assertNoBrowserMock(page: Page): Promise<void> {
  const registrations = await page.evaluate(async () => (
    'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
  ))
  expect(registrations).toBe(0)
  expect(page.context().serviceWorkers()).toHaveLength(0)
}

export function waitForApiResponse(page: Page, method: string, path: RegExp): Promise<Response> {
  return page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(response.url())
    return request.method() === method && url.origin === backendOrigin && path.test(url.pathname)
  })
}

export async function assertAuthenticatedCrossOriginRequest(response: Response): Promise<void> {
  const request = response.request()
  const headers = await request.allHeaders()
  expect(new URL(request.url()).origin).toBe(backendOrigin)
  expect(headers.origin).toBe(frontendOrigin)
  expect(Boolean(headers['x-api-key'])).toBe(true)
}

export async function realQuote(response: Response, expectedStatus: QuoteStatus): Promise<QuoteResponse> {
  expect(response.ok()).toBe(true)
  const payload: unknown = await response.json()
  const quote = parseQuoteResponse(payload)
  expect(quote, 'The real response must satisfy the production QuoteResponse parser.').not.toBeNull()
  if (quote === null) throw new Error('The real quote response did not match QuoteResponse.')
  expect(Object.keys(payload as Record<string, unknown>)).toEqual(expect.arrayContaining([...quoteFields]))
  expect(quote.status).toBe(expectedStatus)
  expect(Number.isNaN(Date.parse(quote.createdAt))).toBe(false)
  expect(Number.isNaN(Date.parse(quote.modifiedAt))).toBe(false)
  return quote
}

export async function fillPersonalForm(page: Page, applicant: SyntheticApplicant): Promise<void> {
  await page.getByLabel(/^Full name/).fill(applicant.name)
  await page.getByLabel(/^Email/).fill(applicant.email)
  await page.getByLabel(/^Age/).fill(String(applicant.age))
  await page.getByLabel(/^ZIP code/).fill(applicant.zipCode)
}

export async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))
}
