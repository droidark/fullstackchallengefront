import type { ApiFieldError, NormalizedApiError } from '../../features/quote/models/apiError'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 500 ? trimmed : fallback
}

function parseFieldErrors(value: unknown): ApiFieldError[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const field = safeText(item.field, '')
    const message = safeText(item.message, '')
    return field.length > 0 && message.length > 0 ? [{ field, message }] : []
  })
}

export function normalizeBackendError(status: number, value: unknown): NormalizedApiError {
  if (!isRecord(value)) {
    return {
      kind: 'backend',
      status,
      message: 'The server could not complete the request.',
      fieldErrors: [],
    }
  }

  const code = safeText(value.code, '')
  return {
    kind: 'backend',
    status,
    ...(code.length > 0 ? { code } : {}),
    message: safeText(value.message, 'The server could not complete the request.'),
    fieldErrors: parseFieldErrors(value.fieldErrors),
  }
}

export function normalizeFetchError(error: unknown): NormalizedApiError {
  if (
    error instanceof DOMException && error.name === 'AbortError' ||
    isRecord(error) && error.name === 'AbortError'
  ) {
    return { kind: 'aborted', message: 'The request was cancelled.' }
  }
  return { kind: 'network', message: 'Unable to reach the quote service.' }
}

export function toThrowable(error: NormalizedApiError): Error & NormalizedApiError {
  return Object.assign(new Error(error.message), error)
}
