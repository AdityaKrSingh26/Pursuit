import { describe, expect, it } from 'vitest'
import { shouldNotifyParseDone } from '../../../client/src/lib/parseStatus.ts'

describe('shouldNotifyParseDone', () => {
  it('is true only once parse has finished', () => {
    expect(shouldNotifyParseDone('DONE')).toBe(true)
    expect(shouldNotifyParseDone('PARSING')).toBe(false)
    expect(shouldNotifyParseDone(undefined)).toBe(false)
  })
})
