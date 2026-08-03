import type { NormalizedApiError } from './apiError'

export const RETRYABLE_SUBMISSION_CODES = [
  'INSURER_SUBMISSION_FAILED',
  'INSURER_TIMEOUT',
] as const

export type SubmissionOutcome =
  | Readonly<{ kind: 'retryable-failure'; error: NormalizedApiError }>
  | Readonly<{ kind: 'in-progress'; error: NormalizedApiError }>
  | Readonly<{ kind: 'expired'; error?: NormalizedApiError }>
  | Readonly<{ kind: 'not-found'; error: NormalizedApiError }>
  | Readonly<{ kind: 'unexpected-state'; error: NormalizedApiError }>

function hasCode(error: NormalizedApiError, codes: readonly string[]): boolean {
  return error.kind === 'backend' && error.code !== undefined && codes.includes(error.code)
}

export function isRetryableSubmissionError(error: NormalizedApiError): boolean {
  return hasCode(error, RETRYABLE_SUBMISSION_CODES)
}

export function isSubmissionInProgressError(error: NormalizedApiError): boolean {
  return hasCode(error, ['SUBMISSION_IN_PROGRESS'])
}

export function isQuoteNotFoundError(error: NormalizedApiError): boolean {
  return hasCode(error, ['QUOTE_NOT_FOUND']) || error.kind === 'backend' && error.status === 404
}

export function shouldReconcileSubmissionError(error: NormalizedApiError): boolean {
  if (error.kind === 'network') return true
  return isRetryableSubmissionError(error) ||
    hasCode(error, ['INVALID_QUOTE_STATE', 'INCOMPLETE_QUOTE'])
}

export function submissionErrorMessage(error: NormalizedApiError): string {
  if (isRetryableSubmissionError(error)) {
    return error.kind === 'backend' && error.code === 'INSURER_TIMEOUT'
      ? 'The insurer did not respond in time. You can retry this submission.'
      : 'The insurer could not complete the submission. You can retry it.'
  }
  if (isSubmissionInProgressError(error)) {
    return 'Another submission attempt is still in progress. Wait before retrying.'
  }
  if (isQuoteNotFoundError(error)) {
    return 'This quote could not be found. Start a new quote to continue.'
  }
  if (error.kind === 'backend' && error.code === 'INCOMPLETE_QUOTE') {
    return 'Review and update the accepted coverage before submitting this quote.'
  }
  if (error.kind === 'backend' && error.code === 'INVALID_QUOTE_STATE') {
    return 'This quote cannot be submitted from its current server state.'
  }
  if (error.kind === 'backend' && (
    error.code === 'AUTHENTICATION_REQUIRED' || error.code === 'INVALID_API_KEY'
  )) {
    return 'The quote service authentication is not configured correctly.'
  }
  if (error.kind === 'invalid-response') return error.message
  if (error.kind === 'network') return error.message
  return 'The quote could not be submitted. Your quote details have been preserved.'
}
