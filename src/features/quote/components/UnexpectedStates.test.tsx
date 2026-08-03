import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../shared/test/render'
import { CoverageStep } from '../steps/CoverageStep'
import { QuoteReviewStep } from '../steps/QuoteReviewStep'
import {
  QuoteFlowActionsContext,
  QuoteFlowStateContext,
} from '../context/quoteFlowContexts'
import type { QuoteFlowActions } from '../context/quoteFlowContexts'
import { initialQuoteFlowState } from '../context/quoteFlowReducer'
import type { QuoteFlowState } from '../context/quoteFlowReducer'
import { SubmissionResult } from './SubmissionResult'

function renderState(ui: React.ReactElement, state: QuoteFlowState) {
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
        {ui}
      </QuoteFlowActionsContext>
    </QuoteFlowStateContext>,
  )
  return actions
}

describe('unexpected visual states', () => {
  it('recovers safely when Coverage has no active quote', async () => {
    const actions = renderState(
      <CoverageStep />,
      { ...initialQuoteFlowState, currentStep: 'coverage' },
    )

    expect(screen.getByRole('heading', { name: 'Coverage unavailable' })).toBeVisible()
    expect(screen.getByText('No active quote is available for coverage selection.')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Start New Quote' }))
    expect(actions.resetFlow).toHaveBeenCalledOnce()
  })

  it('offers safe recovery when Review has no accepted quote', async () => {
    const actions = renderState(
      <QuoteReviewStep />,
      { ...initialQuoteFlowState, currentStep: 'review' },
    )

    expect(screen.getByRole('heading', { name: 'Review and Submit' })).toBeVisible()
    expect(screen.getByText(/accepted coverage, a server premium/i)).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Submit quote' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start New Quote' }))
    expect(actions.resetFlow).toHaveBeenCalledOnce()
  })

  it('does not fabricate a result when Result has no active quote', () => {
    renderState(
      <SubmissionResult />,
      { ...initialQuoteFlowState, currentStep: 'result' },
    )

    expect(screen.getByRole('heading', { name: 'Unable to confirm submission' })).toBeVisible()
    expect(screen.getByText('The quote service returned an unexpected submission state.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
  })
})
