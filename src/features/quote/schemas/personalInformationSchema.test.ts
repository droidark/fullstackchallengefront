import { describe, expect, it } from 'vitest'
import { personalInformationSchema } from './personalInformationSchema'

const validValues = {
  name: 'Ada Lovelace',
  email: 'ada@example.invalid',
  age: 0,
  zipCode: '00123',
}

describe('personalInformationSchema', () => {
  it('accepts valid values, including age zero without an invented minimum', async () => {
    await expect(personalInformationSchema.validate(validValues)).resolves.toEqual(validValues)
  })

  it.each([
    ['empty name', { ...validValues, name: '' }, 'Full name is required.'],
    ['whitespace name', { ...validValues, name: '   ' }, 'Full name is required.'],
    ['invalid email', { ...validValues, email: 'invalid' }, 'Enter a valid email address.'],
    ['empty age', { ...validValues, age: '' }, 'Age is required.'],
    ['non-numeric age', { ...validValues, age: 'abc' }, 'Age must be a number.'],
    ['decimal age', { ...validValues, age: 4.5 }, 'Age must be a whole number.'],
    ['empty ZIP', { ...validValues, zipCode: '' }, 'ZIP code is required.'],
    ['whitespace ZIP', { ...validValues, zipCode: '   ' }, 'ZIP code is required.'],
  ])('rejects %s', async (_label, values, message) => {
    await expect(personalInformationSchema.validate(values)).rejects.toThrow(message)
  })

  it('keeps ZIP as a string and preserves leading zeroes', async () => {
    const result = await personalInformationSchema.validate(validValues)
    expect(result.zipCode).toBe('00123')
    expect(typeof result.zipCode).toBe('string')
  })
})
