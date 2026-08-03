import { formatMonthlyPremium } from '../models/coverage'
import type { CoverageType, HealthCondition, QuoteStatus } from '../models/quote'

const coverageLabels = {
  BASIC: 'Basic',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
} satisfies Record<CoverageType, string>

const conditionLabels = {
  DIABETES: 'Diabetes',
  HEART_DISEASE: 'Heart disease',
  HYPERTENSION: 'Hypertension',
  CANCER_HISTORY: 'Cancer history',
  OTHER: 'Other',
} satisfies Record<HealthCondition, string>

const statusLabels = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  SUBMISSION_FAILED: 'Submission failed',
  EXPIRED: 'Expired',
} satisfies Record<QuoteStatus, string>

export function formatBooleanAnswer(value: boolean | null | undefined): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Not available'
}

export function formatCoverageType(value: CoverageType | null): string {
  return value === null ? 'Not available' : coverageLabels[value]
}

export function formatHealthCondition(value: HealthCondition): string {
  return conditionLabels[value]
}

export function formatHealthConditions(values: readonly HealthCondition[]): string {
  return values.length === 0 ? 'None' : values.map(formatHealthCondition).join(', ')
}

export function formatQuoteStatus(value: QuoteStatus): string {
  return statusLabels[value]
}

export function formatPremium(value: number | null): string {
  return value === null ? 'Not available' : formatMonthlyPremium(value)
}
