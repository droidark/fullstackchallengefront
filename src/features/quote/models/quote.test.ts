import { describe, expect, it } from 'vitest'
import { coveredQuote, draftQuote, olderCoveredQuote } from '../../../shared/test/fixtures'
import { hasCompleteAcceptedCoverage, parseQuoteCollection, parseQuoteResponse } from './quote'

describe('quote response parser', () => {
  it('accepts the observed draft response with nullable coverage fields', () => {
    expect(parseQuoteResponse(draftQuote)).toEqual(draftQuote)
  })

  it('accepts the observed covered response with a numeric premium', () => {
    const covered = { ...draftQuote, coverageType: 'STANDARD', monthlyPremium: 100 }
    expect(parseQuoteResponse(covered)).toEqual(covered)
  })

  it.each([
    ['invalid status', { ...draftQuote, status: 'UNKNOWN' }],
    ['invalid coverage enum', { ...draftQuote, coverageType: 'ULTIMATE' }],
    ['missing ID', { ...draftQuote, id: undefined }],
    ['invalid ID', { ...draftQuote, id: 'not-a-uuid' }],
    ['invalid condition enum', { ...draftQuote, conditions: ['UNKNOWN'] }],
  ])('rejects %s', (_label, response) => {
    expect(parseQuoteResponse(response)).toBeNull()
  })

  it('requires a bare array for a collection', () => {
    expect(parseQuoteCollection({ content: [draftQuote] })).toBeNull()
    expect(parseQuoteCollection([draftQuote])).toEqual([draftQuote])
  })

  it('requires complete server-accepted supplemental answers for quotes over age 65', () => {
    expect(hasCompleteAcceptedCoverage(coveredQuote)).toBe(true)
    expect(hasCompleteAcceptedCoverage(olderCoveredQuote)).toBe(true)
    expect(hasCompleteAcceptedCoverage({ ...olderCoveredQuote, usesTobacco: null })).toBe(false)
    expect(hasCompleteAcceptedCoverage({ ...olderCoveredQuote, conditions: [] })).toBe(false)
    expect(hasCompleteAcceptedCoverage({
      ...olderCoveredQuote,
      hasPreexistingConditions: false,
      conditions: ['HYPERTENSION'],
    })).toBe(false)
  })
})
