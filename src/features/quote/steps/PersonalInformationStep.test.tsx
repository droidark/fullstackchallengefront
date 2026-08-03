import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '../../../app/App'
import { createQuoteApi } from '../api/quoteApi'
import { draftQuote } from '../../../shared/test/fixtures'
import { testApiBaseUrl, testApiKey } from '../../../shared/test/handlers'
import { renderWithProviders } from '../../../shared/test/render'
import { server } from '../../../shared/test/server'

const api = createQuoteApi({ apiBaseUrl: testApiBaseUrl, apiKey: testApiKey })

async function fillValidForm() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^Full name/), 'Ada Lovelace')
  await user.type(screen.getByLabelText(/^Email/), 'ada@example.invalid')
  await user.type(screen.getByLabelText(/^Age/), '65')
  await user.type(screen.getByLabelText(/^ZIP code/), '00123')
  return user
}

describe('PersonalInformationStep', () => {
  it('renders labelled fields and client validation messages', async () => {
    renderWithProviders(<App quoteApi={api} />)
    const heading = screen.getByRole('heading', { level: 2, name: 'Personal Information' })
    expect(heading).toBeVisible()
    expect(heading).not.toHaveFocus()
    expect(screen.getByLabelText(/^Full name/)).toBeVisible()
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText(/^Age/)).toHaveAttribute('type', 'number')
    expect(screen.getByLabelText(/^ZIP code/)).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Full name is required.')).toBeVisible()
    expect(screen.getByText('Email is required.')).toBeVisible()
    expect(screen.getByText('Age is required.')).toBeVisible()
    expect(screen.getByText('ZIP code is required.')).toBeVisible()
    expect(screen.getByLabelText(/^Full name/)).toHaveFocus()
  })

  it('keeps keyboard tab order aligned with the visible Personal Information form', async () => {
    renderWithProviders(<App quoteApi={api} />)
    const user = userEvent.setup()

    await user.tab()
    expect(screen.getByLabelText(/^Full name/)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^Email/)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^Age/)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^ZIP code/)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus()
  })

  it('preserves leading-zero ZIP input and disables Continue while loading', async () => {
    let releaseResponse: () => void = () => { throw new Error('Response gate was not initialized.') }
    const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve })
    server.use(http.post(`${testApiBaseUrl}/quotes`, async () => {
      await responseGate
      return HttpResponse.json(draftQuote, { status: 201 })
    }))
    renderWithProviders(<App quoteApi={api} />)
    const user = await fillValidForm()
    expect(screen.getByLabelText(/^ZIP code/)).toHaveValue('00123')

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('button', { name: 'Creating quote…' })).toBeDisabled()
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true')
    releaseResponse()
    expect(await screen.findByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
  })

  it('maps a backend field error and retains typed values', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.json({
      timestamp: '2026-08-02T12:00:00Z',
      status: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      path: '/quotes',
      fieldErrors: [{ field: 'email', message: 'Email is already in use' }],
    }, { status: 400 })))
    renderWithProviders(<App quoteApi={api} />)
    const user = await fillValidForm()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Email is already in use')).toBeVisible()
    expect(screen.getByLabelText(/^Email/)).toHaveValue('ada@example.invalid')
    expect(screen.getByLabelText(/^Email/)).toHaveFocus()
    await user.type(screen.getByLabelText(/^Email/), 'x')
    expect(screen.queryByText('Email is already in use')).not.toBeInTheDocument()
  })

  it('prevents rapid duplicate form activation', async () => {
    let requests = 0
    server.use(http.post(`${testApiBaseUrl}/quotes`, async () => {
      requests += 1
      await delay(80)
      return HttpResponse.json(draftQuote, { status: 201 })
    }))
    renderWithProviders(<App quoteApi={api} />)
    await fillValidForm()
    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(await screen.findByRole('heading', { level: 2, name: 'Coverage' })).toBeVisible()
    expect(requests).toBe(1)
  })

  it('submits a valid form once with Enter and focuses Coverage after the transition', async () => {
    let requests = 0
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => {
      requests += 1
      return HttpResponse.json(draftQuote, { status: 201 })
    }))
    renderWithProviders(<App quoteApi={api} />)
    const user = await fillValidForm()

    await user.keyboard('{Enter}')

    const heading = await screen.findByRole('heading', { level: 2, name: 'Coverage' })
    expect(heading).toHaveFocus()
    expect(requests).toBe(1)
  })

  it('focuses a global API error and returns focus to the heading when dismissed', async () => {
    server.use(http.post(`${testApiBaseUrl}/quotes`, () => HttpResponse.error()))
    renderWithProviders(<App quoteApi={api} />)
    const user = await fillValidForm()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Personal Information' })).toHaveFocus()
  })
})
