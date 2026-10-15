import { describe, expect, it } from 'vitest'
import { GLOBAL_SOURCE_NAMES } from '../jobs/discovery/sources/enabled.js'

describe('discovery source registry', () => {
  it('does not enable the Wellfound HTML scrape', () => {
    expect(GLOBAL_SOURCE_NAMES).not.toContain('wellfound')
    expect(GLOBAL_SOURCE_NAMES).toEqual(['yc', 'remotive', 'adzuna', 'arbeitnow'])
  })
})
