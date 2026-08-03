import * as yup from 'yup'
import { COVERAGE_TYPES, HEALTH_CONDITIONS } from '../models/quote'
import type { CoverageFormValues } from '../models/coverage'

const requiredAnswer = () => yup.boolean().required('Select Yes or No.')

export function createCoverageSchema(quoteAge: number): yup.ObjectSchema<CoverageFormValues> {
  return yup.object({
    coverageType: yup.mixed<CoverageFormValues['coverageType']>().oneOf([...COVERAGE_TYPES], 'Select a valid coverage type.').required('Select a coverage type.'),
    hasPreexistingConditions: quoteAge > 65 ? requiredAnswer() : yup.boolean().optional(),
    conditions: yup.array().of(yup.mixed<(typeof HEALTH_CONDITIONS)[number]>().oneOf([...HEALTH_CONDITIONS]).required()).defined().default([])
      .when('hasPreexistingConditions', {
        is: true,
        then: (schema) => schema.min(1, 'Select at least one condition.'),
      }),
    takesPrescriptionMedication: quoteAge > 65 ? requiredAnswer() : yup.boolean().optional(),
    usesTobacco: quoteAge > 65 ? requiredAnswer() : yup.boolean().optional(),
    needsSpouseCoverage: quoteAge > 65 ? requiredAnswer() : yup.boolean().optional(),
  })
}
