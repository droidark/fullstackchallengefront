import { describe, expect, it } from 'vitest'

describe('MSW policy', () => {
  it('fails an unhandled request instead of reaching a network service', async () => {
    await expect(fetch('http://api.test/intentionally-unhandled')).rejects.toThrow()
  })
})
