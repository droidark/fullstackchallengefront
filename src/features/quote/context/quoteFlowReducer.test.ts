import { describe, expect, it } from 'vitest'
import {
  coveredQuote,
  draftQuote,
  expiredQuote,
  olderCoveredQuote,
  submissionFailedQuote,
  submittedQuote,
} from '../../../shared/test/fixtures'
import type { NormalizedApiError } from '../models/apiError'
import {
  initialQuoteFlowState,
  quoteFlowReducer,
} from './quoteFlowReducer'

const submitted = {
  name: 'Ada Lovelace',
  email: 'ada@example.invalid',
  age: 65,
  zipCode: '00123',
}
const networkError: NormalizedApiError = { kind: 'network', message: 'Unavailable' }
const insurerError: NormalizedApiError = {
  kind: 'backend',
  status: 502,
  code: 'INSURER_SUBMISSION_FAILED',
  message: 'Submission failed',
  fieldErrors: [],
}

const reviewState = {
  ...initialQuoteFlowState,
  currentStep: 'review' as const,
  quote: coveredQuote,
  submittedPersonalInformation: submitted,
}

describe('quoteFlowReducer', () => {
  it('provides an empty personal initial state', () => {
    expect(initialQuoteFlowState).toMatchObject({
      currentStep: 'personal',
      quote: undefined,
      activeRequest: undefined,
      globalError: undefined,
    })
  })

  it('commits personal information without mutating the prior state', () => {
    const next = quoteFlowReducer(initialQuoteFlowState, {
      type: 'PERSONAL_INFORMATION_COMMITTED',
      payload: submitted,
    })
    expect(next).not.toBe(initialQuoteFlowState)
    expect(next.personalInformation).toBe(submitted)
    expect(initialQuoteFlowState.personalInformation.name).toBe('')
  })

  it('starts creation and clears an old global error', () => {
    const state = { ...initialQuoteFlowState, globalError: networkError }
    expect(quoteFlowReducer(state, { type: 'QUOTE_CREATION_STARTED' })).toMatchObject({
      currentStep: 'personal',
      activeRequest: 'create',
      globalError: undefined,
    })
  })

  it('stores the full quote and snapshot and moves to coverage on success', () => {
    const started = quoteFlowReducer(initialQuoteFlowState, { type: 'QUOTE_CREATION_STARTED' })
    const next = quoteFlowReducer(started, {
      type: 'QUOTE_CREATED',
      payload: { quote: draftQuote, submittedPersonalInformation: submitted },
    })
    expect(next).toMatchObject({
      currentStep: 'coverage',
      quote: draftQuote,
      submittedPersonalInformation: submitted,
      activeRequest: undefined,
      globalError: undefined,
    })
  })

  it('retains an existing quote and personal step when replacement creation fails', () => {
    const state = {
      ...initialQuoteFlowState,
      quote: draftQuote,
      submittedPersonalInformation: submitted,
      personalInformation: { ...submitted, name: 'Changed' },
      activeRequest: 'create' as const,
    }
    const next = quoteFlowReducer(state, { type: 'QUOTE_CREATION_FAILED', payload: networkError })
    expect(next.quote).toBe(draftQuote)
    expect(next.submittedPersonalInformation).toBe(submitted)
    expect(next.personalInformation.name).toBe('Changed')
    expect(next).toMatchObject({ currentStep: 'personal', globalError: networkError })
  })

  it('navigates back only when a quote exists and returns to coverage only for a draft', () => {
    expect(quoteFlowReducer(initialQuoteFlowState, { type: 'GO_TO_PERSONAL' })).toBe(initialQuoteFlowState)
    const covered = {
      ...initialQuoteFlowState,
      currentStep: 'coverage' as const,
      quote: draftQuote,
      submittedPersonalInformation: submitted,
    }
    const personal = quoteFlowReducer(covered, { type: 'GO_TO_PERSONAL' })
    expect(personal.currentStep).toBe('personal')
    expect(quoteFlowReducer(personal, { type: 'GO_TO_COVERAGE' }).currentStep).toBe('coverage')
    expect(quoteFlowReducer({ ...personal, quote: { ...draftQuote, status: 'EXPIRED' } }, {
      type: 'GO_TO_COVERAGE',
    })).toEqual({ ...personal, quote: { ...draftQuote, status: 'EXPIRED' } })
  })

  it('ignores impossible success and duplicate-start transitions', () => {
    expect(quoteFlowReducer(initialQuoteFlowState, {
      type: 'QUOTE_CREATED',
      payload: { quote: draftQuote, submittedPersonalInformation: submitted },
    })).toBe(initialQuoteFlowState)
    const started = quoteFlowReducer(initialQuoteFlowState, { type: 'QUOTE_CREATION_STARTED' })
    expect(quoteFlowReducer(started, { type: 'QUOTE_CREATION_STARTED' })).toBe(started)
  })

  it('clears errors and resets only when no request is active', () => {
    const withError = { ...initialQuoteFlowState, globalError: networkError }
    expect(quoteFlowReducer(withError, { type: 'CLEAR_ERROR' }).globalError).toBeUndefined()
    const populated = { ...withError, quote: draftQuote, submittedPersonalInformation: submitted }
    expect(quoteFlowReducer(populated, { type: 'RESET_FLOW' })).toBe(initialQuoteFlowState)
    const active = { ...populated, activeRequest: 'create' as const }
    expect(quoteFlowReducer(active, { type: 'RESET_FLOW' })).toBe(active)
  })

  it('guards coverage start and duplicate requests', () => {
    expect(quoteFlowReducer(initialQuoteFlowState, { type: 'COVERAGE_UPDATE_STARTED' })).toBe(initialQuoteFlowState)
    const coverage = { ...initialQuoteFlowState, currentStep: 'coverage' as const, quote: draftQuote, submittedPersonalInformation: submitted }
    const started = quoteFlowReducer(coverage, { type: 'COVERAGE_UPDATE_STARTED' })
    expect(started).toMatchObject({ activeRequest: 'coverage', globalError: undefined })
    expect(quoteFlowReducer(started, { type: 'COVERAGE_UPDATE_STARTED' })).toBe(started)
    expect(quoteFlowReducer(started, { type: 'GO_TO_PERSONAL' })).toBe(started)
  })

  it('replaces the quote and enters review only after valid coverage success', () => {
    const coverage = { ...initialQuoteFlowState, currentStep: 'coverage' as const, quote: draftQuote, submittedPersonalInformation: submitted }
    const started = quoteFlowReducer(coverage, { type: 'COVERAGE_UPDATE_STARTED' })
    const reviewed = quoteFlowReducer(started, { type: 'COVERAGE_UPDATED', payload: coveredQuote })
    expect(reviewed).toMatchObject({ currentStep: 'review', quote: coveredQuote, activeRequest: undefined, globalError: undefined })
    expect(quoteFlowReducer(coverage, { type: 'GO_TO_REVIEW' })).toBe(coverage)
    expect(quoteFlowReducer(reviewed, { type: 'GO_TO_COVERAGE' }).currentStep).toBe('coverage')
  })

  it('preserves the accepted quote and remains on coverage after failure', () => {
    const started = { ...initialQuoteFlowState, currentStep: 'coverage' as const, quote: coveredQuote,
      submittedPersonalInformation: submitted, activeRequest: 'coverage' as const }
    const failed = quoteFlowReducer(started, { type: 'COVERAGE_UPDATE_FAILED', payload: networkError })
    expect(failed).toMatchObject({ currentStep: 'coverage', quote: coveredQuote, activeRequest: undefined, globalError: networkError })
  })

  it('starts submission only for an eligible complete quote and rejects duplicate starts', () => {
    expect(quoteFlowReducer(initialQuoteFlowState, { type: 'SUBMISSION_STARTED' }))
      .toBe(initialQuoteFlowState)
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    expect(started).toMatchObject({ activeRequest: 'submit', globalError: undefined })
    expect(quoteFlowReducer(started, { type: 'SUBMISSION_STARTED' })).toBe(started)
    expect(quoteFlowReducer({ ...reviewState, activeRequest: 'coverage' }, { type: 'SUBMISSION_STARTED' }))
      .toEqual({ ...reviewState, activeRequest: 'coverage' })

    const incompleteOlder = { ...olderCoveredQuote, usesTobacco: null }
    const incompleteReview = { ...reviewState, quote: incompleteOlder }
    expect(quoteFlowReducer(incompleteReview, { type: 'SUBMISSION_STARTED' })).toBe(incompleteReview)
    expect(quoteFlowReducer({ ...incompleteReview, currentStep: 'coverage' }, { type: 'GO_TO_REVIEW' }))
      .toEqual({ ...incompleteReview, currentStep: 'coverage' })
  })

  it('requires an active submit and a complete SUBMITTED response before replacing the quote', () => {
    expect(quoteFlowReducer(reviewState, { type: 'SUBMISSION_SUCCEEDED', payload: submittedQuote }))
      .toBe(reviewState)
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    expect(quoteFlowReducer(started, { type: 'SUBMISSION_SUCCEEDED', payload: coveredQuote }))
      .toBe(started)
    expect(quoteFlowReducer(started, {
      type: 'SUBMISSION_SUCCEEDED',
      payload: { ...submittedQuote, id: '22222222-2222-4222-8222-222222222222' },
    })).toBe(started)
    const succeeded = quoteFlowReducer(started, { type: 'SUBMISSION_SUCCEEDED', payload: submittedQuote })
    expect(succeeded).toMatchObject({
      currentStep: 'result',
      quote: submittedQuote,
      activeRequest: undefined,
      globalError: undefined,
    })
    expect(reviewState.quote).toBe(coveredQuote)

    const incompleteOlder = { ...olderCoveredQuote, status: 'SUBMITTED' as const, usesTobacco: null }
    const olderReview = { ...reviewState, quote: olderCoveredQuote }
    const olderStarted = quoteFlowReducer(olderReview, { type: 'SUBMISSION_STARTED' })
    expect(quoteFlowReducer(olderStarted, {
      type: 'SUBMISSION_SUCCEEDED', payload: incompleteOlder,
    })).toBe(olderStarted)
  })

  it('stores a reconciled SUBMISSION_FAILED quote and preserves it for explicit retry', () => {
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    const failed = quoteFlowReducer(started, {
      type: 'SUBMISSION_FAILED',
      payload: { error: insurerError, quote: submissionFailedQuote },
    })
    expect(failed).toMatchObject({
      currentStep: 'result',
      quote: submissionFailedQuote,
      activeRequest: undefined,
      submissionOutcome: { kind: 'retryable-failure', error: insurerError },
    })
  })

  it('represents submission-in-progress safely and clears loading', () => {
    const inProgress: NormalizedApiError = {
      kind: 'backend', status: 409, code: 'SUBMISSION_IN_PROGRESS',
      message: 'In progress', fieldErrors: [],
    }
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    expect(quoteFlowReducer(started, { type: 'SUBMISSION_IN_PROGRESS', payload: inProgress }))
      .toMatchObject({
        currentStep: 'result',
        activeRequest: undefined,
        submissionOutcome: { kind: 'in-progress', error: inProgress },
      })
  })

  it('stores an expired reconciliation and blocks submission and editing', () => {
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    const expired = quoteFlowReducer(started, {
      type: 'QUOTE_EXPIRED',
      payload: { error: insurerError, quote: expiredQuote },
    })
    expect(expired).toMatchObject({
      currentStep: 'result',
      quote: expiredQuote,
      activeRequest: undefined,
      submissionOutcome: { kind: 'expired' },
    })
    expect(quoteFlowReducer(expired, { type: 'SUBMISSION_STARTED' })).toBe(expired)
    expect(quoteFlowReducer(expired, { type: 'GO_TO_COVERAGE' })).toBe(expired)
  })

  it('stores a complete submitted quote reconciled during a Coverage conflict', () => {
    const coverage = {
      ...reviewState,
      currentStep: 'coverage' as const,
      quote: submissionFailedQuote,
      activeRequest: 'coverage' as const,
    }
    expect(quoteFlowReducer(coverage, {
      type: 'SUBMITTED_QUOTE_RECONCILED', payload: submittedQuote,
    })).toMatchObject({
      currentStep: 'result',
      quote: submittedQuote,
      activeRequest: undefined,
    })
  })

  it('allows only a server-confirmed SUBMISSION_FAILED quote back to Coverage', () => {
    const failed = {
      ...reviewState,
      currentStep: 'result' as const,
      quote: submissionFailedQuote,
      submissionOutcome: { kind: 'retryable-failure' as const, error: insurerError },
    }
    expect(quoteFlowReducer(failed, { type: 'GO_TO_COVERAGE' })).toMatchObject({
      currentStep: 'coverage',
      submissionOutcome: undefined,
    })
    for (const quote of [submittedQuote, expiredQuote]) {
      const terminal = { ...failed, quote }
      expect(quoteFlowReducer(terminal, { type: 'GO_TO_COVERAGE' })).toBe(terminal)
    }
  })

  it('keeps recoverable request errors with the quote and releases submission loading', () => {
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    expect(quoteFlowReducer(started, { type: 'SUBMISSION_REQUEST_FAILED', payload: networkError }))
      .toMatchObject({
        currentStep: 'review',
        quote: coveredQuote,
        activeRequest: undefined,
        globalError: networkError,
      })
  })

  it('stores the latest server quote when incomplete submission reconciliation returns to Coverage', () => {
    const started = quoteFlowReducer(reviewState, { type: 'SUBMISSION_STARTED' })
    const incompleteQuote = { ...coveredQuote, coverageType: null, monthlyPremium: null }
    const incompleteError: NormalizedApiError = {
      kind: 'backend', status: 400, code: 'INCOMPLETE_QUOTE',
      message: 'Coverage is incomplete', fieldErrors: [],
    }
    expect(quoteFlowReducer(started, {
      type: 'INCOMPLETE_QUOTE',
      payload: { error: incompleteError, quote: incompleteQuote },
    })).toMatchObject({
      currentStep: 'coverage',
      quote: incompleteQuote,
      activeRequest: undefined,
      globalError: incompleteError,
    })
  })

  it('Start New Quote clears the complete submission flow without mutating the prior state', () => {
    const completed = {
      ...reviewState,
      currentStep: 'result' as const,
      quote: submittedQuote,
    }
    const reset = quoteFlowReducer(completed, { type: 'RESET_FLOW' })
    expect(reset).toBe(initialQuoteFlowState)
    expect(completed.quote).toBe(submittedQuote)
  })
})
