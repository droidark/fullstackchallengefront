import { describe, expect, it } from 'vitest'
import { createCoverageSchema } from './coverageSchema'

const valid66 = {
  coverageType: 'PREMIUM', hasPreexistingConditions: true, conditions: ['DIABETES'],
  takesPrescriptionMedication: false, usesTobacco: false, needsSpouseCoverage: true,
}

describe('coverageSchema', () => {
  it('requires only valid coverage at the exact age-65 threshold', async () => {
    await expect(createCoverageSchema(65).validate({ coverageType: 'STANDARD', conditions: [] })).resolves.toMatchObject({ coverageType: 'STANDARD' })
    await expect(createCoverageSchema(65).validate({ coverageType: '', conditions: [] })).rejects.toThrow('valid coverage')
    await expect(createCoverageSchema(65).validate({ coverageType: 'GOLD', conditions: [] })).rejects.toThrow('valid coverage')
  })

  it('requires every explicit answer only over age 65', async () => {
    await expect(createCoverageSchema(66).validate({ coverageType: 'BASIC', conditions: [] })).rejects.toThrow('Select Yes or No')
    await expect(createCoverageSchema(66).validate(valid66)).resolves.toMatchObject({ usesTobacco: false })
  })

  it('requires a valid condition only when pre-existing is true', async () => {
    await expect(createCoverageSchema(66).validate({ ...valid66, conditions: [] })).rejects.toThrow('at least one')
    await expect(createCoverageSchema(66).validate({ ...valid66, hasPreexistingConditions: false, conditions: [] })).resolves.toBeDefined()
    await expect(createCoverageSchema(66).validate({ ...valid66, conditions: ['INVALID'] })).rejects.toThrow()
  })
})
