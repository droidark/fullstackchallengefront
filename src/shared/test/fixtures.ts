import type { QuoteResponse } from '../../features/quote/models/quote'

export const draftQuote: QuoteResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Frontend Test',
  email: 'frontend.test@example.invalid',
  age: 65,
  zipCode: '10001',
  coverageType: null,
  hasPreexistingConditions: null,
  conditions: [],
  takesPrescriptionMedication: null,
  usesTobacco: null,
  needsSpouseCoverage: null,
  monthlyPremium: null,
  status: 'DRAFT',
  createdAt: '2026-08-02T12:00:00Z',
  modifiedAt: '2026-08-02T12:00:00Z',
}

export const coveredQuote: QuoteResponse = {
  ...draftQuote,
  coverageType: 'STANDARD',
  monthlyPremium: 100,
  modifiedAt: '2026-08-02T12:05:00Z',
}

export const olderDraftQuote: QuoteResponse = {
  ...draftQuote,
  id: '66666666-6666-4666-8666-666666666666',
  age: 66,
}

export const olderCoveredQuote: QuoteResponse = {
  ...olderDraftQuote,
  coverageType: 'PREMIUM',
  hasPreexistingConditions: true,
  conditions: ['HYPERTENSION'],
  takesPrescriptionMedication: true,
  usesTobacco: false,
  needsSpouseCoverage: true,
  monthlyPremium: 175.25,
  modifiedAt: '2026-08-02T12:05:00Z',
}

export const submittedQuote: QuoteResponse = {
  ...coveredQuote,
  status: 'SUBMITTED',
  modifiedAt: '2026-08-02T12:10:00Z',
}

export const submissionFailedQuote: QuoteResponse = {
  ...coveredQuote,
  status: 'SUBMISSION_FAILED',
  modifiedAt: '2026-08-02T12:10:00Z',
}

export const expiredQuote: QuoteResponse = {
  ...coveredQuote,
  status: 'EXPIRED',
  modifiedAt: '2026-08-02T12:10:00Z',
}
