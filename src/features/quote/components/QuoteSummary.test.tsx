import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { coveredQuote, olderCoveredQuote } from '../../../shared/test/fixtures'
import { renderWithProviders } from '../../../shared/test/render'
import { QuoteSummary } from './QuoteSummary'

describe('QuoteSummary', () => {
  it('renders the accepted personal and coverage data as a read-only summary', () => {
    renderWithProviders(<QuoteSummary quote={{
      ...coveredQuote,
      email: 'a-very-long-address-for-responsive-wrapping@example.invalid',
    }} />)

    expect(screen.getByRole('heading', { name: 'Personal Information' })).toBeVisible()
    expect(screen.getByText(coveredQuote.name)).toBeVisible()
    expect(screen.getByText('a-very-long-address-for-responsive-wrapping@example.invalid')).toBeVisible()
    expect(screen.getByText(coveredQuote.zipCode)).toBeVisible()

    const coverage = screen.getByRole('heading', { name: 'Coverage' }).closest('section')
    expect(coverage).not.toBeNull()
    if (coverage === null) throw new Error('Coverage summary section was not rendered.')
    const coverageQueries = within(coverage)
    expect(coverageQueries.getByText('Standard')).toBeVisible()
    expect(coverageQueries.getByText('100.00')).toBeVisible()
    expect(coverageQueries.getByText('Draft')).toBeVisible()

    expect(screen.queryByRole('heading', { name: 'Supplemental Answers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders every applicable answer and readable condition labels over age 65', () => {
    renderWithProviders(<QuoteSummary quote={{
      ...olderCoveredQuote,
      conditions: ['HEART_DISEASE', 'CANCER_HISTORY'],
    }} />)

    const supplemental = screen.getByRole('heading', { name: 'Supplemental Answers' }).closest('section')
    expect(supplemental).not.toBeNull()
    if (supplemental === null) throw new Error('Supplemental summary section was not rendered.')
    const supplementalQueries = within(supplemental)

    expect(supplementalQueries.getByText('Pre-existing conditions')).toBeVisible()
    expect(supplementalQueries.getAllByText('Yes')).toHaveLength(3)
    expect(supplementalQueries.getByText('No')).toBeVisible()
    expect(supplementalQueries.getByText('Heart disease, Cancer history')).toBeVisible()
    expect(supplementalQueries.queryByText('HEART_DISEASE')).not.toBeInTheDocument()
    expect(supplementalQueries.queryByText('CANCER_HISTORY')).not.toBeInTheDocument()
  })
})
