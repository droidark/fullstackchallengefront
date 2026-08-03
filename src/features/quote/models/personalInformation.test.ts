import { describe, expect, it } from 'vitest'
import {
  normalizePersonalInformation,
  personalInformationEquals,
  toCreateQuoteRequest,
} from './personalInformation'

describe('personal information utilities', () => {
  const values = {
    name: '  Ada Lovelace  ',
    email: '  Ada@example.invalid  ',
    age: 0,
    zipCode: '  00123  ',
  }

  it('trims name, email, and ZIP while retaining numeric age and leading zeroes', () => {
    expect(normalizePersonalInformation(values)).toEqual({
      name: 'Ada Lovelace',
      email: 'Ada@example.invalid',
      age: 0,
      zipCode: '00123',
    })
  })

  it('maps normalized values to the distinct API request model', () => {
    const normalized = normalizePersonalInformation(values)
    expect(toCreateQuoteRequest(normalized)).toEqual(normalized)
    expect(typeof toCreateQuoteRequest(normalized).zipCode).toBe('string')
  })

  it('compares every normalized field explicitly', () => {
    const normalized = normalizePersonalInformation(values)
    expect(personalInformationEquals(normalized, { ...normalized })).toBe(true)
    expect(personalInformationEquals(normalized, { ...normalized, name: 'Grace Hopper' })).toBe(false)
    expect(personalInformationEquals(normalized, { ...normalized, email: 'other@example.invalid' })).toBe(false)
    expect(personalInformationEquals(normalized, { ...normalized, age: 1 })).toBe(false)
    expect(personalInformationEquals(normalized, { ...normalized, zipCode: '00124' })).toBe(false)
  })
})
