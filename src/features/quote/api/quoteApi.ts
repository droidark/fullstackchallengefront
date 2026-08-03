import type { AppConfig } from '../../../config/env'
import { getAppConfig } from '../../../config/env'
import {
  normalizeBackendError,
  normalizeFetchError,
  toThrowable,
} from '../../../shared/errors/normalizeApiError'
import type { NormalizedApiError } from '../models/apiError'
import type { CreateQuoteRequest, QuoteResponse, UpdateCoverageRequest } from '../models/quote'
import { parseQuoteCollection, parseQuoteResponse } from '../models/quote'

export type QuoteApi = Readonly<{
  createQuote(request: CreateQuoteRequest, signal?: AbortSignal): Promise<QuoteResponse>
  getQuote(id: string, signal?: AbortSignal): Promise<QuoteResponse>
  getQuotes(signal?: AbortSignal): Promise<QuoteResponse[]>
  updateCoverage(id: string, request: UpdateCoverageRequest, signal?: AbortSignal): Promise<QuoteResponse>
  submitQuote(id: string, signal?: AbortSignal): Promise<QuoteResponse>
}>

type RequestOptions = Readonly<{
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  signal?: AbortSignal
  collection?: boolean
}>

function invalidResponse(): NormalizedApiError {
  return { kind: 'invalid-response', message: 'The quote service returned an unexpected response.' }
}

export function createQuoteApi(config: AppConfig, fetchImplementation?: typeof fetch): QuoteApi {
  async function request(path: string, options: RequestOptions = {}): Promise<QuoteResponse | QuoteResponse[]> {
    const headers = new Headers({ Accept: 'application/json', 'X-API-Key': config.apiKey })
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    }

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      init.body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await (fetchImplementation ?? fetch)(`${config.apiBaseUrl}${path}`, init)
    } catch (error: unknown) {
      throw toThrowable(normalizeFetchError(error))
    }

    let payload: unknown
    try {
      payload = await response.json() as unknown
    } catch {
      if (!response.ok) throw toThrowable(normalizeBackendError(response.status, null))
      throw toThrowable(invalidResponse())
    }

    if (!response.ok) throw toThrowable(normalizeBackendError(response.status, payload))

    const parsed = options.collection ? parseQuoteCollection(payload) : parseQuoteResponse(payload)
    if (parsed === null) throw toThrowable(invalidResponse())
    return parsed
  }

  return {
    async createQuote(createRequest, signal) {
      return await request('/quotes', {
        method: 'POST',
        body: createRequest,
        ...(signal === undefined ? {} : { signal }),
      }) as QuoteResponse
    },
    async getQuote(id, signal) {
      return await request(
        `/quotes/${encodeURIComponent(id)}`,
        signal === undefined ? {} : { signal },
      ) as QuoteResponse
    },
    async getQuotes(signal) {
      return await request('/quotes', {
        collection: true,
        ...(signal === undefined ? {} : { signal }),
      }) as QuoteResponse[]
    },
    async updateCoverage(id, coverageRequest, signal) {
      return await request(`/quotes/${encodeURIComponent(id)}/coverage`, {
        method: 'PATCH',
        body: coverageRequest,
        ...(signal === undefined ? {} : { signal }),
      }) as QuoteResponse
    },
    async submitQuote(id, signal) {
      return await request(`/quotes/${encodeURIComponent(id)}/submit`, {
        method: 'POST',
        ...(signal === undefined ? {} : { signal }),
      }) as QuoteResponse
    },
  }
}

export function getQuoteApi(): QuoteApi {
  return createQuoteApi(getAppConfig())
}
