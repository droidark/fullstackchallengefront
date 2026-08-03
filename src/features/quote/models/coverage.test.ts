import { describe, expect, it } from 'vitest'
import { draftQuote } from '../../../shared/test/fixtures'
import { coverageDefaults, formatMonthlyPremium, toUpdateCoverageRequest } from './coverage'

const over65Values = {
  coverageType: 'PREMIUM' as const,
  hasPreexistingConditions: true,
  conditions: ['HYPERTENSION', 'HYPERTENSION'] as const,
  takesPrescriptionMedication: false,
  usesTobacco: false,
  needsSpouseCoverage: true,
}

describe('coverage boundary helpers', () => {
  it('creates fresh defaults and never restores supplemental data for age 65', () => {
    expect(coverageDefaults({ ...draftQuote, hasPreexistingConditions: true, conditions: ['DIABETES'] })).toEqual({
      coverageType: '', hasPreexistingConditions: undefined, conditions: [],
      takesPrescriptionMedication: undefined, usesTobacco: undefined, needsSpouseCoverage: undefined,
    })
  })

  it('restores accepted age-66 server values', () => {
    const quote = { ...draftQuote, age: 66, coverageType: 'PREMIUM' as const, monthlyPremium: 125.5,
      hasPreexistingConditions: true, conditions: ['HYPERTENSION'] as ('HYPERTENSION')[],
      takesPrescriptionMedication: false, usesTobacco: false, needsSpouseCoverage: true }
    expect(coverageDefaults(quote)).toMatchObject({ ...over65Values, conditions: ['HYPERTENSION'] })
  })

  it('maps age 65 to exactly one request key', () => {
    const request = toUpdateCoverageRequest(65, { ...over65Values, conditions: ['HYPERTENSION'] })
    expect(request).toEqual({ coverageType: 'PREMIUM' })
    expect(Object.keys(request)).toEqual(['coverageType'])
  })

  it('maps all age-66 answers, preserves false, and deduplicates or clears conditions', () => {
    expect(toUpdateCoverageRequest(66, { ...over65Values, conditions: [...over65Values.conditions] })).toEqual({
      coverageType: 'PREMIUM', hasPreexistingConditions: true, conditions: ['HYPERTENSION'],
      takesPrescriptionMedication: false, usesTobacco: false, needsSpouseCoverage: true,
    })
    expect(toUpdateCoverageRequest(66, { ...over65Values, hasPreexistingConditions: false, conditions: ['DIABETES'] })).toMatchObject({ conditions: [] })
  })

  it('formats only a supplied finite server value to two decimals', () => {
    expect(formatMonthlyPremium(100)).toBe('100.00')
    expect(formatMonthlyPremium(12.345)).toBe('12.35')
    expect(formatMonthlyPremium(0)).toBe('0.00')
    expect(() => formatMonthlyPremium(Number.NaN)).toThrow()
  })
})
