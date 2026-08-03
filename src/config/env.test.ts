import { describe, expect, it } from 'vitest'
import { parseEnvironment } from './env'

describe('parseEnvironment', () => {
  it('accepts valid configuration and normalizes one trailing slash', () => {
    expect(parseEnvironment({
      VITE_API_BASE_URL: ' http://localhost:8080/ ',
      VITE_API_KEY: ' local-test-key ',
    })).toEqual({ apiBaseUrl: 'http://localhost:8080', apiKey: 'local-test-key' })
  })

  it.each([
    [{ VITE_API_KEY: 'key' }, 'VITE_API_BASE_URL is required.'],
    [{ VITE_API_BASE_URL: 'not a url', VITE_API_KEY: 'key' }, 'valid HTTP or HTTPS URL'],
    [{ VITE_API_BASE_URL: 'file:///tmp/api', VITE_API_KEY: 'key' }, 'must use HTTP or HTTPS'],
    [{ VITE_API_BASE_URL: 'http://api.test' }, 'VITE_API_KEY is required'],
    [{ VITE_API_BASE_URL: 'http://api.test', VITE_API_KEY: '   ' }, 'VITE_API_KEY is required'],
  ])('rejects invalid configuration', (input, message) => {
    expect(() => parseEnvironment(input)).toThrow(message)
  })

  it('never places a supplied key in a validation message', () => {
    const sensitiveValue = 'must-not-appear'
    try {
      parseEnvironment({ VITE_API_BASE_URL: 'invalid', VITE_API_KEY: sensitiveValue })
      throw new Error('Expected invalid environment configuration to fail.')
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error)
      if (error instanceof Error) expect(error.message).not.toContain(sensitiveValue)
    }
  })
})
