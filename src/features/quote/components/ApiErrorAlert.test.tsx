import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../shared/test/render'
import { ApiErrorAlert } from './ApiErrorAlert'

describe('ApiErrorAlert', () => {
  it('uses a safe fallback for a blank message and exposes a contextual title', () => {
    renderWithProviders(
      <ApiErrorAlert
        error={{ kind: 'network', message: '   ' }}
        title="We could not create your quote"
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('We could not create your quote')).toBeVisible()
    expect(screen.getByText('We could not complete this request. Please try again.')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveFocus()
  })

  it('provides a named dismiss action and invokes the requested focus recovery', async () => {
    const onDismiss = vi.fn()
    const onDismissFocus = vi.fn()
    renderWithProviders(
      <ApiErrorAlert
        error={{ kind: 'network', message: 'Unable to reach the quote service.' }}
        onDismiss={onDismiss}
        onDismissFocus={onDismissFocus}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDismissFocus).toHaveBeenCalledOnce()
  })
})
