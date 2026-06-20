import { vi, describe, it, expect } from 'vitest'
import { assertSafeUrl, SsrfError } from '../lib/ssrfGuard.js'

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(async (hostname) => {
      if (hostname === '127.0.0.1' || hostname === 'localhost') return { address: '127.0.0.1' }
      if (hostname === '10.0.0.1') return { address: '10.0.0.1' }
      if (hostname === '192.168.1.1') return { address: '192.168.1.1' }
      if (hostname === 'example.com') return { address: '8.8.8.8' }
      throw new Error('ENOTFOUND')
    }),
  },
}))

describe('SSRF Guard Unit Tests', () => {
  it('throws SsrfError for loopback addresses', async () => {
    await expect(assertSafeUrl('http://127.0.0.1/anything')).rejects.toThrow(SsrfError)
    await expect(assertSafeUrl('http://localhost/anything')).rejects.toThrow(SsrfError)
  })

  it('throws SsrfError for private CIDR range addresses', async () => {
    await expect(assertSafeUrl('http://10.0.0.1/anything')).rejects.toThrow(SsrfError)
    await expect(assertSafeUrl('http://192.168.1.1/anything')).rejects.toThrow(SsrfError)
  })

  it('throws SsrfError for unsupported protocols', async () => {
    await expect(assertSafeUrl('ftp://example.com')).rejects.toThrow(SsrfError)
    await expect(assertSafeUrl('gopher://example.com')).rejects.toThrow(SsrfError)
  })

  it('throws SsrfError for invalid URLs', async () => {
    await expect(assertSafeUrl('not-a-url')).rejects.toThrow(SsrfError)
  })

  it('resolves successfully for valid public hostname URLs', async () => {
    await expect(assertSafeUrl('https://example.com/jobs')).resolves.not.toThrow()
  })
})
