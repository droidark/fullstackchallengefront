import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '../../../app/App'
import { createQuoteApi } from '../api/quoteApi'
import { draftQuote } from '../../../shared/test/fixtures'
import { testApiBaseUrl, testApiKey } from '../../../shared/test/handlers'
import { renderWithProviders } from '../../../shared/test/render'
import { server } from '../../../shared/test/server'

const api = createQuoteApi({ apiBaseUrl: testApiBaseUrl, apiKey: testApiKey })
const values = {
  name: 'Ada Lovelace',
  email: 'ada@example.invalid',
  age: '65',
  zipCode: '00123',
}

async function fillAndContinue(overrides: Partial<typeof values> = {}) {
  const user = userEvent.setup()
  const input = { ...values, ...overrides }
  await user.type(screen.getByLabelText(/^Full name/), input.name)
  await user.type(screen.getByLabelText(/^Email/), input.email)
  await user.type(screen.getByLabelText(/^Age/), input.age)
  await user.type(screen.getByLabelText(/^ZIP code/), input.zipCode)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return user
}

async function goBack() {
  await userEvent.click(screen.getByRole('button', { name: 'Back to personal information' }))
  await screen.findByRole('heading', { level: 2, name: 'Personal Information' })
}

describe('Quote wizard create flow', () => {
  it('sends the exact normalized request once and renders the Coverage form on success', async () => {
    let body: unknown
    let requests = 0
    server.use(http.post(`${testApiBaseUrl}/quotes`, async ({ request }) => {
      requests += 1
      body = await request.json()
      return HttpResponse.json({ ...draftQuote, name: values.name, email: values.email, zipCode: values.zipCode }, { status: 201 })
    }))
    renderWithProviders(<App quoteApi={api} />)
    expect(screen.queryByRole('heading', { level: 2, name: 'Coverage' })).not.toBeInTheDocument()
    await fillAndContinue({ name: '  Ada Lovelace  ', email: '  ada@example.invalid  ', zipCode: '  00123  ' })

    expect(await screen.findByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
    expect(screen.getByRole('radiogroup', { name: 'Coverage type' })).toBeVisible()
    expect(screen.queryByText(/monthly premium/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Coverage').find((element) => element.hasAttribute('aria-current')))
      .toHaveAttribute('aria-current', 'step')
    expect(body).toEqual({ name: values.name, email: values.email, age: 65, zipCode: values.zipCode })
    expect(requests).toBe(1)
  })

  it('shows an unknown backend field error in the global alert', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json({
      timestamp: '2026-08-02T12:00:00Z', status: 400, error: 'Bad Request',
      code: 'VALIDATION_ERROR', message: 'Request validation failed', path: '/quotes',
      fieldErrors: [{ field: 'policyNumber', message: 'is required' }],
    }, { status: 400 })))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    expect(await screen.findByText('policyNumber: is required')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible()
  })

  it('renders authentication failure as a global configuration message', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json({
      timestamp: '2026-08-02T12:00:00Z', status: 401, error: 'Unauthorized',
      code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required', path: '/quotes', fieldErrors: [],
    }, { status: 401 })))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    expect(await screen.findByText('The quote service authentication is not configured correctly.')).toBeVisible()
    expect(screen.getByLabelText(/^Email/)).toHaveValue(values.email)
  })

  it('recovers from a network failure without losing values or navigating', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.error()))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    expect(await screen.findByText('Unable to reach the quote service.')).toBeVisible()
    expect(screen.getByLabelText(/^Full name/)).toHaveValue(values.name)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    expect(screen.queryByRole('heading', { level: 2, name: 'Coverage' })).not.toBeInTheDocument()
  })

  it('rejects a malformed successful response without navigating', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json({ id: 'invalid' }, { status: 201 })))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    expect(await screen.findByText('The quote service returned an unexpected response.')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: 'Coverage' })).not.toBeInTheDocument()
  })

  it('returns Back with committed values and reuses an unchanged active draft', async () => {
    let requests = 0
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => {
      requests += 1
      return HttpResponse.json(draftQuote, { status: 201 })
    }))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    await screen.findByRole('heading', { level: 2, name: 'Coverage' })
    await goBack()
    expect(screen.getByLabelText(/^ZIP code/)).toHaveValue(values.zipCode)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
    expect(requests).toBe(1)
  })

  it('creates a replacement for changed personal data and stores the new snapshot', async () => {
    let requests = 0
    server.use(http.post(`${testApiBaseUrl}/quotes`, async ({ request }) => {
      requests += 1
      const requestBody = await request.json() as { name: string }
      return HttpResponse.json({
        ...draftQuote,
        id: requests === 1 ? draftQuote.id : '22222222-2222-4222-8222-222222222222',
        name: requestBody.name,
      }, { status: 201 })
    }))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    await screen.findByRole('heading', { level: 2, name: 'Coverage' })
    await goBack()
    const name = screen.getByLabelText(/^Full name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Grace Hopper')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { level: 2, name: 'Coverage' })
    expect(requests).toBe(2)
    await goBack()
    expect(screen.getByLabelText(/^Full name/)).toHaveValue('Grace Hopper')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { level: 2, name: 'Coverage' })
    expect(requests).toBe(2)
  })

  it('preserves the prior active quote when replacement fails', async () => {
    let requests = 0
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => {
      requests += 1
      return requests === 1
        ? HttpResponse.json(draftQuote, { status: 201 })
        : HttpResponse.error()
    }))
    renderWithProviders(<App quoteApi={api} />)
    await fillAndContinue()
    await screen.findByRole('heading', { level: 2, name: 'Coverage' })
    await goBack()
    const name = screen.getByLabelText(/^Full name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Changed Name')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Unable to reach the quote service.')).toBeVisible()
    expect(name).toHaveValue('Changed Name')

    await userEvent.clear(name)
    await userEvent.type(name, values.name)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
    expect(requests).toBe(2)
  })
})
