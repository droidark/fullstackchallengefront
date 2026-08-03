export const QUOTE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'SUBMISSION_FAILED',
  'EXPIRED',
] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export const COVERAGE_TYPES = ['BASIC', 'STANDARD', 'PREMIUM'] as const
export type CoverageType = (typeof COVERAGE_TYPES)[number]

export const HEALTH_CONDITIONS = [
  'DIABETES',
  'HEART_DISEASE',
  'HYPERTENSION',
  'CANCER_HISTORY',
  'OTHER',
] as const
export type HealthCondition = (typeof HEALTH_CONDITIONS)[number]

export type CreateQuoteRequest = Readonly<{
  name: string
  email: string
  age: number
  zipCode: string
}>

export type UpdateCoverageRequest = Readonly<{
  coverageType: CoverageType
  hasPreexistingConditions?: boolean
  conditions?: HealthCondition[]
  takesPrescriptionMedication?: boolean
  usesTobacco?: boolean
  needsSpouseCoverage?: boolean
}>

export type QuoteResponse = Readonly<{
  id: string
  name: string
  email: string
  age: number
  zipCode: string
  coverageType: CoverageType | null
  hasPreexistingConditions: boolean | null
  conditions: HealthCondition[]
  takesPrescriptionMedication: boolean | null
  usesTobacco: boolean | null
  needsSpouseCoverage: boolean | null
  monthlyPremium: number | null
  status: QuoteStatus
  createdAt: string
  modifiedAt: string
}>

export function hasCompleteAcceptedCoverage(quote: QuoteResponse): boolean {
  if (quote.coverageType === null || quote.monthlyPremium === null) return false
  if (quote.age <= 65) return true

  if (
    quote.hasPreexistingConditions === null ||
    quote.takesPrescriptionMedication === null ||
    quote.usesTobacco === null ||
    quote.needsSpouseCoverage === null
  ) return false

  return quote.hasPreexistingConditions
    ? quote.conditions.length > 0
    : quote.conditions.length === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some((item) => item === value)
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean'
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
}

export function parseQuoteResponse(value: unknown): QuoteResponse | null {
  if (!isRecord(value)) return null

  const conditions = value.conditions
  if (
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.age !== 'number' || !Number.isInteger(value.age) ||
    typeof value.zipCode !== 'string' ||
    !(value.coverageType === null || isOneOf(value.coverageType, COVERAGE_TYPES)) ||
    !isNullableBoolean(value.hasPreexistingConditions) ||
    !Array.isArray(conditions) || !conditions.every((condition) => isOneOf(condition, HEALTH_CONDITIONS)) ||
    !isNullableBoolean(value.takesPrescriptionMedication) ||
    !isNullableBoolean(value.usesTobacco) ||
    !isNullableBoolean(value.needsSpouseCoverage) ||
    !(value.monthlyPremium === null || typeof value.monthlyPremium === 'number' && Number.isFinite(value.monthlyPremium)) ||
    !isOneOf(value.status, QUOTE_STATUSES) ||
    !isIsoDate(value.createdAt) ||
    !isIsoDate(value.modifiedAt)
  ) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    age: value.age,
    zipCode: value.zipCode,
    coverageType: value.coverageType,
    hasPreexistingConditions: value.hasPreexistingConditions,
    conditions,
    takesPrescriptionMedication: value.takesPrescriptionMedication,
    usesTobacco: value.usesTobacco,
    needsSpouseCoverage: value.needsSpouseCoverage,
    monthlyPremium: value.monthlyPremium,
    status: value.status,
    createdAt: value.createdAt,
    modifiedAt: value.modifiedAt,
  }
}

export function parseQuoteCollection(value: unknown): QuoteResponse[] | null {
  if (!Array.isArray(value)) return null
  const parsed = value.map(parseQuoteResponse)
  return parsed.every((quote): quote is QuoteResponse => quote !== null) ? parsed : null
}
