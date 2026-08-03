import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '../../../app/App'
import { coveredQuote, draftQuote, olderCoveredQuote, olderDraftQuote } from '../../../shared/test/fixtures'
import { testApiBaseUrl, testApiKey } from '../../../shared/test/handlers'
import { renderWithProviders } from '../../../shared/test/render'
import { server } from '../../../shared/test/server'
import { createQuoteApi } from '../api/quoteApi'

const api = createQuoteApi({ apiBaseUrl: testApiBaseUrl, apiKey: testApiKey })

function backendError(
  status: number,
  code: string,
  message: string,
  fieldErrors: readonly Readonly<{ field: string; message: string }>[] = [],
) {
  return {
    timestamp: '2026-08-02T12:00:00Z',
    status,
    error: status === 401 ? 'Unauthorized' : 'Bad Request',
    code,
    message,
    path: `/quotes/${draftQuote.id}/coverage`,
    fieldErrors,
  }
}

async function create(age: number) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^Full name/), 'Coverage Tester')
  await user.type(screen.getByLabelText(/^Email/), 'coverage@example.invalid')
  await user.type(screen.getByLabelText(/^Age/), String(age))
  await user.type(screen.getByLabelText(/^ZIP code/), '00123')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { level: 2, name: 'Coverage' })
  return user
}

