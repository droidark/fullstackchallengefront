import { describe, expect, it } from 'vitest'
import {
  formatBooleanAnswer,
  formatCoverageType,
  formatHealthCondition,
  formatHealthConditions,
  formatPremium,
  formatQuoteStatus,
} from './quotePresentation'

describe('quote presentation', () => {
  it('formats API enums without changing their stored values', () => {
    expect(formatCoverageType('BASIC')).toBe('Basic')
    expect(formatCoverageType('STANDARD')).toBe('Standard')
    expect(formatCoverageType('PREMIUM')).toBe('Premium')
    expect(formatHealthCondition('HEART_DISEASE')).toBe('Heart disease')
    expect(formatHealthCondition('CANCER_HISTORY')).toBe('Cancer history')
    expect(formatQuoteStatus('DRAFT')).toBe('Draft')
    expect(formatQuoteStatus('SUBMISSION_FAILED')).toBe('Submission failed')
  })

  it('formats booleans, conditions, and absent values safely', () => {
    expect(formatBooleanAnswer(true)).toBe('Yes')
    expect(formatBooleanAnswer(false)).toBe('No')
    expect(formatBooleanAnswer(null)).toBe('Not available')
    expect(formatHealthConditions(['DIABETES', 'OTHER'])).toBe('Diabetes, Other')
    expect(formatHealthConditions([])).toBe('None')
    expect(formatCoverageType(null)).toBe('Not available')
  })

  it('delegates server premium display to the existing two-decimal formatter', () => {
    expect(formatPremium(175.2)).toBe('175.20')
    expect(formatPremium(null)).toBe('Not available')
  })
})
