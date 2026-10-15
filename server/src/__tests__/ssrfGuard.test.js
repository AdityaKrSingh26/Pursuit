import { vi, describe, it, expect } from 'vitest'
import { assertSafeUrl, SsrfError } from '../lib/ssrfGuard.js'

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(async (hostname) => {
      if (hostname === '127.0.0.1' || hostname === 'localhost') return { address: '127.0.0.1' }
      if (hostname === '10.0.0.1') return { address: '10.0.0.1' }
      if (hostname === '192.168.1.1') return { address: '192.168.1.1' }
      if (hostname === '0.0.0.0' || hostname === '0.1.2.3') return { address: hostname }
      if (hostname === '169.254.169.254') return { address: '169.254.169.254' }
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

  it('throws SsrfError for this-network 0.0.0.0/8 and link-local metadata', async () => {
    await expect(assertSafeUrl('http://0.0.0.0/')).rejects.toThrow(SsrfError)
    await expect(assertSafeUrl('http://0.1.2.3/')).rejects.toThrow(SsrfError)
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SsrfError)
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
