import { describe, expect, it, vi } from 'vitest'
import { rotateAcrossKeys } from '../lib/keyRotation.js'

describe('rotateAcrossKeys', () => {
  it('returns the first key that is not rate-limited', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce('ok')
    const { result, keyIndex } = await rotateAcrossKeys(['k1', 'k2'], 0, fn)
    expect(result).toBe('ok')
    expect(keyIndex).toBe(1)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rethrows non-429 errors without trying the next key', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401, message: 'bad key' })
    await expect(rotateAcrossKeys(['k1', 'k2'], 0, fn)).rejects.toMatchObject({ status: 401 })
    expect(fn).toHaveBeenCalledOnce()
  })
})
