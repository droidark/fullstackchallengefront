import { http, HttpResponse } from 'msw'
import { coveredQuote, draftQuote, submittedQuote } from './fixtures'

export const testApiBaseUrl = 'http://api.test'
export const testApiKey = 'test-only-api-key'

export const handlers = [
  http.get(`${testApiBaseUrl}/quotes`, () => HttpResponse.json([draftQuote])),
  http.get(`${testApiBaseUrl}/quotes/:id`, ({ params }) => HttpResponse.json({ ...draftQuote, id: params.id })),
  http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
  http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json(coveredQuote)),
  http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(submittedQuote)),
]
