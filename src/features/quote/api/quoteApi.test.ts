import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../../shared/test/server'
import { draftQuote } from '../../../shared/test/fixtures'
import { testApiBaseUrl, testApiKey } from '../../../shared/test/handlers'
import type { NormalizedApiError } from '../models/apiError'
import type { CreateQuoteRequest, UpdateCoverageRequest } from '../models/quote'
import { createQuoteApi } from './quoteApi'

const api = createQuoteApi({ apiBaseUrl: testApiBaseUrl, apiKey: testApiKey })

const createRequest: CreateQuoteRequest = {
  name: 'Frontend Test',
  email: 'frontend.test@example.invalid',
  age: 65,
  zipCode: '10001',
}

describe('quoteApi', () => {
  it('parses the observed bare quote collection', async () => {
    await expect(api.getQuotes()).resolves.toEqual([draftQuote])
  })

  it('creates a quote with exact JSON and required headers', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, async ({ request }) => {
      expect(request.headers.get('X-API-Key')).toBe(testApiKey)
      expect(request.headers.get('Accept')).toBe('application/json')
      expect(request.headers.get('Content-Type')).toContain('application/json')
      expect(await request.json()).toEqual(createRequest)
      return HttpResponse.json(draftQuote, { status: 201 })
    }))

    await expect(api.createQuote(createRequest)).resolves.toEqual(draftQuote)
  })

  it('updates coverage with the exact request body', async () => {
    const coverageRequest: UpdateCoverageRequest = { coverageType: 'STANDARD' }
    server.use(http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, async ({ request }) => {
      expect(await request.json()).toEqual(coverageRequest)
      return HttpResponse.json({ ...draftQuote, coverageType: 'STANDARD', monthlyPremium: 100 })
    }))

    const quote = await api.updateCoverage(draftQuote.id, coverageRequest)
    expect(quote.monthlyPremium).toBe(100)
  })

  it('submits with no body and no content-type header', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, async ({ request }) => {
      expect(request.headers.get('Content-Type')).toBeNull()
      expect(await request.text()).toBe('')
      return HttpResponse.json({
        ...draftQuote,
        coverageType: 'STANDARD',
        monthlyPremium: 100,
        status: 'SUBMITTED',
      })
    }))

    await expect(api.submitQuote(draftQuote.id)).resolves.toMatchObject({ status: 'SUBMITTED' })
  })

  it('safely encodes a quote ID in the path', async () => {
    const unsafeId = 'quote/with spaces?and=query'
    let observedPath = ''
    server.use(http.get(`${testApiBaseUrl}/quotes/*`, ({ request }) => {
      observedPath = new URL(request.url).pathname
      return HttpResponse.json(draftQuote)
    }))

    await api.getQuote(unsafeId)
    expect(observedPath).toBe(`/quotes/${encodeURIComponent(unsafeId)}`)
  })

  it('normalizes backend errors and preserves valid field errors', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json({
      timestamp: '2026-08-02T12:00:00Z',
      status: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      path: '/quotes',
      fieldErrors: [{ field: 'email', message: 'must be a well-formed email address' }],
    }, { status: 400 })))

    await expect(api.createQuote(createRequest)).rejects.toMatchObject({
      kind: 'backend',
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fieldErrors: [{ field: 'email', message: 'must be a well-formed email address' }],
    })
  })

  it('uses a safe error for a non-JSON backend response', async () => {
    server.use(http.get(`${testApiBaseUrl}/quotes`, () => new HttpResponse('<html>failure</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    })))

    await expect(api.getQuotes()).rejects.toMatchObject({
      kind: 'backend',
      status: 502,
      message: 'The server could not complete the request.',
      fieldErrors: [],
    })
  })

  it('normalizes a network failure', async () => {
    server.use(http.get(`${testApiBaseUrl}/quotes`, () => HttpResponse.error()))
    await expect(api.getQuotes()).rejects.toMatchObject({ kind: 'network' })
  })

  it('normalizes an aborted request', async () => {
    server.use(http.get(`${testApiBaseUrl}/quotes`, async () => {
      await delay('infinite')
      return HttpResponse.json([])
    }))
    const controller = new AbortController()
    const result = api.getQuotes(controller.signal)
    controller.abort()
    await expect(result).rejects.toMatchObject({ kind: 'aborted' })
  })

  it('rejects malformed successful JSON', async () => {
    server.use(http.get(`${testApiBaseUrl}/quotes`, () => HttpResponse.json({ quotes: [] })))
    await expect(api.getQuotes()).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('never includes the API key in a thrown error message', async () => {
    server.use(http.get(`${testApiBaseUrl}/quotes`, () => HttpResponse.error()))
    let caught: unknown
    try {
      await api.getQuotes()
    } catch (error: unknown) {
      caught = error
    }
    const normalized = caught as NormalizedApiError
    expect(normalized.message).not.toContain(testApiKey)
  })
})
