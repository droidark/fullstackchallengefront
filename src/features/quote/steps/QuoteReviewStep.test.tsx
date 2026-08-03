import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '../../../app/App'
import {
  coveredQuote,
  draftQuote,
  olderCoveredQuote,
  olderDraftQuote,
  submittedQuote,
} from '../../../shared/test/fixtures'
import { testApiBaseUrl, testApiKey } from '../../../shared/test/handlers'
import { renderWithProviders } from '../../../shared/test/render'
import { server } from '../../../shared/test/server'
import { createQuoteApi } from '../api/quoteApi'

const api = createQuoteApi({ apiBaseUrl: testApiBaseUrl, apiKey: testApiKey })

async function reachReview(age: 65 | 66) {
  const user = userEvent.setup()
  const older = age === 66
  server.use(
    http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(
      older ? olderDraftQuote : draftQuote,
      { status: 201 },
    )),
    http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json(
      older ? olderCoveredQuote : coveredQuote,
    )),
  )
  await user.type(screen.getByLabelText(/^Full name/), 'Review Tester')
  await user.type(screen.getByLabelText(/^Email/), 'review@example.invalid')
  await user.type(screen.getByLabelText(/^Age/), String(age))
  await user.type(screen.getByLabelText(/^ZIP code/), '00123')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 2, name: 'Coverage' })
  await user.click(screen.getByRole('radio', { name: older ? 'PREMIUM' : 'STANDARD' }))
  if (older) {
    for (const question of [
      'Do you have pre-existing conditions?',
      'Do you take prescription medication?',
      'Do you need spouse coverage?',
    ]) {
      await user.click(within(screen.getByRole('group', { name: question })).getByRole('radio', { name: 'Yes' }))
    }
    await user.click(screen.getByRole('checkbox', { name: 'Hypertension' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you use tobacco?' })).getByRole('radio', { name: 'No' }))
  }
  await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
  await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })
  return user
}

describe('QuoteReviewStep', () => {
  it('shows complete accepted server data read-only and omits inapplicable medical answers at age 65', async () => {
    renderWithProviders(<App quoteApi={api} />)
    await reachReview(65)

    expect(screen.getByText(coveredQuote.name)).toBeVisible()
    expect(screen.getByText(coveredQuote.email)).toBeVisible()
    expect(screen.getByText(coveredQuote.zipCode)).toBeVisible()
    expect(screen.getByText('Standard')).toBeVisible()
    expect(screen.getByText('100.00')).toBeVisible()
    expect(screen.getByText('Draft')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Supplemental Answers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Coverage' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit Quote' })).toBeEnabled()
  })

  it('shows every applicable answer and readable conditions for age over 65', async () => {
    renderWithProviders(<App quoteApi={api} />)
    await reachReview(66)

    const supplemental = screen.getByRole('heading', { name: 'Supplemental Answers' }).closest('section')
    expect(supplemental).not.toBeNull()
    if (supplemental === null) throw new Error('Supplemental summary was not rendered.')
    expect(within(supplemental).getByText('Hypertension')).toBeVisible()
    expect(within(supplemental).getAllByText('Yes')).toHaveLength(3)
    expect(within(supplemental).getByText('No')).toBeVisible()
    expect(within(supplemental).queryByText('HYPERTENSION')).not.toBeInTheDocument()
  })

  it('disables Back and Submit while loading and never shows success before the response', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, async () => {
      await delay(100)
      return HttpResponse.json(submittedQuote)
    }))
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview(65)
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(screen.getByRole('button', { name: 'Submitting quote…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Back to Coverage' })).toBeDisabled()
    expect(screen.getByRole('form', { name: 'Submit quote' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
  })
})
