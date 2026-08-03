import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../../shared/test/render'
import { QuoteProgress } from './QuoteProgress'

describe('QuoteProgress', () => {
  it('renders exactly three non-clickable steps and identifies Personal Information initially', () => {
    renderWithProviders(<QuoteProgress currentStep="personal" />)
    expect(screen.getByText('Personal Information')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Coverage')).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Review and Submit')).not.toHaveAttribute('aria-current')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('progressbar', {
      name: 'Quote progress: step 1 of 3, Personal Information',
    })).toHaveAttribute('aria-valuenow', '33.33333333333333')
    expect(screen.getByRole('status')).toHaveTextContent('Current step: Personal Information')
    expect(screen.getByRole('status')).toHaveStyle({ width: '1px', height: '1px' })
  })

  it('marks Coverage current after quote creation', () => {
    renderWithProviders(<QuoteProgress currentStep="coverage" />)
    expect(screen.getByText('Coverage')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('status')).toHaveTextContent('Current step: Coverage')
  })
})
