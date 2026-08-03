import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '../../../app/App'
import {
  coveredQuote,
  draftQuote,
  expiredQuote,
  submissionFailedQuote,
  submittedQuote,
} from '../../../shared/test/fixtures'
import { testApiBaseUrl, testApiKey } from '../../../shared/test/handlers'
import { renderWithProviders } from '../../../shared/test/render'
import { server } from '../../../shared/test/server'
import { createQuoteApi } from '../api/quoteApi'

const api = createQuoteApi({ apiBaseUrl: testApiBaseUrl, apiKey: testApiKey })

function backendError(status: number, code: string, message: string) {
  return {
    timestamp: '2026-08-02T12:00:00Z',
    status,
    error: status === 401 ? 'Unauthorized' : 'Submission Error',
    code,
    message,
    path: `/quotes/${draftQuote.id}/submit`,
    fieldErrors: [],
  }
}

async function reachReview() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^Full name/), 'Submission Tester')
  await user.type(screen.getByLabelText(/^Email/), 'submission@example.invalid')
  await user.type(screen.getByLabelText(/^Age/), '65')
  await user.type(screen.getByLabelText(/^ZIP code/), '00123')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 2, name: 'Coverage' })
  await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
  await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
  await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })
  return user
}

describe('submission wizard flow', () => {
  it('submits the active quote with authentication and no body, then renders a terminal server result', async () => {
    let submitPath = ''
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, async ({ request }) => {
      submitPath = new URL(request.url).pathname
      expect(request.headers.get('X-API-Key')).toBe(testApiKey)
      expect(request.headers.get('Accept')).toBe('application/json')
      expect(request.headers.get('Content-Type')).toBeNull()
      expect(await request.text()).toBe('')
      return HttpResponse.json(submittedQuote)
    }))
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Quote submitted' })).toHaveFocus()
    expect(submitPath).toBe(`/quotes/${coveredQuote.id}/submit`)
    expect(screen.getByText('Submitted')).toBeVisible()
    expect(screen.getByText('100.00')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit Quote' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
  })

  it('prevents rapid repeated activation from issuing more than one submit request', async () => {
    let submissions = 0
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, async () => {
      submissions += 1
      await delay(80)
      return HttpResponse.json(submittedQuote)
    }))
    renderWithProviders(<App quoteApi={api} />)
    await reachReview()
    const submit = screen.getByRole('button', { name: 'Submit Quote' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(submissions).toBe(1)
  })

  it('reconciles insurer failure once and retries the same quote explicitly to success', async () => {
    let creates = 0
    let patches = 0
    let submissions = 0
    let reconciliations = 0
    const submitIds: string[] = []
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => {
        creates += 1
        return HttpResponse.json(draftQuote, { status: 201 })
      }),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => {
        patches += 1
        return HttpResponse.json(coveredQuote)
      }),
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, ({ params }) => {
        submissions += 1
        submitIds.push(String(params.id))
        return submissions === 1
          ? HttpResponse.json(backendError(502, 'INSURER_SUBMISSION_FAILED', 'Upstream detail'), { status: 502 })
          : HttpResponse.json(submittedQuote)
      }),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reconciliations += 1
        return HttpResponse.json(submissionFailedQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Submission failed' })).toBeVisible()
    expect(screen.getByText('The insurer could not complete the submission. You can retry it.')).toBeVisible()
    expect(screen.getAllByText('Submission failed').some((element) => element.closest('dd') !== null)).toBe(true)
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Back to Coverage' })).toBeEnabled()
    expect(reconciliations).toBe(1)
    expect(submissions).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Retry Submission' }))
    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(submitIds).toEqual([coveredQuote.id, coveredQuote.id])
    expect(creates).toBe(1)
    expect(patches).toBe(1)
  })

  it('preserves the primary retryable error and same quote when reconciliation fails', async () => {
    let creates = 0
    let patches = 0
    let submissions = 0
    let reads = 0
    const submitIds: string[] = []
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => {
        creates += 1
        return HttpResponse.json(draftQuote, { status: 201 })
      }),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => {
        patches += 1
        return HttpResponse.json(coveredQuote)
      }),
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, ({ params }) => {
        submissions += 1
        submitIds.push(String(params.id))
        return submissions === 1
          ? HttpResponse.json(backendError(502, 'INSURER_SUBMISSION_FAILED', 'Unsafe upstream detail'), {
            status: 502,
          })
          : HttpResponse.json(submittedQuote)
      }),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reads += 1
        return HttpResponse.error()
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Submission failed' })).toBeVisible()
    expect(screen.getByText('The insurer could not complete the submission. You can retry it.')).toBeVisible()
    expect(screen.queryByText(/unsafe upstream/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect({ creates, patches, submissions, reads }).toEqual({
      creates: 1, patches: 1, submissions: 1, reads: 1,
    })

    await user.click(screen.getByRole('button', { name: 'Retry Submission' }))
    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(submitIds).toEqual([coveredQuote.id, coveredQuote.id])
    expect({ creates, patches, submissions, reads }).toEqual({
      creates: 1, patches: 1, submissions: 2, reads: 1,
    })
  })

  it('treats insurer timeout as retryable without automatic retry', async () => {
    let submissions = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => {
        submissions += 1
        return HttpResponse.json(backendError(504, 'INSURER_TIMEOUT', 'Gateway detail'), { status: 504 })
      }),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => HttpResponse.json(submissionFailedQuote)),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByText('The insurer did not respond in time. You can retry this submission.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
    expect(submissions).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Retry Submission' }))
    await waitFor(() => { expect(submissions).toBe(2) })
    expect(screen.getByRole('alert')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Start New Quote' }))
    expect(await screen.findByRole('heading', { name: 'Personal Information' })).toBeVisible()
  })

  it('handles submission in progress without polling and permits only explicit retry', async () => {
    let submissions = 0
    let reads = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, async () => {
        submissions += 1
        if (submissions === 1) {
          return HttpResponse.json(backendError(409, 'SUBMISSION_IN_PROGRESS', 'Conflict detail'), { status: 409 })
        }
        await delay(80)
        return HttpResponse.json(submittedQuote)
      }),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reads += 1
        return HttpResponse.json(coveredQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Submission in progress' })).toBeVisible()
    expect(screen.getByText('Another submission attempt is still in progress. Wait before retrying.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(submissions).toBe(1)
    expect(reads).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Retry Submission' }))
    expect(screen.getByRole('button', { name: 'Retrying submission…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeDisabled()
    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(submissions).toBe(2)
    expect(reads).toBe(0)
  })

  it('reconciles an expired quote and blocks retry and editing', async () => {
    let reads = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(
        backendError(409, 'INVALID_QUOTE_STATE', 'Invalid state'),
        { status: 409 },
      )),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reads += 1
        return HttpResponse.json(expiredQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Quote expired' })).toBeVisible()
    expect(screen.getByText('Expired')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
    expect(reads).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Start New Quote' }))
    expect(await screen.findByRole('heading', { name: 'Personal Information' })).toBeVisible()
  })

  it('returns an incomplete server quote to Coverage without submitting locally again', async () => {
    const incompleteQuote = {
      ...submissionFailedQuote,
      coverageType: null,
      monthlyPremium: null,
    }
    server.use(
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(
        backendError(400, 'INCOMPLETE_QUOTE', 'Coverage is incomplete'),
        { status: 400 },
      )),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => HttpResponse.json(incompleteQuote)),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Coverage' })).toBeVisible()
    expect(screen.getByText('Review and update the accepted coverage before submitting this quote.')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'STANDARD' })).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Back to personal information' })).not.toBeInTheDocument()
  })

  it('handles a server-confirmed missing quote with only Start New Quote', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(
      backendError(404, 'QUOTE_NOT_FOUND', 'Quote was not found'),
      { status: 404 },
    )))
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Quote unavailable' })).toBeVisible()
    expect(screen.getByText('This quote could not be found. Start a new quote to continue.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
  })

  it('renders authentication failure safely while preserving the review', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(
      backendError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'),
      { status: 401 },
    )))
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByText('The quote service authentication is not configured correctly.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Review and Submit' })).toBeVisible()
    expect(screen.getByText('100.00')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
  })

  it('recovers from a network failure with one bounded reconciliation and no fabricated result', async () => {
    let reads = 0
    let submissions = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, async () => {
        submissions += 1
        if (submissions > 1) await delay(80)
        return HttpResponse.error()
      }),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reads += 1
        return HttpResponse.json(draftQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByText('Unable to reach the quote service.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review and Submit' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry Submission' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
    expect(reads).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Retry Submission' }))
    expect(screen.getByRole('button', { name: 'Retrying submission…' })).toBeDisabled()
    expect(await screen.findByText('Unable to reach the quote service.')).toBeVisible()
    expect(submissions).toBe(2)
    expect(reads).toBe(2)
  })

  it('normalizes a non-JSON submission error without exposing its body', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => new HttpResponse(
      '<html>insurer internals</html>',
      { status: 502, headers: { 'Content-Type': 'text/html' } },
    )))
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByText('The quote could not be submitted. Your quote details have been preserved.')).toBeVisible()
    expect(screen.queryByText(/insurer internals/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
  })

  it.each([
    ['invalid shape', { id: 'invalid' }],
    ['wrong successful status', coveredQuote],
    ['incomplete over-65 answers', { ...submittedQuote, age: 66 }],
    ['a different quote ID', {
      ...submittedQuote,
      id: '22222222-2222-4222-8222-222222222222',
    }],
  ])('rejects a malformed successful submit response with %s', async (_label, response) => {
    server.use(http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(response)))
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByText(/The quote service returned an unexpected (submission )?response\./)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review and Submit' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Quote submitted' })).not.toBeInTheDocument()
  })

  it('resets the frontend after success without deleting or requesting another backend resource', async () => {
    let creates = 0
    let patches = 0
    let submissions = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => {
        creates += 1
        return HttpResponse.json(draftQuote, { status: 201 })
      }),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => {
        patches += 1
        return HttpResponse.json(coveredQuote)
      }),
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => {
        submissions += 1
        return HttpResponse.json(submittedQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))
    await screen.findByRole('heading', { name: 'Quote submitted' })
    expect({ creates, patches, submissions }).toEqual({ creates: 1, patches: 1, submissions: 1 })
    await user.click(screen.getByRole('button', { name: 'Start New Quote' }))

    expect(await screen.findByRole('heading', { name: 'Personal Information' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Personal Information' })).toHaveFocus()
    expect(screen.getByLabelText(/^Full name/)).toHaveValue('')
    expect(screen.queryByText(submittedQuote.id)).not.toBeInTheDocument()
    expect({ creates, patches, submissions }).toEqual({ creates: 1, patches: 1, submissions: 1 })
  })

  it('edits coverage on the same SUBMISSION_FAILED quote and submits it again', async () => {
    let submissions = 0
    let patches = 0
    const patchIds: string[] = []
    const submitIds: string[] = []
    server.use(
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, ({ params }) => {
        submissions += 1
        submitIds.push(String(params.id))
        return submissions === 1
          ? HttpResponse.json(backendError(502, 'INSURER_SUBMISSION_FAILED', 'Failed'), { status: 502 })
          : HttpResponse.json({ ...submittedQuote, coverageType: 'BASIC', monthlyPremium: 50 })
      }),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => HttpResponse.json(submissionFailedQuote)),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, async ({ params, request }) => {
        patches += 1
        patchIds.push(String(params.id))
        if (patches === 1) return HttpResponse.json(coveredQuote)
        expect(await request.json()).toEqual({ coverageType: 'BASIC' })
        return HttpResponse.json({
          ...submissionFailedQuote,
          coverageType: 'BASIC',
          monthlyPremium: 50,
        })
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))
    await screen.findByRole('heading', { name: 'Submission failed' })
    await user.click(screen.getByRole('button', { name: 'Back to Coverage' }))
    expect(screen.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
    expect(screen.queryByRole('button', { name: 'Back to personal information' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'BASIC' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    expect(await screen.findByText('50.00')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))

    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(patchIds).toEqual([coveredQuote.id, coveredQuote.id])
    expect(submitIds).toEqual([coveredQuote.id, coveredQuote.id])
  })

  it('reconciles expiration that occurs while editing failed-quote Coverage', async () => {
    let patches = 0
    let reads = 0
    server.use(
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => {
        patches += 1
        return patches === 1
          ? HttpResponse.json(coveredQuote)
          : HttpResponse.json(backendError(409, 'INVALID_QUOTE_STATE', 'Quote is not editable'), {
            status: 409,
          })
      }),
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(
        backendError(502, 'INSURER_SUBMISSION_FAILED', 'Failed'),
        { status: 502 },
      )),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reads += 1
        return HttpResponse.json(reads === 1 ? submissionFailedQuote : expiredQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))
    await screen.findByRole('heading', { name: 'Submission failed' })
    await user.click(screen.getByRole('button', { name: 'Back to Coverage' }))
    await user.click(screen.getByRole('radio', { name: 'BASIC' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByRole('heading', { name: 'Quote expired' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
    expect(patches).toBe(2)
    expect(reads).toBe(2)
  })

  it('reconciles a submitted terminal quote that changes while editing Coverage', async () => {
    let patches = 0
    let reads = 0
    server.use(
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => {
        patches += 1
        return patches === 1
          ? HttpResponse.json(coveredQuote)
          : HttpResponse.json(backendError(409, 'INVALID_QUOTE_STATE', 'Quote is not editable'), {
            status: 409,
          })
      }),
      http.post(`${testApiBaseUrl}/quotes/:id/submit`, () => HttpResponse.json(
        backendError(502, 'INSURER_SUBMISSION_FAILED', 'Failed'),
        { status: 502 },
      )),
      http.get(`${testApiBaseUrl}/quotes/:id`, () => {
        reads += 1
        return HttpResponse.json(reads === 1 ? submissionFailedQuote : submittedQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await reachReview()
    await user.click(screen.getByRole('button', { name: 'Submit Quote' }))
    await screen.findByRole('heading', { name: 'Submission failed' })
    await user.click(screen.getByRole('button', { name: 'Back to Coverage' }))
    await user.click(screen.getByRole('radio', { name: 'BASIC' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByRole('heading', { name: 'Quote submitted' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry Submission' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to Coverage' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start New Quote' })).toBeEnabled()
    expect(patches).toBe(2)
    expect(reads).toBe(2)
  })
})
