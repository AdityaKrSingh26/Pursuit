import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(async () => ({ address: '8.8.8.8' })),
  },
}))

vi.mock('axios')

import { fetchAndExtract } from '../jobs/ingestion/fetcher.js'

describe('fetchAndExtract SSRF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not follow redirects, so a 302 to loopback never yields the target body', async () => {
    axios.get.mockImplementation(async (_url, config) => {
      if (config?.maxRedirects === 0) {
        const err = new Error('Maximum number of redirects exceeded')
        err.response = {
          status: 302,
          headers: { location: 'http://127.0.0.1/latest/meta-data' },
        }
        throw err
      }
      return { data: 'INSTANCE_IDENTITY_DOCUMENT', status: 200 }
    })

    await expect(fetchAndExtract('https://example.com/jobs/1')).rejects.toThrow()
    expect(axios.get).toHaveBeenCalled()
    const [, config] = axios.get.mock.calls[0]
    expect(config.maxRedirects).toBe(0)
  })
})
