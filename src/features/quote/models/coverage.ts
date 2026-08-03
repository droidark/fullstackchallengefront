import type { CoverageType, HealthCondition, QuoteResponse, UpdateCoverageRequest } from './quote'

export interface CoverageFormValues {
  coverageType: CoverageType | ''
  hasPreexistingConditions?: boolean | undefined
  conditions: HealthCondition[]
  takesPrescriptionMedication?: boolean | undefined
  usesTobacco?: boolean | undefined
  needsSpouseCoverage?: boolean | undefined
}

export function coverageDefaults(quote: QuoteResponse): CoverageFormValues {
  if (quote.age <= 65) {
    return {
      coverageType: quote.coverageType ?? '',
      hasPreexistingConditions: undefined,
      conditions: [],
      takesPrescriptionMedication: undefined,
      usesTobacco: undefined,
      needsSpouseCoverage: undefined,
    }
  }
  return {
    coverageType: quote.coverageType ?? '',
    hasPreexistingConditions: quote.hasPreexistingConditions ?? undefined,
    conditions: quote.hasPreexistingConditions === true ? [...quote.conditions] : [],
    takesPrescriptionMedication: quote.takesPrescriptionMedication ?? undefined,
    usesTobacco: quote.usesTobacco ?? undefined,
    needsSpouseCoverage: quote.needsSpouseCoverage ?? undefined,
  }
}

export function toUpdateCoverageRequest(
  quoteAge: number,
  values: CoverageFormValues,
): UpdateCoverageRequest {
  if (values.coverageType === '') throw new Error('Coverage type is required.')
  if (quoteAge <= 65) return { coverageType: values.coverageType }
  const hasPreexistingConditions = values.hasPreexistingConditions
  const takesPrescriptionMedication = values.takesPrescriptionMedication
  const usesTobacco = values.usesTobacco
  const needsSpouseCoverage = values.needsSpouseCoverage
  if (hasPreexistingConditions === undefined || takesPrescriptionMedication === undefined ||
    usesTobacco === undefined || needsSpouseCoverage === undefined) {
    throw new Error('All coverage questions are required.')
  }
  return {
    coverageType: values.coverageType,
    hasPreexistingConditions,
    conditions: hasPreexistingConditions ? [...new Set(values.conditions)] : [],
    takesPrescriptionMedication,
    usesTobacco,
    needsSpouseCoverage,
  }
}

export function formatMonthlyPremium(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Monthly premium must be a finite number.')
  return value.toFixed(2)
}
