import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../shared/test/render'
import { App } from './App'

describe('App shell', () => {
  it('renders the themed quote flow without calling the API initially', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderWithProviders(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Insurance quote' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible()
    expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument()
    expect(document.querySelector('style[data-emotion]')).not.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
