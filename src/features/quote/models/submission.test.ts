import { describe, expect, it } from 'vitest'
import type { NormalizedApiError } from './apiError'
import {
  isQuoteNotFoundError,
  isRetryableSubmissionError,
  isSubmissionInProgressError,
  shouldReconcileSubmissionError,
  submissionErrorMessage,
} from './submission'

function backend(code: string, status = 409): NormalizedApiError {
  return { kind: 'backend', status, code, message: 'unsafe upstream detail', fieldErrors: [] }
}

describe('submission error policy', () => {
  it('recognizes the planned retryable insurer codes and gives safe actionable messages', () => {
    const failure = backend('INSURER_SUBMISSION_FAILED', 502)
    const timeout = backend('INSURER_TIMEOUT', 504)
    expect(isRetryableSubmissionError(failure)).toBe(true)
    expect(isRetryableSubmissionError(timeout)).toBe(true)
    expect(submissionErrorMessage(failure)).toContain('retry')
    expect(submissionErrorMessage(timeout)).toContain('did not respond in time')
    expect(submissionErrorMessage(failure)).not.toContain('upstream')
  })

  it('distinguishes in-progress, not-found, and unknown codes', () => {
    expect(isSubmissionInProgressError(backend('SUBMISSION_IN_PROGRESS'))).toBe(true)
    expect(isQuoteNotFoundError(backend('QUOTE_NOT_FOUND', 404))).toBe(true)
    expect(isRetryableSubmissionError(backend('UNKNOWN'))).toBe(false)
    expect(submissionErrorMessage(backend('UNKNOWN'))).toBe(
      'The quote could not be submitted. Your quote details have been preserved.',
    )
  })

  it('permits one bounded reconciliation only for ambiguous or state-changing failures', () => {
    expect(shouldReconcileSubmissionError({ kind: 'network', message: 'offline' })).toBe(true)
    expect(shouldReconcileSubmissionError(backend('INSURER_TIMEOUT'))).toBe(true)
    expect(shouldReconcileSubmissionError(backend('INVALID_QUOTE_STATE'))).toBe(true)
    expect(shouldReconcileSubmissionError(backend('AUTHENTICATION_REQUIRED', 401))).toBe(false)
    expect(shouldReconcileSubmissionError({ kind: 'invalid-response', message: 'bad' })).toBe(false)
  })
})
