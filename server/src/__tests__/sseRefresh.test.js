import { describe, expect, it, vi } from 'vitest'
import { fetchWith401Refresh } from '../../../client/src/lib/sseRefresh.ts'

vi.mock('../../../client/src/lib/api.ts', () => ({
  tryRefresh: vi.fn(),
}))

import { tryRefresh } from '../../../client/src/lib/api.ts'

describe('fetchWith401Refresh', () => {
  it('returns the first response when it is not 401', async () => {
    const ok = { status: 200 }
    const doFetch = vi.fn().mockResolvedValue(ok)
    const onLoggedOut = vi.fn()
    await expect(fetchWith401Refresh(doFetch, onLoggedOut)).resolves.toBe(ok)
    expect(doFetch).toHaveBeenCalledOnce()
    expect(tryRefresh).not.toHaveBeenCalled()
    expect(onLoggedOut).not.toHaveBeenCalled()
  })

  it('retries once after a successful refresh', async () => {
    tryRefresh.mockResolvedValue(true)
    const unauthorized = { status: 401 }
    const ok = { status: 200 }
    const doFetch = vi.fn()
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(ok)
    const onLoggedOut = vi.fn()
    await expect(fetchWith401Refresh(doFetch, onLoggedOut)).resolves.toBe(ok)
    expect(doFetch).toHaveBeenCalledTimes(2)
    expect(onLoggedOut).not.toHaveBeenCalled()
  })

  it('logs out when refresh fails', async () => {
    tryRefresh.mockResolvedValue(false)
    const unauthorized = { status: 401 }
    const doFetch = vi.fn().mockResolvedValue(unauthorized)
    const onLoggedOut = vi.fn()
    await expect(fetchWith401Refresh(doFetch, onLoggedOut)).resolves.toBe(unauthorized)
    expect(doFetch).toHaveBeenCalledOnce()
    expect(onLoggedOut).toHaveBeenCalledOnce()
  })
})
