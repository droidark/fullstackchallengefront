import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  expiredQuote,
  submissionFailedQuote,
  submittedQuote,
  coveredQuote,
} from '../../../shared/test/fixtures'
import { renderWithProviders } from '../../../shared/test/render'
import type { NormalizedApiError } from '../models/apiError'
import {
  QuoteFlowActionsContext,
  QuoteFlowStateContext,
} from '../context/quoteFlowContexts'
import type { QuoteFlowActions } from '../context/quoteFlowContexts'
import {
  initialQuoteFlowState,
} from '../context/quoteFlowReducer'
import type { QuoteFlowState } from '../context/quoteFlowReducer'
import { SubmissionResult } from './SubmissionResult'

const insurerError: NormalizedApiError = {
  kind: 'backend',
  status: 502,
  code: 'INSURER_SUBMISSION_FAILED',
  message: 'The insurer could not complete the submission. You can retry it.',
  fieldErrors: [],
}

function renderResult(state: QuoteFlowState) {
  const actions: QuoteFlowActions = {
    createOrReuseQuote: vi.fn(() => Promise.resolve({ ok: true as const, reused: false })),
    updateCoverage: vi.fn(() => Promise.resolve({ ok: true as const })),
    submitActiveQuote: vi.fn(() => Promise.resolve({ ok: true as const })),
    goToPersonal: vi.fn(),
    goToCoverage: vi.fn(),
    clearError: vi.fn(),
    resetFlow: vi.fn(),
  }

  renderWithProviders(
    <QuoteFlowStateContext value={state}>
      <QuoteFlowActionsContext value={actions}>
        <SubmissionResult />
      </QuoteFlowActionsContext>
    </QuoteFlowStateContext>,
  )
  return actions
}

function resultState(overrides: Partial<QuoteFlowState>): QuoteFlowState {
  return {
    ...initialQuoteFlowState,
    currentStep: 'result',
    ...overrides,
  }
}

describe('SubmissionResult', () => {
  it('renders a submitted quote as a terminal read-only result', () => {
    renderResult(resultState({ quote: submittedQuote }))

    expect(screen.getByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Quote submitted' })).toHaveFocus()
    expect(screen.getByText('Submitted')).toBeVisible()
    expect(screen.getByText('100.00')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit Quote' })).not.toBeInTheDocument()
  })

  it('preserves a failed quote with explicit retry, edit, and reset actions', () => {
    renderResult(resultState({
      quote: submissionFailedQuote,
      submissionOutcome: { kind: 'retryable-failure', error: insurerError },
    }))

    expect(screen.getByRole('heading', { name: 'Submission failed' })).toBeVisible()
    expect(screen.getByText('The insurer could not complete the submission. You can retry it.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByText(submissionFailedQuote.email)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Back to Coverage' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
  })

  it('renders expiration without retry or editing', () => {
    renderResult(resultState({
      quote: expiredQuote,
      submissionOutcome: { kind: 'expired' },
    }))

    expect(screen.getByRole('heading', { name: 'Quote expired' })).toBeVisible()
    expect(screen.getByText(/can no longer be edited or submitted/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Quote expired' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
  })

  it('renders an unexpected result safely without fabricating success', () => {
    renderResult(resultState({ quote: coveredQuote }))

    expect(screen.getByRole('heading', { name: 'Unable to confirm submission' })).toBeVisible()
    expect(screen.getByText('The quote service returned an unexpected submission state.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
  })

  it('keeps retry controls stable and busy while a result retry is active', () => {
    renderResult(resultState({
      quote: submissionFailedQuote,
      activeRequest: 'submit',
      submissionOutcome: { kind: 'retryable-failure', error: insurerError },
    }))

    expect(screen.getByRole('button', { name: 'Retrying submission…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back to Coverage' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeDisabled()
    expect(screen.queryByText(insurerError.message)).not.toBeInTheDocument()
  })

  it('prioritizes the current in-progress outcome over a stale failed quote status', () => {
    const inProgressError: NormalizedApiError = {
      kind: 'backend', status: 409, code: 'SUBMISSION_IN_PROGRESS',
      message: 'Another attempt is active', fieldErrors: [],
    }
    renderResult(resultState({
      quote: submissionFailedQuote,
      submissionOutcome: { kind: 'in-progress', error: inProgressError },
    }))

    expect(screen.getByRole('heading', { name: 'Submission in progress' })).toBeVisible()
    expect(screen.getByText('Another submission attempt is still in progress. Wait before retrying.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
  })

  it('prioritizes a current not-found outcome over a stale failed quote status', () => {
    const notFoundError: NormalizedApiError = {
      kind: 'backend', status: 404, code: 'QUOTE_NOT_FOUND',
      message: 'Quote not found', fieldErrors: [],
    }
    renderResult(resultState({
      quote: submissionFailedQuote,
      submissionOutcome: { kind: 'not-found', error: notFoundError },
    }))

    expect(screen.getByRole('heading', { name: 'Quote unavailable' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
  })

  it('keeps Retry Submission keyboard operable', async () => {
    const actions = renderResult(resultState({
      quote: submissionFailedQuote,
      submissionOutcome: { kind: 'retryable-failure', error: insurerError },
    }))
    const retry = screen.getByRole('button', { name: 'Retry Submission' })
    retry.focus()

    await userEvent.keyboard('{Enter}')

    expect(actions.submitActiveQuote).toHaveBeenCalledOnce()
  })
})