describe('coverage wizard flow', () => {
  it('sends exactly coverageType for age 65 and displays only the server premium', async () => {
    let body: unknown
    let patches = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, async ({ request }) => {
        patches += 1
        body = await request.json()
        return HttpResponse.json(coveredQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    expect(screen.getByRole('heading', { level: 2, name: 'Coverage' })).toHaveFocus()
    expect(screen.queryByText(/pre-existing/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    const reviewHeading = await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })
    expect(reviewHeading).toBeVisible()
    expect(reviewHeading).toHaveFocus()
    expect(screen.getByText('100.00')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Submit Quote' })).toBeVisible()
    expect(body).toEqual({ coverageType: 'STANDARD' })
    expect(patches).toBe(1)
  })

  it('requires explicit age-66 answers, sends false values, and clears hidden conditions', async () => {
    let body: unknown
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(olderDraftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...olderCoveredQuote, hasPreexistingConditions: false, conditions: [], takesPrescriptionMedication: false })
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(66)
    await user.click(screen.getByRole('radio', { name: 'PREMIUM' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you have pre-existing conditions?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('checkbox', { name: 'Hypertension' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you have pre-existing conditions?' })).getByRole('radio', { name: 'No' }))
    for (const question of ['Do you take prescription medication?', 'Do you use tobacco?', 'Do you need spouse coverage?']) {
      await user.click(within(screen.getByRole('group', { name: question })).getByRole('radio', { name: 'No' }))
    }
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })
    expect(body).toEqual({ coverageType: 'PREMIUM', hasPreexistingConditions: false, conditions: [],
      takesPrescriptionMedication: false, usesTobacco: false, needsSpouseCoverage: false })
  })

  it('restores accepted server values when editing and always PATCHes again', async () => {
    let patches = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => {
        patches += 1
        return HttpResponse.json({ ...coveredQuote, coverageType: patches === 1 ? 'STANDARD' : 'BASIC', monthlyPremium: patches === 1 ? 100 : 80 })
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    await screen.findByText('100.00')
    await user.click(screen.getByRole('button', { name: 'Back to Coverage' }))
    expect(screen.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'BASIC' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    expect(await screen.findByText('80.00')).toBeVisible()
    expect(patches).toBe(2)
  })

  it('prevents rapid repeated Coverage activation from issuing more than one PATCH', async () => {
    let patches = 0
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, async () => {
        patches += 1
        await delay(80)
        return HttpResponse.json(coveredQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))

    const button = screen.getByRole('button', { name: 'Continue to Review' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })).toBeVisible()
    expect(patches).toBe(1)
  })

  it('maps a recognized backend coverage field error to the Coverage form', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json(
        backendError(400, 'VALIDATION_ERROR', 'Request validation failed', [
          { field: 'coverageType', message: 'Coverage type is not available' },
        ]),
        { status: 400 },
      )),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('Coverage type is not available')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'BASIC' })).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
  })

  it('associates the Coverage group error and focuses its first radio', async () => {
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    const group = screen.getByRole('radiogroup', { name: 'Coverage type' })
    await waitFor(() => { expect(group).toHaveAttribute('aria-invalid', 'true') })
    expect(group).toHaveAttribute('aria-describedby', 'coverage-type-helper')
    expect(screen.getByRole('radio', { name: 'BASIC' })).toHaveFocus()
  })

  it('supports Space for Coverage radios, Yes/No radios, and condition checkboxes', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(olderDraftQuote, { status: 201 })))
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(66)
    const premium = screen.getByRole('radio', { name: 'PREMIUM' })
    act(() => { premium.focus() })
    await user.keyboard(' ')
    expect(premium).toBeChecked()

    const preexistingGroup = screen.getByRole('group', { name: 'Do you have pre-existing conditions?' })
    const yes = within(preexistingGroup).getByRole('radio', { name: 'Yes' })
    act(() => { yes.focus() })
    await user.keyboard(' ')
    expect(yes).toBeChecked()

    const hypertension = screen.getByRole('checkbox', { name: 'Hypertension' })
    act(() => { hypertension.focus() })
    await user.keyboard(' ')
    expect(hypertension).toBeChecked()
    expect(screen.getByRole('group', { name: 'Conditions' })).toHaveAttribute(
      'aria-describedby',
      'coverage-conditions-helper',
    )
  })

  it('associates a required Yes/No error and focuses the first invalid answer', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(olderDraftQuote, { status: 201 })))
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(66)
    await user.click(screen.getByRole('radio', { name: 'PREMIUM' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    const group = screen.getByRole('group', { name: 'Do you have pre-existing conditions?' })
    await waitFor(() => {
      expect(group).toHaveAttribute('aria-describedby', 'coverage-hasPreexistingConditions-helper')
    })
    expect(within(group).getByRole('radio', { name: 'Yes' })).toHaveFocus()
    expect(screen.getAllByText('Select Yes or No.').length).toBeGreaterThan(0)
  })

  it('keeps an unknown backend coverage field error in the global alert', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json(
        backendError(400, 'VALIDATION_ERROR', 'Request validation failed', [
          { field: 'policyNumber', message: 'is required' },
        ]),
        { status: 400 },
      )),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('policyNumber: is required')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
  })

  it('renders authentication failure during PATCH as a safe configuration message', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json(
        backendError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'),
        { status: 401 },
      )),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('The quote service authentication is not configured correctly.')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue to Review' })).toBeEnabled()
  })

  it('recovers from a network failure during PATCH without losing Coverage values', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.error()),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('Unable to reach the quote service.')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Continue to Review' })).toBeEnabled()
    expect(screen.queryByRole('heading', { level: 2, name: 'Review and Submit' })).not.toBeInTheDocument()
  })

  it('rejects a malformed successful coverage response without navigating to Review', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json({ id: 'invalid' })),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('The quote service returned an unexpected response.')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'STANDARD' })).toBeChecked()
    expect(screen.getByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
  })

  it('rejects a valid coverage response for a different quote ID', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(draftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json({
        ...coveredQuote,
        id: '22222222-2222-4222-8222-222222222222',
      })),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(65)
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('The quote service returned an unexpected response.')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
  })

  it('rejects an incomplete successful age-over-65 coverage response', async () => {
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json(olderDraftQuote, { status: 201 })),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, () => HttpResponse.json({
        ...olderCoveredQuote,
        takesPrescriptionMedication: null,
      })),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(66)
    await user.click(screen.getByRole('radio', { name: 'PREMIUM' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you have pre-existing conditions?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('checkbox', { name: 'Hypertension' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you take prescription medication?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you use tobacco?' })).getByRole('radio', { name: 'No' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you need spouse coverage?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(await screen.findByText('The quote service returned an unexpected response.')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: 'Review and Submit' })).not.toBeInTheDocument()
  })

  it('cleans old medical answers when personal replacement changes age from over 65 to 65', async () => {
    let creates = 0
    const createBodies: unknown[] = []
    const patchBodies: unknown[] = []
    const patchIds: string[] = []
    server.use(
      http.post(`${testApiBaseUrl}/quotes`, async ({ request }) => {
        creates += 1
        createBodies.push(await request.json())
        return HttpResponse.json(creates === 1 ? olderDraftQuote : draftQuote, { status: 201 })
      }),
      http.patch(`${testApiBaseUrl}/quotes/:id/coverage`, async ({ params, request }) => {
        patchIds.push(String(params.id))
        patchBodies.push(await request.json())
        return HttpResponse.json(patchBodies.length === 1 ? olderCoveredQuote : coveredQuote)
      }),
    )
    renderWithProviders(<App quoteApi={api} />)
    const user = await create(66)
    await user.click(screen.getByRole('radio', { name: 'PREMIUM' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you have pre-existing conditions?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('checkbox', { name: 'Hypertension' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you take prescription medication?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you use tobacco?' })).getByRole('radio', { name: 'No' }))
    await user.click(within(screen.getByRole('group', { name: 'Do you need spouse coverage?' })).getByRole('radio', { name: 'Yes' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })

    await user.click(screen.getByRole('button', { name: 'Back to Coverage' }))
    await user.click(screen.getByRole('button', { name: 'Back to personal information' }))
    const age = screen.getByLabelText(/^Age/)
    await user.clear(age)
    await user.type(age, '65')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { level: 2, name: 'Coverage' })

    expect(screen.queryByText('Do you have pre-existing conditions?')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'STANDARD' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
    await screen.findByRole('heading', { level: 2, name: 'Review and Submit' })

    expect(creates).toBe(2)
    expect(createBodies[1]).toEqual({
      name: 'Coverage Tester',
      email: 'coverage@example.invalid',
      age: 65,
      zipCode: '00123',
    })
    expect(patchIds).toEqual([olderDraftQuote.id, draftQuote.id])
    expect(patchBodies[1]).toEqual({ coverageType: 'STANDARD' })
  })
})
