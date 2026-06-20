import { describe, it, expect } from 'vitest'
import { isoWeekKey } from '../lib/dateUtils.js'

describe('isoWeekKey', () => {
  it('correctly maps known dates to ISO 8601 week keys', () => {
    // 2026-06-12 is Friday of Week 24
    expect(isoWeekKey(new Date('2026-06-12'))).toBe('2026-W24')

    // 2026-06-19 is Friday of Week 25
    expect(isoWeekKey(new Date('2026-06-19'))).toBe('2026-W25')

    // Jan 1, 2026 is Thursday of Week 1
    expect(isoWeekKey(new Date('2026-01-01'))).toBe('2026-W01')
  })
})
